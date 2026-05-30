'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  Users,
  Settings,
  Code,
  Plus,
  Trash2,
  Edit,
  Search,
  Check,
  Lock,
  Unlock,
  CreditCard,
  Crown,
  ChevronRight,
  UserCheck,
  Shield,
  FileText,
  Kanban,
  X,
  RefreshCw,
  ArrowLeft,
  Calendar,
  AlertTriangle,
  PartyPopper,
  Terminal,
  Download,
  Eye
} from 'lucide-react';
import {
  updateAISetting,
  savePrompt,
  deletePrompt,
  togglePromptActive,
  updateUserRole,
  updateUserSubscription,
  getUserDetails,
  getAdminStats,
  getAIConfig,
  togglePromptArchive,
  getAdminAuditLogs,
  getAdminAuditStats
} from './actions';
import AlertModal from '@/components/ui/AlertModal';

interface AdminClientProps {
  initialStats: {
    totalUsers: number;
    totalCvs: number;
    totalOffers: number;
    activeSubscriptions: number;
  };
  initialUsers: any[];
  initialSettings: any[];
  initialPrompts: any[];
  initialAuditLogs: any[];
  initialAuditStats: {
    registersToday: number;
    loginsToday: number;
    cvsCreatedToday: number;
    downloadsToday: number;
  };
}

export default function AdminClient({
  initialStats,
  initialUsers,
  initialSettings,
  initialPrompts,
  initialAuditLogs,
  initialAuditStats,
}: AdminClientProps) {
  // Navigation / Tabs state
  const [activeTab, setActiveTab] = useState<'stats' | 'users' | 'ai' | 'prompts' | 'logs'>('stats');

  // Hydrated state
  const [stats, setStats] = useState(initialStats);
  const [usersList, setUsersList] = useState(initialUsers);
  const [dbSettings, setDbSettings] = useState(initialSettings);
  const [promptsList, setPromptsList] = useState(initialPrompts);
  const [auditLogs, setAuditLogs] = useState(initialAuditLogs);
  const [auditStats, setAuditStats] = useState(initialAuditStats);

  // Audit Logs Filtering State
  const [logSearchQuery, setLogSearchQuery] = useState('');
  const [logActionFilter, setLogActionFilter] = useState('all');
  const [logDateFilter, setLogDateFilter] = useState<'all' | 'today' | '7d' | '30d'>('all');

  // Selected audit log modal for detail view
  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // Selected user details modal
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [userDetails, setUserDetails] = useState<{ cvs: any[]; offers: any[] } | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Prompt Form Modal State
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false); // Mostrar archivados en el listado
  const [promptForm, setPromptForm] = useState<{
    id?: string;
    name: string;
    key: string;
    description: string;
    systemPrompt: string;
    userPrompt: string;
    isActive: boolean;
    isArchived: boolean;
    isStrict: boolean;
  }>({
    name: '',
    key: 'optimize_cv',
    description: '',
    systemPrompt: '',
    userPrompt: '',
    isActive: false,
    isArchived: false,
    isStrict: false,
  });

  // Exportar logs locales en JSON
  const handleExportLogs = () => {
    try {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(auditLogs, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `matchply_audit_logs_${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      showToast('Logs exportados con éxito');
    } catch (e) {
      showToast('Error al exportar logs', 'error');
    }
  };

  // Filtrado de logs de auditoría en memoria (rendimiento ultrarrápido y reactivo)
  const filteredAuditLogs = auditLogs.filter(log => {
    // 1. Filtro de búsqueda por texto
    if (logSearchQuery) {
      const query = logSearchQuery.toLowerCase();
      const emailMatch = log.userEmail?.toLowerCase().includes(query);
      const actionMatch = log.action.toLowerCase().includes(query);
      const ipMatch = log.ipAddress?.toLowerCase().includes(query);
      if (!emailMatch && !actionMatch && !ipMatch) return false;
    }

    // 2. Filtro por tipo de acción
    if (logActionFilter !== 'all') {
      if (log.action !== logActionFilter) return false;
    }

    // 3. Filtro de tiempo por fecha
    if (logDateFilter !== 'all') {
      const logDate = new Date(log.createdAt);
      const now = new Date();
      if (logDateFilter === 'today') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (logDate < today) return false;
      } else if (logDateFilter === '7d') {
        const sevenDaysAgo = new Date(now.setDate(now.getDate() - 7));
        if (logDate < sevenDaysAgo) return false;
      } else if (logDateFilter === '30d') {
        const thirtyDaysAgo = new Date(now.setDate(now.getDate() - 30));
        if (logDate < thirtyDaysAgo) return false;
      }
    }

    return true;
  });

  // IA Settings form state (local fields)
  const getSettingValue = (key: string, fallback: string) => {
    const s = dbSettings.find((item) => item.key === key);
    return s ? s.value : fallback;
  };

  const [freeProvider, setFreeProvider] = useState(() => getSettingValue('free_provider', 'openrouter'));
  const [freeModel, setFreeModel] = useState(() => getSettingValue('free_model', 'openrouter/free'));
  const [proProvider, setProProvider] = useState(() => getSettingValue('pro_provider', 'deepseek'));
  const [proModel, setProModel] = useState(() => getSettingValue('pro_model', 'deepseek-chat'));

  // Notification Toast State
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Dynamic Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'info' | 'warning' | 'danger' | 'success';
    confirmLabel: string;
    onConfirm: () => Promise<void> | void;
  } | null>(null);

  const [isPending, startTransition] = useTransition();

  // Refresh Stats and Configs
  const refreshData = async () => {
    const sRes = await getAdminStats();
    const aRes = await getAIConfig();
    const lRes = await getAdminAuditLogs();
    const astRes = await getAdminAuditStats();
    if (sRes.success) {
      setStats(sRes.stats!);
      setUsersList(sRes.users || []);
    }
    if (aRes.success) {
      setDbSettings(aRes.settings || []);
      setPromptsList(aRes.prompts || []);
    }
    if (lRes.success) {
      setAuditLogs(lRes.logs || []);
    }
    if (astRes.success) {
      setAuditStats(astRes.stats!);
    }
    showToast('Datos actualizados de la base de datos');
  };

  // Open user details modal
  const handleViewUserDetails = async (user: any) => {
    setSelectedUser(user);
    setLoadingDetails(true);
    setUserDetails(null);
    try {
      const res = await getUserDetails(user.id);
      if (res.success) {
        setUserDetails({ cvs: res.cvs || [], offers: res.offers || [] });
      } else {
        showToast(res.error || 'No se pudieron cargar los detalles', 'error');
      }
    } catch (e) {
      showToast('Error de red al cargar detalles', 'error');
    } finally {
      setLoadingDetails(false);
    }
  };

  // User Actions: Role Toggle
  const handleToggleUserRole = async (userId: string, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    
    setConfirmModal({
      isOpen: true,
      title: 'Cambiar Rol de Usuario',
      message: `¿Estás seguro de cambiar el rol de este usuario a "${newRole}"?`,
      type: 'warning',
      confirmLabel: 'Confirmar Cambio',
      onConfirm: async () => {
        setConfirmModal(null);
        const res = await updateUserRole(userId, newRole);
        if (res.success) {
          showToast('Rol de usuario actualizado');
          // Update local state
          setUsersList(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
          if (selectedUser?.id === userId) {
            setSelectedUser((prev: any) => ({ ...prev, role: newRole }));
          }
        } else {
          showToast(res.error || 'Error al actualizar rol', 'error');
        }
      }
    });
  };

  // User Actions: Subscription Update
  const handleUpdateSubscription = async (userId: string, newStatus: string) => {
    const res = await updateUserSubscription(userId, newStatus);
    if (res.success) {
      showToast(`Suscripción actualizada a "${newStatus}"`);
      setUsersList(prev => prev.map(u => u.id === userId ? { ...u, subscriptionStatus: newStatus } : u));
      if (selectedUser?.id === userId) {
        setSelectedUser((prev: any) => ({ ...prev, subscriptionStatus: newStatus }));
      }
    } else {
      showToast(res.error || 'Error al actualizar suscripción', 'error');
    }
  };

  // IA Settings Actions: Save
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateAISetting('free_provider', freeProvider);
      await updateAISetting('free_model', freeModel);
      await updateAISetting('pro_provider', proProvider);
      await updateAISetting('pro_model', proModel);
      
      showToast('Configuraciones de modelos de IA guardadas correctamente');
      refreshData();
    } catch (err) {
      showToast('Error al guardar configuraciones', 'error');
    }
  };

  // Prompt Actions: Toggle Active
  const handleTogglePromptActive = async (id: string, key: string) => {
    const res = await togglePromptActive(id, key);
    if (res.success) {
      showToast('Prompt activado correctamente');
      // Update local state
      setPromptsList(prev => prev.map(p => {
        if (p.key === key) {
          return { ...p, isActive: p.id === id };
        }
        return p;
      }));
    } else {
      showToast(res.error || 'Error al activar prompt', 'error');
    }
  };

  // Prompt Actions: Toggle Archive
  const handleTogglePromptArchive = async (id: string, isArchived: boolean) => {
    const res = await togglePromptArchive(id, isArchived);
    if (res.success) {
      showToast(isArchived ? 'Prompt archivado correctamente' : 'Prompt desarchivado correctamente');
      setPromptsList(prev => prev.map(p => p.id === id ? { ...p, isArchived } : p));
    } else {
      showToast(res.error || 'Error al archivar prompt', 'error');
    }
  };

  // Prompt Actions: Delete
  const handleDeletePrompt = async (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Eliminar Prompt',
      message: '¿Estás seguro de que deseas eliminar permanentemente este prompt?\n\nEsta acción borrará la plantilla del prompt de la base de datos y no se podrá recuperar.',
      type: 'danger',
      confirmLabel: 'Eliminar permanentemente',
      onConfirm: async () => {
        setConfirmModal(null);
        const res = await deletePrompt(id);
        if (res.success) {
          showToast('Prompt eliminado correctamente');
          setPromptsList(prev => prev.filter(p => p.id !== id));
        } else {
          showToast(res.error || 'Error al eliminar prompt', 'error');
        }
      }
    });
  };

  // Prompt Form Actions: Save/Create
  const handlePromptFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await savePrompt(promptForm);
    if (res.success) {
      showToast(promptForm.id ? 'Prompt editado con éxito' : 'Nuevo prompt creado con éxito');
      setIsPromptModalOpen(false);
      refreshData();
    } else {
      showToast(res.error || 'Error al guardar el prompt', 'error');
    }
  };

  // Open prompt modal in creation mode
  const openCreatePromptModal = () => {
    setPromptForm({
      name: '',
      key: 'optimize_cv',
      description: '',
      systemPrompt: 'Eres un redactor experto en CVs estilo Harvard...',
      userPrompt: 'CV Base:\n{{cv}}\n\nOferta de Trabajo:\n{{job}}',
      isActive: false,
      isArchived: false,
      isStrict: false,
    });
    setIsPromptModalOpen(true);
  };

  // Open prompt modal in editing mode
  const openEditPromptModal = (prompt: any) => {
    setPromptForm({
      id: prompt.id,
      name: prompt.name,
      key: prompt.key,
      description: prompt.description || '',
      systemPrompt: prompt.systemPrompt,
      userPrompt: prompt.userPrompt,
      isActive: prompt.isActive,
      isArchived: prompt.isArchived || false,
      isStrict: prompt.isStrict || false,
    });
    setIsPromptModalOpen(true);
  };

  // Filtered users for search list
  const filteredUsers = usersList.filter(u =>
    u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="relative text-[#1e1b4b] dark:text-[#f3f4f6] overflow-x-hidden font-sans">
      {/* Glow effects background */}
      <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-[#8b5cf6]/5 dark:bg-[#8b5cf6]/8 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[5%] left-[-15%] w-[45%] h-[45%] rounded-full bg-[#8b5cf6]/3 dark:bg-[#8b5cf6]/5 blur-[120px] pointer-events-none" />

      {/* Toast Notification */}
      {notification && (
        <div className={`fixed bottom-5 right-5 z-50 px-5 py-3.5 rounded-[12px] flex items-center gap-3 border shadow-lg transition-all transform animate-bounce ${
          notification.type === 'success'
            ? 'bg-white dark:bg-[#1f2937] border-[#2ecc71]/30 dark:border-[#2ecc71]/40 text-[#2ecc71] shadow-md shadow-[#2ecc71]/5'
            : 'bg-white dark:bg-[#1f2937] border-rose-500/30 dark:border-rose-500/40 text-rose-600 dark:text-rose-400 shadow-md shadow-rose-500/5'
        }`}>
          <div className={`p-1 rounded-full ${notification.type === 'success' ? 'bg-[#2ecc71]/10' : 'bg-rose-500/10'}`}>
            <Check className="w-4 h-4 stroke-[1.75]" />
          </div>
          <span className="text-xs font-semibold">{notification.message}</span>
        </div>
      )}

      {/* Main content grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        
        {/* Header de Página */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold font-display text-[#1e1b4b] dark:text-white flex items-center gap-2">
              <Shield className="w-6 h-6 text-[#8b5cf6] dark:text-violet-400 stroke-[1.75]" />
              Panel de Administración
            </h1>
            <p className="text-[#1e1b4b]/60 dark:text-slate-400 text-xs font-light font-sans mt-0.5">
              Gestiona usuarios registrados, suscripciones y configuraciones del motor de IA.
            </p>
          </div>
          <button
            onClick={refreshData}
            className="text-[#1e1b4b]/60 dark:text-slate-300 hover:text-[#1e1b4b] dark:hover:text-white p-2 rounded-[8px] bg-white dark:bg-[#1f2937] hover:bg-[#fafafa] dark:hover:bg-[#1f2937]/80 border border-[#1e1b4b]/10 dark:border-white/5 transition-all flex items-center gap-1.5 text-xs font-semibold shadow-sm font-display shrink-0"
            title="Refrescar Datos"
          >
            <RefreshCw className={`w-3.5 h-3.5 stroke-[1.75] ${isPending ? 'animate-spin' : ''}`} />
            <span>Sincronizar Datos</span>
          </button>
        </div>

        {/* Upper Tabs Navigation */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 mb-8 bg-white dark:bg-[#1f2937] border border-[#1e1b4b]/10 dark:border-white/5 p-2 rounded-[12px] shadow-sm">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 w-full md:w-auto">
            <button
              onClick={() => setActiveTab('stats')}
              className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-[8px] text-xs font-bold transition-all font-display border ${
                activeTab === 'stats'
                  ? 'bg-[#1e1b4b] dark:bg-white text-white dark:text-[#0b0f19] border-[#1e1b4b] dark:border-white shadow-sm'
                  : 'text-[#1e1b4b]/60 dark:text-slate-400 hover:text-[#1e1b4b] dark:hover:text-white hover:bg-[#fafafa] dark:hover:bg-[#0b0f19]/30 border-transparent'
              }`}
            >
              <Sparkles className="w-4 h-4 stroke-[1.75]" />
              <span>Resumen</span>
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-[8px] text-xs font-bold transition-all font-display border ${
                activeTab === 'users'
                  ? 'bg-[#1e1b4b] dark:bg-white text-white dark:text-[#0b0f19] border-[#1e1b4b] dark:border-white shadow-sm'
                  : 'text-[#1e1b4b]/60 dark:text-slate-400 hover:text-[#1e1b4b] dark:hover:text-white hover:bg-[#fafafa] dark:hover:bg-[#0b0f19]/30 border-transparent'
              }`}
            >
              <Users className="w-4 h-4 stroke-[1.75]" />
              <span>Usuarios ({usersList.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('ai')}
              className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-[8px] text-xs font-bold transition-all font-display border ${
                activeTab === 'ai'
                  ? 'bg-[#1e1b4b] dark:bg-white text-white dark:text-[#0b0f19] border-[#1e1b4b] dark:border-white shadow-sm'
                  : 'text-[#1e1b4b]/60 dark:text-slate-400 hover:text-[#1e1b4b] dark:hover:text-white hover:bg-[#fafafa] dark:hover:bg-[#0b0f19]/30 border-transparent'
              }`}
            >
              <Settings className="w-4 h-4 stroke-[1.75]" />
              <span>Modelos IA</span>
            </button>
            <button
              onClick={() => setActiveTab('prompts')}
              className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-[8px] text-xs font-bold transition-all font-display border ${
                activeTab === 'prompts'
                  ? 'bg-[#1e1b4b] dark:bg-white text-white dark:text-[#0b0f19] border-[#1e1b4b] dark:border-white shadow-sm'
                  : 'text-[#1e1b4b]/60 dark:text-slate-400 hover:text-[#1e1b4b] dark:hover:text-white hover:bg-[#fafafa] dark:hover:bg-[#0b0f19]/30 border-transparent'
              }`}
            >
              <Code className="w-4 h-4 stroke-[1.75]" />
              <span>Gestión Prompts</span>
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-[8px] text-xs font-bold transition-all font-display border ${
                activeTab === 'logs'
                  ? 'bg-[#1e1b4b] dark:bg-white text-white dark:text-[#0b0f19] border-[#1e1b4b] dark:border-white shadow-sm'
                  : 'text-[#1e1b4b]/60 dark:text-slate-400 hover:text-[#1e1b4b] dark:hover:text-white hover:bg-[#fafafa] dark:hover:bg-[#0b0f19]/30 border-transparent'
              }`}
            >
              <Terminal className="w-4 h-4 stroke-[1.75]" />
              <span>Auditoría</span>
            </button>
          </div>
          
          <div className="text-[#1e1b4b]/40 dark:text-slate-400 text-[11px] px-3 font-light text-center md:text-right">
            Sincronización en tiempo real activa • PostgreSQL
          </div>
        </div>

        {/* Tab content areas */}
        {activeTab === 'stats' && (
          <div className="space-y-8 animate-fadeIn">
            {/* Stat Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white dark:bg-[#1f2937] p-6 rounded-[12px] border border-[#1e1b4b]/10 dark:border-white/5 flex items-center justify-between group hover:border-[#8b5cf6]/30 dark:hover:border-[#8b5cf6]/40 hover:shadow-md transition-all duration-300">
                <div>
                  <span className="text-[#1e1b4b]/60 dark:text-slate-400 text-xs font-medium font-sans">Usuarios Registrados</span>
                  <h3 className="text-3xl font-bold font-display text-[#1e1b4b] dark:text-white mt-1.5 tracking-tight group-hover:text-[#8b5cf6] dark:group-hover:text-violet-400 transition-colors">
                    {stats.totalUsers}
                  </h3>
                </div>
                <div className="p-3.5 bg-[#8b5cf6]/10 dark:bg-[#8b5cf6]/20 text-[#8b5cf6] dark:text-violet-400 rounded-[8px] border border-[#8b5cf6]/10 dark:border-[#8b5cf6]/20 group-hover:bg-[#8b5cf6]/20 transition-all duration-300 shadow-sm">
                  <Users className="w-5 h-5 stroke-[1.75]" />
                </div>
              </div>

              <div className="bg-white dark:bg-[#1f2937] p-6 rounded-[12px] border border-[#1e1b4b]/10 dark:border-white/5 flex items-center justify-between group hover:border-[#2ecc71]/30 dark:hover:border-[#2ecc71]/40 hover:shadow-md transition-all duration-300">
                <div>
                  <span className="text-[#1e1b4b]/60 dark:text-slate-400 text-xs font-medium font-sans">Suscripciones PRO</span>
                  <h3 className="text-3xl font-bold font-display text-[#2ecc71] mt-1.5 tracking-tight">
                    {stats.activeSubscriptions}
                  </h3>
                </div>
                <div className="p-3.5 bg-[#2ecc71]/10 dark:bg-[#2ecc71]/20 text-[#2ecc71] dark:text-[#2ecc71] rounded-[8px] border border-[#2ecc71]/10 dark:border-[#2ecc71]/20 group-hover:bg-[#2ecc71]/20 transition-all duration-300 shadow-sm">
                  <Crown className="w-5 h-5 stroke-[1.75]" />
                </div>
              </div>

              <div className="bg-white dark:bg-[#1f2937] p-6 rounded-[12px] border border-[#1e1b4b]/10 dark:border-white/5 flex items-center justify-between group hover:border-[#8b5cf6]/30 dark:hover:border-[#8b5cf6]/40 hover:shadow-md transition-all duration-300">
                <div>
                  <span className="text-[#1e1b4b]/60 dark:text-slate-400 text-xs font-medium font-sans">Currículums Creados</span>
                  <h3 className="text-3xl font-bold font-display text-[#1e1b4b] dark:text-white mt-1.5 tracking-tight group-hover:text-[#8b5cf6] dark:group-hover:text-violet-400 transition-colors">
                    {stats.totalCvs}
                  </h3>
                </div>
                <div className="p-3.5 bg-[#8b5cf6]/10 dark:bg-[#8b5cf6]/20 text-[#8b5cf6] dark:text-violet-400 rounded-[8px] border border-[#8b5cf6]/10 dark:border-[#8b5cf6]/20 group-hover:bg-[#8b5cf6]/20 transition-all duration-300 shadow-sm">
                  <FileText className="w-5 h-5 stroke-[1.75]" />
                </div>
              </div>

              <div className="bg-white dark:bg-[#1f2937] p-6 rounded-[12px] border border-[#1e1b4b]/10 dark:border-white/5 flex items-center justify-between group hover:border-[#8b5cf6]/30 dark:hover:border-[#8b5cf6]/40 hover:shadow-md transition-all duration-300">
                <div>
                  <span className="text-[#1e1b4b]/60 dark:text-slate-400 text-xs font-medium font-sans">Candidaturas Kanban</span>
                  <h3 className="text-3xl font-bold font-display text-[#1e1b4b] dark:text-white mt-1.5 tracking-tight group-hover:text-[#8b5cf6] dark:group-hover:text-violet-400 transition-colors">
                    {stats.totalOffers}
                  </h3>
                </div>
                <div className="p-3.5 bg-[#8b5cf6]/10 dark:bg-[#8b5cf6]/20 text-[#8b5cf6] dark:text-violet-400 rounded-[8px] border border-[#8b5cf6]/10 dark:border-[#8b5cf6]/20 group-hover:bg-[#8b5cf6]/20 transition-all duration-300 shadow-sm">
                  <Kanban className="w-5 h-5 stroke-[1.75]" />
                </div>
              </div>
            </div>

            {/* Quick overview layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-white dark:bg-[#1f2937] p-6 rounded-[12px] border border-[#1e1b4b]/10 dark:border-white/5 lg:col-span-2 shadow-sm">
                <h3 className="text-base font-semibold font-display text-[#1e1b4b] dark:text-white mb-1">Información General del Sistema</h3>
                <p className="text-[#1e1b4b]/60 dark:text-slate-400 text-xs font-light mb-6">Estado global del entorno y base de datos relacional.</p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-light">
                  <div className="p-4 bg-[#fafafa] dark:bg-[#0b0f19]/40 border border-[#1e1b4b]/5 dark:border-white/5 rounded-[12px]">
                    <span className="text-[#1e1b4b]/40 dark:text-slate-500 font-bold block mb-1 text-[10px] tracking-wider">PROVEEDOR PLAN GRATIS</span>
                    <span className="text-[#1e1b4b] dark:text-white font-semibold uppercase">{freeProvider}</span>
                    <span className="text-[#1e1b4b]/60 dark:text-slate-400 block mt-0.5">Modelo: {freeModel}</span>
                  </div>

                  <div className="p-4 bg-[#fafafa] dark:bg-[#0b0f19]/40 border border-[#1e1b4b]/5 dark:border-white/5 rounded-[12px]">
                    <span className="text-[#1e1b4b]/40 dark:text-slate-500 font-bold block mb-1 text-[10px] tracking-wider">PROVEEDOR PLAN PRO</span>
                    <span className="text-[#2ecc71] font-semibold uppercase">{proProvider}</span>
                    <span className="text-[#1e1b4b]/60 dark:text-slate-400 block mt-0.5">Modelo: {proModel}</span>
                  </div>

                  <div className="p-4 bg-[#fafafa] dark:bg-[#0b0f19]/40 border border-[#1e1b4b]/5 dark:border-white/5 rounded-[12px]">
                    <span className="text-[#1e1b4b]/40 dark:text-slate-500 font-bold block mb-1 text-[10px] tracking-wider">PROMPTS INSTALADOS</span>
                    <span className="text-[#1e1b4b] dark:text-white font-semibold">{promptsList.length} Prompts guardados</span>
                    <span className="text-[#2ecc71] block mt-0.5 font-medium">
                      {promptsList.filter(p => p.isActive).length} Activos actualmente
                    </span>
                  </div>

                  <div className="p-4 bg-[#fafafa] dark:bg-[#0b0f19]/40 border border-[#1e1b4b]/5 dark:border-white/5 rounded-[12px]">
                    <span className="text-[#1e1b4b]/40 dark:text-slate-500 font-bold block mb-1 text-[10px] tracking-wider">TASA DE CONVERSIÓN PRO</span>
                    <span className="text-[#1e1b4b] dark:text-white font-semibold">
                      {stats.totalUsers > 0 
                        ? `${((stats.activeSubscriptions / stats.totalUsers) * 100).toFixed(1)}%` 
                        : '0%'
                      } de usuarios totales
                    </span>
                    <span className="text-[#1e1b4b]/60 dark:text-slate-400 block mt-0.5">Ingresos recurrentes activos</span>
                  </div>
                </div>

                <div className="mt-6 p-4 rounded-[12px] border border-[#1e1b4b]/10 dark:border-white/5 bg-[#fafafa]/50 dark:bg-[#0b0f19]/20 flex items-start gap-3">
                  <div className="p-2 bg-[#8b5cf6]/10 text-[#8b5cf6] rounded-[8px] border border-[#8b5cf6]/20 shrink-0">
                    <Shield className="w-4 h-4 stroke-[1.75]" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#1e1b4b] dark:text-white mb-0.5 font-display">Control de Suscripciones Manuales</h4>
                    <p className="text-[11px] text-[#1e1b4b]/60 dark:text-slate-400 leading-relaxed font-light font-sans">
                      Como administrador, puedes ascender cuentas ordinarias a PRO o conceder privilegios directamente desde la pestaña de Usuarios para facilitar pruebas rápidas o dar soporte directo.
                    </p>
                  </div>
                </div>
              </div>

              {/* Quick AI status */}
              <div className="bg-white dark:bg-[#1f2937] p-6 rounded-[12px] border border-[#1e1b4b]/10 dark:border-white/5 flex flex-col justify-between shadow-sm">
                <div>
                  <h3 className="text-base font-semibold font-display text-[#1e1b4b] dark:text-white mb-1">Estado de los Motores IA</h3>
                  <p className="text-[#1e1b4b]/60 dark:text-slate-400 text-xs font-light mb-6">Detalles de las APIs conectadas actualmente.</p>

                  <div className="space-y-4 font-sans">
                    <div className="flex items-center justify-between border-b border-[#1e1b4b]/5 dark:border-white/5 pb-3">
                      <div>
                        <span className="text-xs font-bold text-[#1e1b4b] dark:text-white block">OpenRouter</span>
                        <span className="text-[10px] text-[#1e1b4b]/45 dark:text-slate-500">Plan Free & Backups</span>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-[8px] bg-[#2ecc71]/10 text-[#2ecc71] border border-[#2ecc71]/20 font-bold">Activo</span>
                    </div>

                    <div className="flex items-center justify-between border-b border-[#1e1b4b]/5 dark:border-white/5 pb-3">
                      <div>
                        <span className="text-xs font-bold text-[#1e1b4b] dark:text-white block">DeepSeek API</span>
                        <span className="text-[10px] text-[#1e1b4b]/45 dark:text-slate-500">Plan PRO Principal</span>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-[8px] bg-[#2ecc71]/10 text-[#2ecc71] border border-[#2ecc71]/20 font-bold">Suscrito</span>
                    </div>

                    <div className="flex items-center justify-between pb-1">
                      <div>
                        <span className="text-xs font-bold text-[#1e1b4b] dark:text-white block">Gemini API</span>
                        <span className="text-[10px] text-[#1e1b4b]/45 dark:text-slate-500">PRO & Multimodal</span>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-[8px] bg-[#8b5cf6]/10 text-[#8b5cf6] border border-[#8b5cf6]/20 font-bold">Configurado</span>
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-4 border-t border-[#1e1b4b]/5 dark:border-white/5">
                  <button
                    onClick={() => setActiveTab('ai')}
                    className="w-full bg-[#1e1b4b] hover:bg-[#1e1b4b]/90 dark:bg-white dark:hover:bg-slate-100 border border-[#1e1b4b] dark:border-white text-white dark:text-[#0b0f19] font-bold py-2.5 rounded-[8px] text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm font-display"
                  >
                    <span>Configurar Modelos</span>
                    <ChevronRight className="w-3.5 h-3.5 stroke-[1.75]" />
                  </button>
                </div>
            </div>
          </div>
        </div>
      )}

        {/* Tab: Users Management */}
        {activeTab === 'users' && (
          <div className="bg-white dark:bg-[#1f2937] p-6 rounded-[12px] border border-[#1e1b4b]/10 dark:border-white/5 shadow-sm animate-fadeIn">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-base font-semibold font-display text-[#1e1b4b] dark:text-white">Listado Completo de Usuarios</h3>
                <p className="text-[#1e1b4b]/60 dark:text-slate-400 text-xs font-light font-sans">Explora y gestiona los roles y el estado de suscripción de los candidatos.</p>
              </div>

              {/* Search Bar */}
              <div className="relative w-full md:w-72">
                <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-[#1e1b4b]/40 dark:text-slate-500 stroke-[1.75]" />
                <input
                  type="text"
                  placeholder="Buscar por nombre o correo..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-[#fafafa] dark:bg-[#0b0f19]/40 border border-[#1e1b4b]/10 dark:border-white/10 rounded-[8px] pl-10 pr-4 py-2.5 text-xs text-[#1e1b4b] dark:text-white placeholder-[#1e1b4b]/40 dark:placeholder-slate-500 focus:outline-none focus:border-[#8b5cf6] transition-all w-full font-sans"
                />
              </div>
            </div>

            {filteredUsers.length === 0 ? (
              <div className="border border-[#1e1b4b]/10 dark:border-white/5 border-dashed rounded-[12px] p-12 text-center text-[#1e1b4b]/60 dark:text-slate-400 text-xs font-light font-sans">
                No se encontraron usuarios que coincidan con la búsqueda.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-[12px] border border-[#1e1b4b]/10 dark:border-white/5 shadow-sm">
                <table className="min-w-full divide-y divide-[#1e1b4b]/10 dark:divide-white/10 text-left text-xs font-light font-sans">
                  <thead className="bg-[#fafafa] dark:bg-[#0b0f19]/30 text-[10px] text-[#1e1b4b]/60 dark:text-slate-400 font-bold uppercase tracking-wider font-display">
                    <tr>
                      <th className="px-6 py-4">Usuario</th>
                      <th className="px-6 py-4">Correo Electrónico</th>
                      <th className="px-6 py-4">Rol</th>
                      <th className="px-6 py-4">Suscripción</th>
                      <th className="px-6 py-4">Fecha Registro</th>
                      <th className="px-6 py-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1e1b4b]/5 dark:divide-white/5 bg-white dark:bg-[#1f2937]/50">
                    {filteredUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-[#fafafa] dark:hover:bg-[#0b0f19]/20 transition-colors group">
                        <td className="px-6 py-4 font-semibold text-[#1e1b4b] dark:text-slate-200 whitespace-nowrap font-display">
                          {user.name || 'Sin nombre'}
                        </td>
                        <td className="px-6 py-4 text-[#1e1b4b]/80 dark:text-slate-300 whitespace-nowrap">
                          {user.email}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {user.role === 'admin' ? (
                            <span className="bg-[#8b5cf6]/10 text-[#8b5cf6] dark:text-violet-400 border border-[#8b5cf6]/20 dark:border-violet-500/30 text-[10px] font-bold px-2 py-0.5 rounded-[8px] flex items-center gap-1 w-fit shadow-sm font-display">
                              <Shield className="w-3 h-3 stroke-[1.75]" /> Admin
                            </span>
                          ) : (
                            <span className="bg-[#fafafa] dark:bg-[#0b0f19]/40 text-[#1e1b4b]/60 dark:text-slate-400 border border-[#1e1b4b]/10 dark:border-white/10 text-[10px] font-bold px-2 py-0.5 rounded-[8px] w-fit font-display">
                              Usuario
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {user.subscriptionStatus === 'active' ? (
                            <span className="bg-[#2ecc71]/10 text-[#2ecc71] border border-[#2ecc71]/20 dark:border-[#2ecc71]/30 text-[10px] font-bold px-2.5 py-0.5 rounded-[8px] flex items-center gap-1 w-fit shadow-sm font-display">
                              <Crown className="w-3.5 h-3.5 text-[#2ecc71] stroke-[1.75]" /> PRO
                            </span>
                          ) : (
                            <span className="bg-[#fafafa] dark:bg-[#0b0f19]/40 text-[#1e1b4b]/40 dark:text-slate-500 border border-[#1e1b4b]/10 dark:border-white/10 text-[10px] font-medium px-2 py-0.5 rounded-[8px] w-fit font-display">
                              Plan Free
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-[#1e1b4b]/60 dark:text-slate-400 whitespace-nowrap">
                          {new Date(user.createdAt).toLocaleDateString('es-ES', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <button
                            onClick={() => handleViewUserDetails(user)}
                            className="bg-white dark:bg-[#1f2937] hover:bg-[#fafafa] dark:hover:bg-[#0b0f19]/30 border border-[#1e1b4b]/10 dark:border-white/10 hover:border-[#8b5cf6]/30 dark:hover:border-[#8b5cf6]/40 text-[#8b5cf6] dark:text-violet-400 hover:text-[#8b5cf6]/85 font-bold px-3 py-1.5 rounded-[8px] text-[10px] transition-all font-display shadow-sm"
                          >
                            Ver Detalles
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab: IA Config */}
        {activeTab === 'ai' && (
          <div className="max-w-2xl mx-auto bg-white dark:bg-[#1f2937] p-6 rounded-[12px] border border-[#1e1b4b]/10 dark:border-white/5 shadow-sm animate-fadeIn">
            <div className="border-b border-[#1e1b4b]/5 dark:border-white/5 pb-4 mb-6">
              <h3 className="text-base font-semibold font-display text-[#1e1b4b] dark:text-white">Configuración del Motor de IA</h3>
              <p className="text-[#1e1b4b]/60 dark:text-slate-400 text-xs font-light mt-0.5 font-sans">Asigna qué proveedor de API y qué modelo específico se utilizará en cada plan de usuario.</p>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-6">
              
              {/* Free Plan Settings */}
              <div className="bg-[#fafafa] dark:bg-[#0b0f19]/40 p-5 rounded-[12px] border border-[#1e1b4b]/10 dark:border-white/5">
                <h4 className="text-xs font-bold text-[#1e1b4b] dark:text-white flex items-center gap-2 mb-4 font-display">
                  <span className="w-2 h-2 rounded-full bg-[#2ecc71]" />
                  PLAN GRATUITO (FREE)
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5 font-sans">
                    <label className="text-[10px] font-bold text-[#1e1b4b]/60 dark:text-slate-400 uppercase tracking-wider block font-display">Proveedor</label>
                    <select
                      value={freeProvider}
                      onChange={(e) => setFreeProvider(e.target.value)}
                      className="bg-white dark:bg-[#1f2937] border border-[#1e1b4b]/10 dark:border-white/10 rounded-[8px] px-3.5 py-2.5 text-xs text-[#1e1b4b] dark:text-white focus:outline-none focus:border-[#8b5cf6] dark:focus:border-[#8b5cf6] transition-colors"
                    >
                      <option value="openrouter" className="dark:bg-[#1f2937]">OpenRouter (Recomendado)</option>
                      <option value="deepseek" className="dark:bg-[#1f2937]">DeepSeek Oficial</option>
                      <option value="gemini" className="dark:bg-[#1f2937]">Gemini Oficial (Google)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5 font-sans">
                    <label className="text-[10px] font-bold text-[#1e1b4b]/60 dark:text-slate-400 uppercase tracking-wider block font-display">Modelo específico</label>
                    <input
                      type="text"
                      value={freeModel}
                      onChange={(e) => setFreeModel(e.target.value)}
                      placeholder="e.g. openrouter/free"
                      className="bg-white dark:bg-[#1f2937] border border-[#1e1b4b]/10 dark:border-white/10 rounded-[8px] px-3.5 py-2.5 text-xs text-[#1e1b4b] dark:text-white placeholder-[#1e1b4b]/30 dark:placeholder-slate-500 focus:outline-none focus:border-[#8b5cf6] dark:focus:border-[#8b5cf6] transition-colors font-mono"
                      required
                    />
                  </div>
                </div>
                <div className="mt-2 text-[10px] text-[#1e1b4b]/50 dark:text-slate-500 font-light font-sans">
                  * Por defecto para el plan Free se utiliza el modelo `openrouter/free` provisto por OpenRouter.
                </div>
              </div>

              {/* PRO Plan Settings */}
              <div className="bg-[#fafafa] dark:bg-[#0b0f19]/40 p-5 rounded-[12px] border border-[#1e1b4b]/10 dark:border-white/5">
                <h4 className="text-xs font-bold text-[#8b5cf6] dark:text-violet-400 flex items-center gap-2 mb-4 font-display">
                  <Crown className="w-3.5 h-3.5 text-[#8b5cf6] dark:text-violet-400 stroke-[1.75]" />
                  PLAN PREMIUM (PRO)
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5 font-sans">
                    <label className="text-[10px] font-bold text-[#1e1b4b]/60 dark:text-slate-400 uppercase tracking-wider block font-display">Proveedor</label>
                    <select
                      value={proProvider}
                      onChange={(e) => setProProvider(e.target.value)}
                      className="bg-white dark:bg-[#1f2937] border border-[#1e1b4b]/10 dark:border-white/10 rounded-[8px] px-3.5 py-2.5 text-xs text-[#1e1b4b] dark:text-white focus:outline-none focus:border-[#8b5cf6] dark:focus:border-[#8b5cf6] transition-colors"
                    >
                      <option value="deepseek" className="dark:bg-[#1f2937]">DeepSeek Oficial (Recomendado)</option>
                      <option value="gemini" className="dark:bg-[#1f2937]">Gemini Oficial (Google)</option>
                      <option value="openrouter" className="dark:bg-[#1f2937]">OpenRouter</option>
                    </select>
                  </div>

                  <div className="space-y-1.5 font-sans">
                    <label className="text-[10px] font-bold text-[#1e1b4b]/60 dark:text-slate-400 uppercase tracking-wider block font-display">Modelo específico</label>
                    <input
                      type="text"
                      value={proModel}
                      onChange={(e) => setProModel(e.target.value)}
                      placeholder="e.g. deepseek-chat"
                      className="bg-white dark:bg-[#1f2937] border border-[#1e1b4b]/10 dark:border-white/10 rounded-[8px] px-3.5 py-2.5 text-xs text-[#1e1b4b] dark:text-white placeholder-[#1e1b4b]/30 dark:placeholder-slate-500 focus:outline-none focus:border-[#8b5cf6] dark:focus:border-[#8b5cf6] transition-colors font-mono"
                      required
                    />
                  </div>
                </div>
                <div className="mt-2 text-[10px] text-[#1e1b4b]/50 dark:text-slate-500 font-light font-sans">
                  * Recomendaciones: para DeepSeek oficial usar `deepseek-chat`, para Gemini usar `gemini-1.5-pro` o `gemini-1.5-flash`.
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full bg-[#1e1b4b] dark:bg-white hover:bg-[#1e1b4b]/90 dark:hover:bg-slate-100 border border-[#1e1b4b] dark:border-white text-white dark:text-[#0b0f19] font-bold py-3.5 rounded-[8px] text-xs transition-all shadow-sm flex items-center justify-center gap-2 font-display"
                >
                  <Check className="w-4 h-4 stroke-[1.75]" />
                  Guardar Configuración de IA
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tab: Prompts Management */}
        {activeTab === 'prompts' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#1f2937] p-6 rounded-[12px] border border-[#1e1b4b]/10 dark:border-white/5 shadow-sm text-[#1e1b4b] dark:text-[#f3f4f6]">
              <div>
                <h3 className="text-base font-semibold font-display text-[#1e1b4b] dark:text-white">Biblioteca de Prompts Dinámicos</h3>
                <p className="text-[#1e1b4b]/60 dark:text-slate-400 text-xs font-light mt-0.5 font-sans">Define las directrices del sistema y plantillas de usuario que gobernarán las optimizaciones de IA.</p>
              </div>
              <div className="flex items-center gap-3.5 w-full sm:w-auto shrink-0">
                <button
                  onClick={() => setShowArchived(!showArchived)}
                  className={`px-4 py-2.5 rounded-[8px] text-xs font-bold transition-all border font-display ${
                    showArchived
                      ? 'bg-amber-500/10 text-amber-600 border-amber-500/20 hover:bg-amber-500/20'
                      : 'bg-white dark:bg-[#1f2937] border-[#1e1b4b]/10 dark:border-white/10 text-[#1e1b4b]/60 dark:text-slate-400 hover:text-[#1e1b4b] dark:hover:text-white hover:bg-[#fafafa] dark:hover:bg-[#0b0f19]/30'
                  }`}
                >
                  {showArchived ? 'Ocultar Archivados' : 'Mostrar Archivados'}
                </button>
                <button
                  onClick={openCreatePromptModal}
                  className="bg-[#1e1b4b] dark:bg-white hover:bg-[#1e1b4b]/90 dark:hover:bg-slate-100 border border-[#1e1b4b] dark:border-white text-white dark:text-[#0b0f19] font-bold px-4 py-2.5 rounded-[8px] text-xs transition-all shadow-sm flex items-center justify-center gap-1.5 font-display"
                >
                  <Plus className="w-4 h-4 stroke-[1.75]" />
                  Crear Nuevo Prompt
                </button>
              </div>
            </div>

            {promptsList.length === 0 ? (
              <div className="bg-white dark:bg-[#1f2937] border border-[#1e1b4b]/10 dark:border-white/5 border-dashed rounded-[12px] p-16 text-center shadow-sm">
                <div className="bg-[#fafafa] dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 p-4 rounded-full text-[#1e1b4b]/40 dark:text-slate-500 w-fit mx-auto mb-4">
                  <Code className="w-8 h-8 stroke-[1.75]" />
                </div>
                <h4 className="text-base font-semibold font-display text-[#1e1b4b] dark:text-white mb-1">No hay prompts personalizados en la DB</h4>
                <p className="text-[#1e1b4b]/60 dark:text-slate-400 text-xs font-light max-w-sm mx-auto mb-6 font-sans">
                  El sistema está utilizando los prompts estáticos por defecto. Crea tu primer prompt dinámico para empezar a gestionarlo.
                </p>
                <button
                  onClick={openCreatePromptModal}
                  className="bg-white dark:bg-[#1f2937] hover:bg-[#fafafa] dark:hover:bg-[#0b0f19]/30 text-[#1e1b4b] dark:text-slate-200 font-bold px-4 py-2 rounded-[8px] text-xs border border-[#1e1b4b]/10 dark:border-white/10 transition-all shadow-sm font-display"
                >
                  Crear Primer Prompt
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6">
                {promptsList
                  .filter((p) => (showArchived ? true : !p.isArchived))
                  .map((prompt) => (
                  <div
                    key={prompt.id}
                    className={`bg-white dark:bg-[#1f2937] p-6 rounded-[12px] border transition-all relative overflow-hidden group shadow-sm ${
                      prompt.isActive 
                        ? 'border-[#2ecc71] dark:border-[#2ecc71]/60 shadow-lg shadow-[#2ecc71]/5' 
                        : prompt.isArchived
                          ? 'border-[#1e1b4b]/5 dark:border-white/5 opacity-60 hover:opacity-100'
                          : 'border-[#1e1b4b]/10 dark:border-white/10 hover:border-[#1e1b4b]/20 dark:hover:border-white/20'
                    }`}
                  >
                    {/* Glowing side accent for active prompt */}
                    {prompt.isActive && (
                      <div className="absolute top-0 left-0 w-1.5 h-full bg-[#2ecc71]" />
                    )}

                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
                      <div>
                        <div className="flex items-center gap-2.5 mb-1.5">
                          <h4 className="font-bold font-display text-[#1e1b4b] dark:text-white text-base">
                            {prompt.name}
                          </h4>
                          {prompt.isActive && (
                            <span className="bg-[#2ecc71]/10 text-[#2ecc71] border border-[#2ecc71]/20 text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-[8px] flex items-center gap-0.5 font-display">
                              <Check className="w-2.5 h-2.5 stroke-[1.75]" /> Activo
                            </span>
                          )}
                          {prompt.isArchived && (
                            <span className="bg-amber-500/10 text-amber-600 dark:text-amber-500 border border-amber-500/20 dark:border-amber-500/30 text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-[8px] font-display">
                              Archivado
                            </span>
                          )}
                          {!prompt.isActive && !prompt.isArchived && (
                            <span className="bg-[#fafafa] dark:bg-[#0b0f19]/40 text-[#1e1b4b]/40 dark:text-slate-500 border border-[#1e1b4b]/10 dark:border-white/10 text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-[8px] font-display">
                              Inactivo
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] bg-[#fafafa] dark:bg-[#0b0f19]/40 border border-[#1e1b4b]/10 dark:border-white/10 text-[#1e1b4b]/60 dark:text-slate-400 font-mono px-2 py-0.5 rounded-[8px]">
                          Función: {prompt.key}
                        </span>
                        {prompt.isStrict && (
                          <span className="ml-2 text-[10px] bg-[#8b5cf6]/10 border border-[#8b5cf6]/20 text-[#8b5cf6] dark:text-violet-400 font-mono px-2 py-0.5 rounded-[8px] inline-flex items-center gap-1">
                            <Sparkles className="w-2.5 h-2.5 stroke-[1.75] animate-pulse" /> MD Estricto
                          </span>
                        )}
                      </div>

                      {/* Prompts actions toolbar */}
                      <div className="flex items-center gap-2 self-start">
                        {!prompt.isActive && !prompt.isArchived && (
                          <button
                            onClick={() => handleTogglePromptActive(prompt.id, prompt.key)}
                            className="bg-white dark:bg-[#1f2937] hover:bg-[#fafafa] dark:hover:bg-[#0b0f19]/30 text-[#2ecc71] border border-[#1e1b4b]/10 dark:border-white/10 hover:border-[#2ecc71]/30 dark:hover:border-[#2ecc71]/40 font-semibold px-3 py-1.5 rounded-[8px] text-[10px] transition-colors font-display"
                          >
                            Activar
                          </button>
                        )}
                        <button
                          onClick={() => handleTogglePromptArchive(prompt.id, !prompt.isArchived)}
                          className={`font-semibold px-3 py-1.5 rounded-[8px] text-[10px] border transition-colors font-display ${
                            prompt.isArchived
                              ? 'text-amber-600 dark:text-amber-500 hover:text-amber-500 bg-white dark:bg-[#1f2937] border-amber-500/20 dark:border-amber-500/30'
                              : 'text-[#1e1b4b]/60 dark:text-slate-400 hover:text-[#1e1b4b] dark:hover:text-white bg-white dark:bg-[#1f2937] border-[#1e1b4b]/10 dark:border-white/10 hover:bg-[#fafafa] dark:hover:bg-[#0b0f19]/30'
                          }`}
                          disabled={prompt.isActive}
                          title={prompt.isActive ? "No puedes archivar un prompt activo" : ""}
                        >
                          {prompt.isArchived ? 'Desarchivar' : 'Archivar'}
                        </button>
                        <button
                          onClick={() => openEditPromptModal(prompt)}
                          className="bg-white dark:bg-[#1f2937] hover:bg-[#fafafa] dark:hover:bg-[#0b0f19]/30 text-[#1e1b4b]/80 dark:text-slate-300 hover:text-[#1e1b4b] dark:hover:text-white p-2 rounded-[8px] border border-[#1e1b4b]/10 dark:border-white/10 transition-colors"
                          title="Editar"
                        >
                          <Edit className="w-3.5 h-3.5 stroke-[1.75]" />
                        </button>
                        {!prompt.isActive && (
                          <button
                            onClick={() => handleDeletePrompt(prompt.id)}
                            className="bg-white dark:bg-[#1f2937] hover:bg-rose-50 dark:hover:bg-rose-955/20 text-[#1e1b4b]/40 dark:text-slate-555 hover:text-rose-500 dark:hover:text-rose-400 p-2 rounded-[8px] border border-[#1e1b4b]/10 dark:border-white/10 hover:border-rose-200 dark:hover:border-rose-900/30 transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 className="w-3.5 h-3.5 stroke-[1.75]" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3 font-mono text-[10px] text-[#1e1b4b]/80 dark:text-slate-300">
                      {prompt.description && (
                        <div className="bg-[#8b5cf6]/5 dark:bg-[#8b5cf6]/10 rounded-[12px] p-4 border border-[#8b5cf6]/10 dark:border-violet-500/20 text-xs font-light text-[#1e1b4b] dark:text-slate-200 font-sans leading-relaxed">
                          <span className="block text-[8px] text-[#8b5cf6] dark:text-violet-400 font-bold uppercase tracking-wider mb-1 font-display">DESCRIPCIÓN DE LA OPTIMIZACIÓN (MOSTRADA AL USUARIO)</span>
                          "{prompt.description}"
                        </div>
                      )}

                      <div className="bg-[#fafafa] dark:bg-[#0b0f19]/40 rounded-[12px] p-4 border border-[#1e1b4b]/5 dark:border-white/5">
                        <span className="block text-[9px] text-[#1e1b4b]/40 dark:text-slate-500 font-bold uppercase tracking-wider mb-2 font-display">SYSTEM INSTRUCTION (Directiva de Sistema)</span>
                        <div className="whitespace-pre-wrap leading-relaxed max-h-36 overflow-y-auto pr-1">
                          {prompt.systemPrompt}
                        </div>
                      </div>

                      <div className="bg-[#fafafa] dark:bg-[#0b0f19]/40 rounded-[12px] p-4 border border-[#1e1b4b]/5 dark:border-white/5">
                        <span className="block text-[9px] text-[#1e1b4b]/40 dark:text-slate-500 font-bold uppercase tracking-wider mb-2 font-display">USER TEMPLATE (Estructura de Usuario)</span>
                        <div className="whitespace-pre-wrap leading-relaxed max-h-24 overflow-y-auto pr-1">
                          {prompt.userPrompt}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab: Logs / Auditoría */}
        {activeTab === 'logs' && (
          <div className="space-y-6 animate-fadeIn text-[#1e1b4b] dark:text-[#f3f4f6]">
            {/* Tarjetas de Estadísticas de Hoy */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white dark:bg-[#1f2937] p-5 rounded-[12px] border border-[#1e1b4b]/10 dark:border-white/5 flex items-center justify-between shadow-sm">
                <div>
                  <span className="text-[#1e1b4b]/60 dark:text-slate-400 text-[11px] font-medium font-sans">Registros de Hoy</span>
                  <h4 className="text-2xl font-bold font-display text-[#1e1b4b] dark:text-white mt-1">
                    {auditStats.registersToday}
                  </h4>
                </div>
                <div className="p-3 bg-[#8b5cf6]/10 dark:bg-[#8b5cf6]/20 text-[#8b5cf6] dark:text-violet-400 rounded-lg">
                  <Users className="w-4.5 h-4.5 stroke-[1.75]" />
                </div>
              </div>

              <div className="bg-white dark:bg-[#1f2937] p-5 rounded-[12px] border border-[#1e1b4b]/10 dark:border-white/5 flex items-center justify-between shadow-sm">
                <div>
                  <span className="text-[#1e1b4b]/60 dark:text-slate-400 text-[11px] font-medium font-sans">Inicios de Sesión Hoy</span>
                  <h4 className="text-2xl font-bold font-display text-emerald-600 dark:text-emerald-400 mt-1">
                    {auditStats.loginsToday}
                  </h4>
                </div>
                <div className="p-3 bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-lg">
                  <UserCheck className="w-4.5 h-4.5 stroke-[1.75]" />
                </div>
              </div>

              <div className="bg-white dark:bg-[#1f2937] p-5 rounded-[12px] border border-[#1e1b4b]/10 dark:border-white/5 flex items-center justify-between shadow-sm">
                <div>
                  <span className="text-[#1e1b4b]/60 dark:text-slate-400 text-[11px] font-medium font-sans">CVs Creados Hoy</span>
                  <h4 className="text-2xl font-bold font-display text-[#8b5cf6] dark:text-violet-400 mt-1">
                    {auditStats.cvsCreatedToday}
                  </h4>
                </div>
                <div className="p-3 bg-[#8b5cf6]/10 dark:bg-[#8b5cf6]/20 text-[#8b5cf6] dark:text-violet-400 rounded-lg">
                  <FileText className="w-4.5 h-4.5 stroke-[1.75]" />
                </div>
              </div>

              <div className="bg-white dark:bg-[#1f2937] p-5 rounded-[12px] border border-[#1e1b4b]/10 dark:border-white/5 flex items-center justify-between shadow-sm">
                <div>
                  <span className="text-[#1e1b4b]/60 dark:text-slate-400 text-[11px] font-medium font-sans">Descargas PDF Hoy</span>
                  <h4 className="text-2xl font-bold font-display text-amber-600 dark:text-amber-500 mt-1">
                    {auditStats.downloadsToday}
                  </h4>
                </div>
                <div className="p-3 bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-500 rounded-lg">
                  <Download className="w-4.5 h-4.5 stroke-[1.75]" />
                </div>
              </div>
            </div>

            {/* Barra de Filtros Dinámicos */}
            <div className="bg-white dark:bg-[#1f2937] p-5 rounded-[12px] border border-[#1e1b4b]/10 dark:border-white/5 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4 font-sans">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto flex-1">
                {/* Búsqueda por Email */}
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-3 w-3.5 h-3.5 text-[#1e1b4b]/40 dark:text-slate-500 stroke-[1.75]" />
                  <input
                    type="text"
                    placeholder="Filtrar por correo o acción..."
                    value={logSearchQuery}
                    onChange={(e) => setLogSearchQuery(e.target.value)}
                    className="bg-[#fafafa] dark:bg-[#0b0f19]/40 border border-[#1e1b4b]/10 dark:border-white/10 rounded-[8px] pl-9 pr-4 py-2 text-xs text-[#1e1b4b] dark:text-white focus:outline-none focus:border-[#8b5cf6] w-full"
                  />
                </div>

                {/* Filtro por Acción */}
                <select
                  value={logActionFilter}
                  onChange={(e) => setLogActionFilter(e.target.value)}
                  className="bg-[#fafafa] dark:bg-[#0b0f19]/40 border border-[#1e1b4b]/10 dark:border-white/10 rounded-[8px] px-3 py-2 text-xs text-[#1e1b4b] dark:text-white focus:outline-none"
                >
                  <option value="all">Todas las acciones</option>
                  <option value="user_register">Registros tradicionales</option>
                  <option value="user_register_oauth">Registros Google OAuth</option>
                  <option value="user_login">Inicios de sesión</option>
                  <option value="cv_create_manual">CV creados a mano</option>
                  <option value="cv_optimize_ai">CV optimizados con IA</option>
                  <option value="cv_delete">CV eliminados</option>
                  <option value="job_offer_create">Kanban candidatura creada</option>
                  <option value="job_offer_status_change">Kanban cambio de estado</option>
                  <option value="job_offer_update">Kanban candidatura editada</option>
                  <option value="job_offer_delete">Kanban candidatura borrada</option>
                  <option value="cv_download_pdf">Descargas de PDF</option>
                </select>

                {/* Filtro por Fecha */}
                <select
                  value={logDateFilter}
                  onChange={(e: any) => setLogDateFilter(e.target.value)}
                  className="bg-[#fafafa] dark:bg-[#0b0f19]/40 border border-[#1e1b4b]/10 dark:border-white/10 rounded-[8px] px-3 py-2 text-xs text-[#1e1b4b] dark:text-white focus:outline-none"
                >
                  <option value="all">Todo el historial</option>
                  <option value="today">Actividad de hoy</option>
                  <option value="7d">Últimos 7 días</option>
                  <option value="30d">Últimos 30 días</option>
                </select>
              </div>

              {/* Botón de Exportación */}
              <button
                onClick={handleExportLogs}
                className="bg-white dark:bg-[#1f2937] hover:bg-[#fafafa] dark:hover:bg-[#0b0f19]/30 border border-[#1e1b4b]/10 dark:border-white/10 hover:border-[#8b5cf6]/30 text-[#8b5cf6] dark:text-violet-400 font-bold px-4 py-2.5 rounded-[8px] text-xs transition-all shadow-sm flex items-center justify-center gap-1.5 font-display w-full md:w-auto"
              >
                <Download className="w-3.5 h-3.5 stroke-[1.75]" />
                <span>Exportar Logs (JSON)</span>
              </button>
            </div>

            {/* Listado de Logs de Auditoría */}
            <div className="bg-white dark:bg-[#1f2937] border border-[#1e1b4b]/10 dark:border-white/5 rounded-[12px] shadow-sm overflow-hidden">
              {filteredAuditLogs.length === 0 ? (
                <div className="p-12 text-center text-[#1e1b4b]/50 dark:text-slate-400 text-xs font-light font-sans">
                  No se encontraron registros de auditoría coincidentes con los filtros seleccionados.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-[#1e1b4b]/10 dark:divide-white/10 text-left text-xs font-sans font-light">
                    <thead className="bg-[#fafafa] dark:bg-[#0b0f19]/30 text-[10px] text-[#1e1b4b]/60 dark:text-slate-400 font-bold uppercase tracking-wider font-display">
                      <tr>
                        <th className="px-6 py-4">Fecha & Hora</th>
                        <th className="px-6 py-4">Usuario</th>
                        <th className="px-6 py-4">Acción</th>
                        <th className="px-6 py-4">Red & IP</th>
                        <th className="px-6 py-4">Navegador / SO</th>
                        <th className="px-6 py-4 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1e1b4b]/5 dark:divide-white/5 bg-white dark:bg-[#1f2937]/50">
                      {filteredAuditLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-[#fafafa] dark:hover:bg-[#0b0f19]/20 transition-colors">
                          <td className="px-6 py-4 text-[#1e1b4b]/70 dark:text-slate-300 whitespace-nowrap font-mono">
                            {new Date(log.createdAt).toLocaleString('es-ES')}
                          </td>
                          <td className="px-6 py-4 font-semibold text-[#1e1b4b] dark:text-slate-200 whitespace-nowrap font-display">
                            {log.userEmail || 'Desconocido'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2.5 py-0.5 rounded-[8px] text-[10px] font-bold font-mono border ${
                              log.action === 'user_register' || log.action === 'user_register_oauth'
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                : log.action === 'user_login'
                                ? 'bg-[#8b5cf6]/10 text-[#8b5cf6] dark:text-violet-400 border-[#8b5cf6]/20'
                                : log.action === 'cv_optimize_ai'
                                ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20'
                                : log.action === 'cv_download_pdf'
                                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-500 border-amber-500/20'
                                : log.action === 'cv_delete' || log.action === 'job_offer_delete'
                                ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                                : 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20'
                            }`}>
                              {log.action}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-[#1e1b4b]/70 dark:text-slate-300 whitespace-nowrap font-mono">
                            {log.ipAddress || 'Sin IP'}
                          </td>
                          <td className="px-6 py-4 text-[#1e1b4b]/60 dark:text-slate-400 truncate max-w-[200px]" title={log.userAgent}>
                            {log.userAgent || 'Sin cabecera'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <button
                              onClick={() => setSelectedLog(log)}
                              className="bg-white dark:bg-[#1f2937] hover:bg-[#fafafa] dark:hover:bg-[#0b0f19]/30 border border-[#1e1b4b]/10 dark:border-white/10 hover:border-[#8b5cf6]/30 dark:hover:border-[#8b5cf6]/40 text-[#8b5cf6] dark:text-violet-400 font-bold px-3 py-1.5 rounded-[8px] text-[10px] transition-all font-display shadow-sm flex items-center justify-center gap-1 ml-auto"
                            >
                              <Eye className="w-3 h-3 stroke-[1.75]" />
                              <span>Detalles</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* MODAL 1: User Details Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 bg-[#1e1b4b]/40 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-white dark:bg-[#1f2937] border border-[#1e1b4b]/10 dark:border-white/5 w-full max-w-3xl rounded-[12px] overflow-hidden shadow-xl relative text-[#1e1b4b] dark:text-[#f3f4f6]">
            <button
              onClick={() => setSelectedUser(null)}
              className="absolute top-5 right-5 text-[#1e1b4b]/40 dark:text-slate-455 hover:text-[#1e1b4b] dark:hover:text-white p-2 rounded-[8px] bg-[#fafafa] dark:bg-[#0b0f19]/45 border border-[#1e1b4b]/10 dark:border-white/10 hover:bg-[#fafafa]/80 transition-all z-10 shadow-sm"
            >
              <X className="w-4 h-4 stroke-[1.75]" />
            </button>

            {/* Profile banner */}
            <div className="bg-[#fafafa] dark:bg-[#0b0f19]/25 p-6 border-b border-[#1e1b4b]/10 dark:border-white/5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-2">
                <div>
                  <span className="text-[9px] font-bold text-[#1e1b4b]/40 dark:text-slate-500 uppercase tracking-widest block mb-0.5 font-display">FICHA DETALLADA DE CANDIDATO</span>
                  <h3 className="text-xl font-bold font-display text-[#1e1b4b] dark:text-white leading-tight">
                    {selectedUser.name || 'Sin nombre'}
                  </h3>
                  <p className="text-[#1e1b4b]/60 dark:text-slate-400 text-xs font-light font-sans">{selectedUser.email}</p>
                </div>

                {/* Sub status pill */}
                <div className="flex items-center gap-2">
                  {selectedUser.role === 'admin' ? (
                    <span className="bg-[#8b5cf6]/10 text-[#8b5cf6] dark:text-violet-400 border border-[#8b5cf6]/20 dark:border-violet-500/30 text-[10px] font-bold px-3 py-1 rounded-[8px] flex items-center gap-1 shadow-sm font-display">
                      <Shield className="w-3.5 h-3.5 stroke-[1.75]" /> Administrador
                    </span>
                  ) : (
                    <span className="bg-[#fafafa] dark:bg-[#0b0f19]/40 text-[#1e1b4b]/60 dark:text-slate-400 border border-[#1e1b4b]/10 dark:border-white/10 text-[10px] font-bold px-3 py-1 rounded-[8px] font-display">
                      Usuario Ordinario
                    </span>
                  )}

                  {selectedUser.subscriptionStatus === 'active' ? (
                    <span className="bg-[#2ecc71]/10 text-[#2ecc71] border border-[#2ecc71]/20 dark:border-[#2ecc71]/35 text-[10px] font-bold px-3 py-1 rounded-[8px] flex items-center gap-1 shadow-sm font-display">
                      <Crown className="w-3.5 h-3.5 text-[#2ecc71] stroke-[1.75]" /> Premium PRO
                    </span>
                  ) : (
                    <span className="bg-[#fafafa] dark:bg-[#0b0f19]/40 text-[#1e1b4b]/40 dark:text-slate-500 border border-[#1e1b4b]/10 dark:border-white/10 text-[10px] font-medium px-3 py-1 rounded-[8px] font-display">
                      Suscripción: Inactiva
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto scrollbar-custom">
              
              {/* Administrative Actions */}
              <div className="bg-[#fafafa] dark:bg-[#0b0f19]/35 p-5 rounded-[12px] border border-[#1e1b4b]/5 dark:border-white/5">
                <h4 className="text-xs font-bold text-[#1e1b4b] dark:text-white mb-3 flex items-center gap-1.5 font-display">
                  <UserCheck className="w-4 h-4 text-[#8b5cf6] dark:text-violet-400 stroke-[1.75]" />
                  Herramientas Administrativas de Soporte
                </h4>

                <div className="flex flex-wrap items-center gap-4">
                  {/* Role Toggle */}
                  <div className="space-y-1.5 font-sans">
                    <span className="text-[10px] font-bold text-[#1e1b4b]/40 dark:text-slate-500 uppercase tracking-wide block font-display">Rango de Seguridad</span>
                    <button
                      onClick={() => handleToggleUserRole(selectedUser.id, selectedUser.role)}
                      className={`px-4 py-2 rounded-[8px] text-xs font-bold transition-all border flex items-center gap-1.5 font-display shadow-sm ${
                        selectedUser.role === 'admin'
                          ? 'bg-[#8b5cf6]/10 dark:bg-[#8b5cf6]/20 border-[#8b5cf6]/20 dark:border-violet-500/30 text-[#8b5cf6] dark:text-violet-400'
                          : 'bg-white dark:bg-[#1f2937] border-[#1e1b4b]/10 dark:border-white/10 hover:bg-[#fafafa] dark:hover:bg-[#0b0f19]/35 text-[#1e1b4b] dark:text-slate-200'
                      }`}
                    >
                      <Shield className="w-3.5 h-3.5 stroke-[1.75]" />
                      <span>{selectedUser.role === 'admin' ? 'Quitar Admin' : 'Hacer Administrador'}</span>
                    </button>
                  </div>

                  {/* Subscription Toggle */}
                  <div className="space-y-1.5 font-sans">
                    <span className="text-[10px] font-bold text-[#1e1b4b]/40 dark:text-slate-500 uppercase tracking-wide block font-display">Suscripción Manual</span>
                    <div className="flex items-center gap-1 bg-white dark:bg-[#1f2937] p-1 border border-[#1e1b4b]/10 dark:border-white/10 rounded-[8px]">
                      <button
                        onClick={() => handleUpdateSubscription(selectedUser.id, 'active')}
                        className={`px-3 py-1.5 rounded-[8px] text-xs font-bold transition-colors ${
                          selectedUser.subscriptionStatus === 'active'
                            ? 'bg-[#2ecc71] text-white'
                            : 'text-[#1e1b4b]/60 dark:text-slate-400 hover:text-[#1e1b4b] dark:hover:text-white'
                        }`}
                      >
                        Activar PRO
                      </button>
                      <button
                        onClick={() => handleUpdateSubscription(selectedUser.id, 'none')}
                        className={`px-3 py-1.5 rounded-[8px] text-xs font-bold transition-colors ${
                          selectedUser.subscriptionStatus !== 'active'
                            ? 'bg-[#fafafa] dark:bg-[#0b0f19] text-[#1e1b4b]/80 dark:text-slate-200'
                            : 'text-[#1e1b4b]/40 dark:text-slate-500 hover:text-[#1e1b4b] dark:hover:text-white'
                        }`}
                      >
                        Desactivar
                      </button>
                    </div>
                  </div>
                </div>

<div className="mt-3 text-[10px] text-[#1e1b4b]/50 dark:text-slate-500 flex items-start gap-1 font-light leading-relaxed font-sans">
                  <AlertTriangle className="w-3 h-3 text-[#1e1b4b]/40 dark:text-slate-500 shrink-0 mt-0.5 stroke-[1.75]" />
                  <span>
                    El cambio de suscripción manual sobreescribe directamente en la base de datos sin afectar a los cobros activos en Stripe. Ideal para cuentas de pruebas o soporte temporal.
                  </span>
                </div>
              </div>

              {/* Dynamic user stats details */}
              {loadingDetails ? (
                <div className="text-center py-12 text-[#1e1b4b]/60 dark:text-slate-400 text-xs font-light flex items-center justify-center gap-2 font-sans">
                  <RefreshCw className="w-4 h-4 animate-spin text-[#8b5cf6] dark:text-violet-400 stroke-[1.75]" />
                  <span>Cargando currículums y candidaturas en la base de datos...</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* CVs card list */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-[#1e1b4b] dark:text-white flex items-center gap-1.5 border-b border-[#1e1b4b]/5 dark:border-white/5 pb-2 font-display">
                      <FileText className="w-4 h-4 text-[#8b5cf6] dark:text-violet-400 stroke-[1.75]" />
                      Currículums ({userDetails?.cvs.length || 0})
                    </h4>

                    {userDetails?.cvs.length === 0 ? (
                      <div className="text-[#1e1b4b]/50 dark:text-slate-500 text-[11px] font-light bg-[#fafafa] dark:bg-[#0b0f19]/40 p-4 rounded-[12px] border border-[#1e1b4b]/5 dark:border-white/5 text-center font-sans">
                        Este usuario no ha creado ningún CV todavía.
                      </div>
                    ) : (
                      <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1 scrollbar-custom font-sans">
                        {userDetails?.cvs.map((cv: any) => (
                          <div key={cv.id} className="p-3 bg-[#fafafa] dark:bg-[#0b0f19]/40 rounded-[8px] border border-[#1e1b4b]/10 dark:border-white/10 flex items-center justify-between text-xs">
                            <div>
                              <span className="font-semibold text-[#1e1b4b] dark:text-slate-200 block truncate max-w-[200px] font-display">{cv.title}</span>
                              <span className="text-[10px] text-[#1e1b4b]/50 dark:text-slate-500 font-light block mt-0.5">
                                Template: <span className="capitalize">{cv.templateName}</span> • Margen: {cv.pageMargin}
                              </span>
                            </div>
                            <span className="text-[9px] bg-white dark:bg-[#1f2937] text-[#1e1b4b]/60 dark:text-slate-400 border border-[#1e1b4b]/10 dark:border-white/10 px-2 py-0.5 rounded font-display shadow-sm">
                              {cv.isBase ? 'CV Base' : 'Copia'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Kanban Offers list */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-[#1e1b4b] dark:text-white flex items-center gap-1.5 border-b border-[#1e1b4b]/5 dark:border-white/5 pb-2 font-display">
                      <Kanban className="w-4 h-4 text-[#8b5cf6] dark:text-violet-400 stroke-[1.75]" />
                      Postulaciones Kanban ({userDetails?.offers.length || 0})
                    </h4>

                    {userDetails?.offers.length === 0 ? (
                      <div className="text-[#1e1b4b]/50 dark:text-slate-500 text-[11px] font-light bg-[#fafafa] dark:bg-[#0b0f19]/40 p-4 rounded-[12px] border border-[#1e1b4b]/5 dark:border-white/5 text-center font-sans">
                        El usuario no ha enlazado ofertas en su tablero.
                      </div>
                    ) : (
                      <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1 scrollbar-custom font-sans">
                        {userDetails?.offers.map((offer: any) => (
                          <div key={offer.id} className="p-3 bg-[#fafafa] dark:bg-[#0b0f19]/40 rounded-[8px] border border-[#1e1b4b]/10 dark:border-white/10 flex items-center justify-between text-xs">
                            <div>
                              <span className="font-semibold text-[#1e1b4b] dark:text-slate-200 block truncate max-w-[180px] font-display">{offer.title}</span>
                              <span className="text-[10px] text-[#1e1b4b]/50 dark:text-slate-500 font-light block mt-0.5">
                                {offer.company} • Vía: <span className="capitalize">{offer.platform}</span>
                              </span>
                            </div>
                            
                            {/* status badges */}
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded capitalize font-display shadow-sm ${
                              offer.status === 'offer' ? 'bg-[#2ecc71]/10 text-[#2ecc71]' :
                              offer.status === 'interview' ? 'bg-amber-500/10 text-amber-600' :
                              offer.status === 'rejected' ? 'bg-rose-500/10 text-rose-600' :
                              'bg-white dark:bg-[#1f2937] text-[#1e1b4b]/60 dark:text-slate-400 border border-[#1e1b4b]/10 dark:border-white/10'
                            }`}>
                              {offer.status === 'interested' ? 'Interesado' :
                               offer.status === 'applied' ? 'Postulado' :
                               offer.status === 'interview' ? 'Entrevista' :
                               offer.status === 'offer' ? (
                                 <span className="flex items-center gap-1">
                                   Oferta <PartyPopper className="w-3 h-3 text-[#2ecc71] stroke-[1.75]" />
                                 </span>
                               ) :
                               offer.status === 'rejected' ? 'Rechazado' : offer.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-white dark:bg-[#1f2937]/85 border-t border-[#1e1b4b]/10 dark:border-white/5 flex justify-end font-display">
              <button
                onClick={() => setSelectedUser(null)}
                className="bg-white dark:bg-[#1f2937] hover:bg-[#fafafa] dark:hover:bg-[#0b0f19]/30 text-[#1e1b4b]/60 dark:text-slate-400 hover:text-[#1e1b4b] dark:hover:text-white font-bold px-5 py-2 rounded-[8px] text-xs border border-[#1e1b4b]/10 dark:border-white/10 transition-colors shadow-sm"
              >
                Cerrar Ficha
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Add/Edit Prompt Modal */}
      {isPromptModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#1e1b4b]/40 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-white dark:bg-[#1f2937] border border-[#1e1b4b]/10 dark:border-white/5 w-full max-w-2xl rounded-[12px] overflow-hidden shadow-xl relative text-[#1e1b4b] dark:text-[#f3f4f6]">
            <button
              onClick={() => setIsPromptModalOpen(false)}
              className="absolute top-5 right-5 text-[#1e1b4b]/40 dark:text-slate-455 hover:text-[#1e1b4b] dark:hover:text-white p-2 rounded-[8px] bg-[#fafafa] dark:bg-[#0b0f19]/45 border border-[#1e1b4b]/10 dark:border-white/10 hover:bg-[#fafafa]/80 transition-all z-10 shadow-sm"
            >
              <X className="w-4 h-4 stroke-[1.75]" />
            </button>

            <form onSubmit={handlePromptFormSubmit}>
              <div className="bg-[#fafafa] dark:bg-[#0b0f19]/25 p-6 border-b border-[#1e1b4b]/10 dark:border-white/5">
                <div className="mt-2">
                  <span className="text-[9px] font-bold text-[#1e1b4b]/40 dark:text-slate-500 uppercase tracking-widest block mb-0.5 font-display">EDITOR DE PROMPTS DINÁMICOS</span>
                  <h3 className="text-lg font-bold text-[#1e1b4b] dark:text-white font-display">
                    {promptForm.id ? 'Editar Prompt Existente' : 'Crear Nuevo Prompt de Optimización'}
                  </h3>
                  <p className="text-[#1e1b4b]/60 dark:text-slate-400 text-xs font-light font-sans">Asocia directrices directas al motor de inteligencia artificial.</p>
                </div>
              </div>

              <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto text-xs font-light scrollbar-custom">
                
                {/* Name */}
                <div className="space-y-1.5 font-sans">
                  <label className="text-[10px] font-bold text-[#1e1b4b]/60 dark:text-slate-400 uppercase tracking-wider block font-display">Nombre Descriptivo</label>
                  <input
                    type="text"
                    value={promptForm.name}
                    onChange={(e) => setPromptForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g. Asesor Harvard Avanzado con STAR"
                    className="bg-white dark:bg-[#1f2937] border border-[#1e1b4b]/10 dark:border-white/10 rounded-[8px] px-3.5 py-2.5 text-xs text-[#1e1b4b] dark:text-white placeholder-[#1e1b4b]/30 dark:placeholder-slate-500 focus:outline-none focus:border-[#8b5cf6] dark:focus:border-[#8b5cf6] transition-colors w-full font-sans"
                    required
                  />
                </div>

                {/* Description */}
                <div className="space-y-1.5 font-sans">
                  <label className="text-[10px] font-bold text-[#1e1b4b]/60 dark:text-slate-400 uppercase tracking-wider block font-display">Descripción para el Usuario</label>
                  <textarea
                    value={promptForm.description}
                    onChange={(e) => setPromptForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="e.g. Foco absoluto en superar el filtro ATS. Adapta tu CV e inyecta cualquier tecnología o requisito crítico exigido por la oferta..."
                    className="bg-white dark:bg-[#1f2937] border border-[#1e1b4b]/10 dark:border-white/10 rounded-[8px] px-3.5 py-2.5 text-xs text-[#1e1b4b] dark:text-white placeholder-[#1e1b4b]/30 dark:placeholder-slate-500 focus:outline-none focus:border-[#8b5cf6] dark:focus:border-[#8b5cf6] transition-colors h-20 w-full resize-none font-sans leading-relaxed"
                    maxLength={300}
                  />
                  <span className="text-[9px] text-[#1e1b4b]/50 dark:text-slate-500 font-light block mt-0.5 leading-normal">
                    * Esta descripción se le mostrará directamente al usuario final en la ventana de selección de optimización por IA. Si se deja vacía, se utilizará una descripción genérica estándar. Máximo 300 caracteres.
                  </span>
                </div>

                {/* Key (Associated Function) */}
                <div className="space-y-1.5 font-sans">
                  <label className="text-[10px] font-bold text-[#1e1b4b]/60 dark:text-slate-400 uppercase tracking-wider block font-display">Función Asociada (Key)</label>
                  <select
                    value={promptForm.key}
                    onChange={(e) => setPromptForm(prev => ({ ...prev, key: e.target.value }))}
                    className="bg-white dark:bg-[#1f2937] border border-[#1e1b4b]/10 dark:border-white/10 rounded-[8px] px-3.5 py-2.5 text-xs text-[#1e1b4b] dark:text-white focus:outline-none focus:border-[#8b5cf6] dark:focus:border-[#8b5cf6] transition-colors w-full font-sans"
                  >
                    <option value="optimize_cv" className="dark:bg-[#1f2937]">optimize_cv (Optimizar CV para Ofertas de Empleo)</option>
                  </select>
                  <span className="text-[10px] text-[#1e1b4b]/50 dark:text-slate-500 font-light block mt-0.5">
                    * Actualmente, solo existe la función de optimización de CV. En un futuro, si agregas nuevas características, podrás ligar sus prompts con claves únicas desde aquí.
                  </span>
                </div>

                {/* Strict Mode Checkbox */}
                <div className="flex items-center gap-3 bg-[#8b5cf6]/5 dark:bg-[#8b5cf6]/10 border border-[#8b5cf6]/10 dark:border-violet-500/20 p-3.5 rounded-[12px] mb-4">
                  <input
                    type="checkbox"
                    id="isStrict"
                    checked={promptForm.isStrict}
                    onChange={(e) => setPromptForm(prev => ({ ...prev, isStrict: e.target.checked }))}
                    className="rounded bg-white dark:bg-[#0b0f19] border-[#1e1b4b]/15 dark:border-white/20 text-[#8b5cf6] focus:ring-[#8b5cf6]/20 w-4 h-4 cursor-pointer accent-[#8b5cf6]"
                  />
                  <div className="flex flex-col">
                    <label htmlFor="isStrict" className="text-xs font-bold text-[#8b5cf6] dark:text-violet-400 cursor-pointer select-none flex items-center gap-1.5 font-display">
                      <Sparkles className="w-3.5 h-3.5 text-[#8b5cf6] dark:text-violet-400 stroke-[1.75] animate-pulse" />
                      Regla superestricta de formato Markdown (.MD)
                    </label>
                    <span className="text-[10px] text-[#1e1b4b]/60 dark:text-slate-400 font-light mt-0.5 font-sans">
                      Fuerza al modelo de IA a omitir explicaciones adicionales y bloques de código, devolviendo únicamente Markdown estructurado.
                    </span>
                  </div>
                </div>

                {/* System Prompt */}
                <div className="space-y-1.5 font-sans">
                  <label className="text-[10px] font-bold text-[#1e1b4b]/60 dark:text-slate-400 uppercase tracking-wider block font-display">System Prompt (Directrices)</label>
                  <textarea
                    value={promptForm.systemPrompt}
                    onChange={(e) => setPromptForm(prev => ({ ...prev, systemPrompt: e.target.value }))}
                    placeholder="Eres un redactor experto en CVs estilo Harvard. Analiza la oferta e integra palabras clave..."
                    className="bg-white dark:bg-[#1f2937] border border-[#1e1b4b]/10 dark:border-white/10 rounded-[12px] px-3.5 py-2.5 text-xs text-[#1e1b4b] dark:text-white placeholder-[#1e1b4b]/30 dark:placeholder-slate-500 focus:outline-none focus:border-[#8b5cf6] dark:focus:border-[#8b5cf6] transition-colors h-28 font-mono leading-relaxed w-full resize-none"
                    required
                  />
                </div>

                {/* User Prompt */}
                <div className="space-y-1.5 font-sans">
                  <label className="text-[10px] font-bold text-[#1e1b4b]/60 dark:text-slate-400 uppercase tracking-wider block font-display">User Prompt Template (Plantilla de Datos)</label>
                  <textarea
                    value={promptForm.userPrompt}
                    onChange={(e) => setPromptForm(prev => ({ ...prev, userPrompt: e.target.value }))}
                    placeholder="CV Base:\n{{cv}}\n\nOferta:\n{{job}}"
                    className="bg-white dark:bg-[#1f2937] border border-[#1e1b4b]/10 dark:border-white/10 rounded-[12px] px-3.5 py-2.5 text-xs text-[#1e1b4b] dark:text-white placeholder-[#1e1b4b]/30 dark:placeholder-slate-500 focus:outline-none focus:border-[#8b5cf6] dark:focus:border-[#8b5cf6] transition-colors h-24 font-mono leading-relaxed w-full resize-none"
                    required
                  />
                  <span className="text-[10px] text-[#1e1b4b]/50 dark:text-slate-500 font-light block mt-0.5">
                    * Utiliza obligatoriamente los marcadores <code className="text-[#8b5cf6] dark:text-violet-400 font-mono font-bold">{"{{cv}}"}</code> y <code className="text-[#8b5cf6] dark:text-violet-400 font-mono font-bold">{"{{job}}"}</code> para indicarle al servicio dónde inyectar los datos reales del usuario.
                  </span>
                </div>

                {/* Is Active & Is Archived */}
                <div className="flex flex-col gap-3 pt-2 font-sans">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isActive"
                      checked={promptForm.isActive}
                      onChange={(e) => setPromptForm(prev => ({ ...prev, isActive: e.target.checked, isArchived: e.target.checked ? false : prev.isArchived }))}
                      className="rounded bg-white dark:bg-[#0b0f19] border-[#1e1b4b]/15 dark:border-white/20 text-[#8b5cf6] focus:ring-[#8b5cf6]/20 w-4 h-4 cursor-pointer accent-[#8b5cf6]"
                    />
                    <label htmlFor="isActive" className="text-xs font-semibold text-[#1e1b4b]/80 dark:text-slate-200 cursor-pointer select-none">
                      Activar inmediatamente (esto desactivará cualquier otro prompt para la función &quot;{promptForm.key}&quot;)
                    </label>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isArchived"
                      checked={promptForm.isArchived}
                      disabled={promptForm.isActive}
                      onChange={(e) => setPromptForm(prev => ({ ...prev, isArchived: e.target.checked }))}
                      className="rounded bg-white dark:bg-[#0b0f19] border-[#1e1b4b]/15 dark:border-white/20 text-[#8b5cf6] focus:ring-[#8b5cf6]/20 w-4 h-4 cursor-pointer disabled:opacity-50 accent-[#8b5cf6]"
                    />
                    <label htmlFor="isArchived" className="text-xs font-semibold text-[#1e1b4b]/80 dark:text-slate-200 cursor-pointer select-none">
                      Archivar prompt (no se mostrará a los usuarios durante la optimización)
                    </label>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 bg-white dark:bg-[#1f2937]/85 border-t border-[#1e1b4b]/10 dark:border-white/5 flex justify-end gap-3 font-display">
                <button
                  type="button"
                  onClick={() => setIsPromptModalOpen(false)}
                  className="bg-white dark:bg-[#1f2937] hover:bg-[#fafafa] dark:hover:bg-[#0b0f19]/30 text-[#1e1b4b]/60 dark:text-slate-400 hover:text-[#1e1b4b] dark:hover:text-white font-bold px-4 py-2 rounded-[8px] text-xs border border-[#1e1b4b]/10 dark:border-white/10 transition-colors shadow-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-[#1e1b4b] dark:bg-white hover:bg-[#1e1b4b]/90 dark:hover:bg-slate-100 border border-[#1e1b4b] dark:border-white text-white dark:text-[#0b0f19] font-bold px-5 py-2 rounded-[8px] text-xs transition-all shadow-sm flex items-center gap-1.5 font-display"
                >
                  <Check className="w-4 h-4 stroke-[1.75]" />
                  <span>Guardar Cambios</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Audit Log Details Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn font-sans">
          <div className="bg-white dark:bg-[#1f2937] border border-[#1e1b4b]/15 dark:border-white/10 rounded-[16px] w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="px-6 py-5 bg-[#fafafa] dark:bg-[#131a2e] border-b border-[#1e1b4b]/10 dark:border-white/5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-[#8b5cf6]/10 text-[#8b5cf6] dark:text-violet-400 rounded-lg">
                  <Terminal className="w-4 h-4 stroke-[1.75]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#1e1b4b] dark:text-white font-display">Detalles del Evento</h3>
                  <p className="text-[10px] text-[#1e1b4b]/50 dark:text-slate-400 font-light mt-0.5">ID: {selectedLog.id}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-[#1e1b4b]/40 dark:text-slate-400 hover:text-[#1e1b4b] dark:hover:text-white hover:bg-[#1e1b4b]/5 dark:hover:bg-white/5 p-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4 stroke-[1.75]" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs font-sans text-[#1e1b4b] dark:text-[#f3f4f6]">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3.5 bg-[#fafafa] dark:bg-[#0b0f19]/40 rounded-xl border border-[#1e1b4b]/5 dark:border-white/5">
                  <span className="text-[9px] font-bold text-[#1e1b4b]/45 dark:text-slate-500 uppercase tracking-wider block mb-1">ACCIÓN REGISTRADA</span>
                  <span className="text-[#8b5cf6] dark:text-violet-400 font-bold font-mono text-[11px] bg-[#8b5cf6]/10 dark:bg-violet-950/40 px-2 py-0.5 rounded-md border border-[#8b5cf6]/10 w-fit block">{selectedLog.action}</span>
                </div>
                <div className="p-3.5 bg-[#fafafa] dark:bg-[#0b0f19]/40 rounded-xl border border-[#1e1b4b]/5 dark:border-white/5">
                  <span className="text-[9px] font-bold text-[#1e1b4b]/45 dark:text-slate-500 uppercase tracking-wider block mb-1">FECHA & HORA</span>
                  <span className="text-[#1e1b4b] dark:text-slate-200 font-semibold">{new Date(selectedLog.createdAt).toLocaleString('es-ES')}</span>
                </div>
                <div className="p-3.5 bg-[#fafafa] dark:bg-[#0b0f19]/40 rounded-xl border border-[#1e1b4b]/5 dark:border-white/5 col-span-2">
                  <span className="text-[9px] font-bold text-[#1e1b4b]/45 dark:text-slate-500 uppercase tracking-wider block mb-1">USUARIO ASOCIADO</span>
                  <span className="text-[#1e1b4b] dark:text-slate-200 font-semibold block">{selectedLog.userEmail || 'Desconocido / No Registrado'}</span>
                  {selectedLog.userId && (
                    <span className="text-[10px] text-[#1e1b4b]/40 dark:text-slate-500 block mt-0.5 font-mono">ID: {selectedLog.userId}</span>
                  )}
                </div>
                <div className="p-3.5 bg-[#fafafa] dark:bg-[#0b0f19]/40 rounded-xl border border-[#1e1b4b]/5 dark:border-white/5">
                  <span className="text-[9px] font-bold text-[#1e1b4b]/45 dark:text-slate-500 uppercase tracking-wider block mb-1">DIRECCIÓN IP</span>
                  <span className="text-[#1e1b4b] dark:text-slate-200 font-mono font-semibold">{selectedLog.ipAddress || 'No capturada'}</span>
                </div>
                <div className="p-3.5 bg-[#fafafa] dark:bg-[#0b0f19]/40 rounded-xl border border-[#1e1b4b]/5 dark:border-white/5">
                  <span className="text-[9px] font-bold text-[#1e1b4b]/45 dark:text-slate-500 uppercase tracking-wider block mb-1">DISPOSITIVO (USER AGENT)</span>
                  <span className="text-[#1e1b4b] dark:text-slate-200 block truncate font-sans" title={selectedLog.userAgent}>{selectedLog.userAgent || 'No capturado'}</span>
                </div>
              </div>

              {/* JSON Payload Details */}
              <div className="space-y-1.5 font-sans">
                <span className="text-[9px] font-bold text-[#1e1b4b]/45 dark:text-slate-500 uppercase tracking-wider block font-display">PAYLOAD / DETALLES DE LA ACCIÓN</span>
                <div className="bg-[#fafafa] dark:bg-[#0b0f19]/40 border border-[#1e1b4b]/10 dark:border-white/10 rounded-[12px] p-4 font-mono text-[11px] leading-relaxed overflow-x-auto text-[#1e1b4b] dark:text-emerald-300 max-h-52">
                  <pre>{JSON.stringify(JSON.parse(selectedLog.details || '{}'), null, 2)}</pre>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-[#fafafa] dark:bg-[#131a2e] border-t border-[#1e1b4b]/10 dark:border-white/5 flex justify-end font-display">
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="bg-[#1e1b4b] dark:bg-white hover:bg-[#1e1b4b]/90 dark:hover:bg-slate-100 border border-[#1e1b4b] dark:border-white text-white dark:text-[#0b0f19] font-bold px-5 py-2.5 rounded-[8px] text-xs transition-all shadow-sm"
              >
                Cerrar Detalles
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmModal && (
        <AlertModal
          isOpen={confirmModal.isOpen}
          onClose={() => setConfirmModal(null)}
          title={confirmModal.title}
          message={confirmModal.message}
          type={confirmModal.type}
          confirmLabel={confirmModal.confirmLabel}
          onConfirm={confirmModal.onConfirm}
        />
      )}
    </div>
  );
}
