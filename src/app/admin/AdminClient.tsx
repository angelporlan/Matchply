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
  AlertTriangle
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
  togglePromptArchive
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
}

export default function AdminClient({
  initialStats,
  initialUsers,
  initialSettings,
  initialPrompts,
}: AdminClientProps) {
  // Navigation / Tabs state
  const [activeTab, setActiveTab] = useState<'stats' | 'users' | 'ai' | 'prompts'>('stats');

  // Hydrated state
  const [stats, setStats] = useState(initialStats);
  const [usersList, setUsersList] = useState(initialUsers);
  const [dbSettings, setDbSettings] = useState(initialSettings);
  const [promptsList, setPromptsList] = useState(initialPrompts);

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
    systemPrompt: string;
    userPrompt: string;
    isActive: boolean;
    isArchived: boolean;
    isStrict: boolean;
  }>({
    name: '',
    key: 'optimize_cv',
    systemPrompt: '',
    userPrompt: '',
    isActive: false,
    isArchived: false,
    isStrict: false,
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
    if (sRes.success) {
      setStats(sRes.stats!);
      setUsersList(sRes.users || []);
    }
    if (aRes.success) {
      setDbSettings(aRes.settings || []);
      setPromptsList(aRes.prompts || []);
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
      title: 'Cambiar Rol de Usuario 🔑',
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
      title: 'Eliminar Prompt 🗑️',
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
    <div className="min-h-screen bg-[#030712] relative text-white">
      {/* Glow effects background */}
      <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-sky-950/20 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[5%] left-[-15%] w-[45%] h-[45%] rounded-full bg-purple-950/15 blur-[120px] pointer-events-none" />

      {/* Main Nav */}
      <nav className="glass-nav sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="bg-gradient-to-tr from-sky-400 to-indigo-500 p-2 rounded-xl text-white shadow-md">
                <Sparkles className="w-5 h-5" />
              </div>
              <span className="font-display font-bold text-lg tracking-tight text-white">
                NextProf <span className="text-sky-400">AI</span>
              </span>
            </Link>
            <div className="h-5 w-[1px] bg-slate-800 mx-2" />
            <span className="bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[10px] uppercase font-bold tracking-widest px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm shadow-purple-500/5">
              <Shield className="w-3 h-3" /> Panel Admin
            </span>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={refreshData}
              className="text-slate-400 hover:text-white p-2 rounded-xl bg-slate-900/50 hover:bg-slate-900 border border-slate-800 transition-all flex items-center gap-1.5 text-xs font-medium"
              title="Refrescar Datos"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Sincronizar</span>
            </button>
            <Link
              href="/dashboard"
              className="text-slate-300 hover:text-white flex items-center gap-1.5 text-xs font-semibold bg-slate-900 border border-slate-800 px-3.5 py-2 rounded-xl transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Volver a App</span>
            </Link>
          </div>
        </div>
      </nav>

      {/* Toast Notification */}
      {notification && (
        <div className={`fixed bottom-5 right-5 z-50 px-5 py-3.5 rounded-2xl flex items-center gap-3 border shadow-2xl transition-all transform animate-bounce ${
          notification.type === 'success'
            ? 'bg-slate-950 border-emerald-500/30 text-emerald-400 shadow-emerald-950/20'
            : 'bg-slate-950 border-rose-500/30 text-rose-400 shadow-rose-950/20'
        }`}>
          <div className={`p-1 rounded-full ${notification.type === 'success' ? 'bg-emerald-500/10' : 'bg-rose-500/10'}`}>
            <Check className="w-4 h-4" />
          </div>
          <span className="text-xs font-medium">{notification.message}</span>
        </div>
      )}

      {/* Main content grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        
        {/* Upper Tabs Navigation */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 mb-8 bg-slate-950/40 backdrop-blur-xl border border-slate-800/80 p-2 rounded-2xl">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 w-full md:w-auto">
            <button
              onClick={() => setActiveTab('stats')}
              className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'stats'
                  ? 'bg-gradient-to-r from-sky-500 to-indigo-600 text-white shadow-lg shadow-sky-500/10'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>Resumen</span>
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'users'
                  ? 'bg-gradient-to-r from-sky-500 to-indigo-600 text-white shadow-lg shadow-sky-500/10'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Usuarios ({usersList.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('ai')}
              className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'ai'
                  ? 'bg-gradient-to-r from-sky-500 to-indigo-600 text-white shadow-lg shadow-sky-500/10'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Modelos IA</span>
            </button>
            <button
              onClick={() => setActiveTab('prompts')}
              className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'prompts'
                  ? 'bg-gradient-to-r from-sky-500 to-indigo-600 text-white shadow-lg shadow-sky-500/10'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
              }`}
            >
              <Code className="w-4 h-4" />
              <span>Gestión Prompts</span>
            </button>
          </div>
          
          <div className="text-slate-500 text-[11px] px-3 font-light text-center md:text-right">
            Sincronización en tiempo real activa • PostgreSQL
          </div>
        </div>

        {/* Tab content areas */}
        {activeTab === 'stats' && (
          <div className="space-y-8 animate-fadeIn">
            {/* Stat Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="glass-card p-6 rounded-2xl border border-slate-800 flex items-center justify-between group hover:border-sky-500/30 transition-all duration-300">
                <div>
                  <span className="text-slate-400 text-xs font-medium">Usuarios Registrados</span>
                  <h3 className="text-3xl font-black text-white mt-1.5 tracking-tight group-hover:text-sky-400 transition-colors">
                    {stats.totalUsers}
                  </h3>
                </div>
                <div className="p-3.5 bg-sky-500/10 text-sky-400 rounded-xl border border-sky-500/10 group-hover:bg-sky-500/20 transition-all duration-300 shadow-md shadow-sky-500/5">
                  <Users className="w-5 h-5" />
                </div>
              </div>

              <div className="glass-card p-6 rounded-2xl border border-slate-800 flex items-center justify-between group hover:border-amber-500/30 transition-all duration-300">
                <div>
                  <span className="text-slate-400 text-xs font-medium">Suscripciones PRO</span>
                  <h3 className="text-3xl font-black text-amber-400 mt-1.5 tracking-tight">
                    {stats.activeSubscriptions}
                  </h3>
                </div>
                <div className="p-3.5 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/10 group-hover:bg-amber-500/20 transition-all duration-300 shadow-md shadow-amber-500/5">
                  <Crown className="w-5 h-5" />
                </div>
              </div>

              <div className="glass-card p-6 rounded-2xl border border-slate-800 flex items-center justify-between group hover:border-indigo-500/30 transition-all duration-300">
                <div>
                  <span className="text-slate-400 text-xs font-medium">Currículums Creados</span>
                  <h3 className="text-3xl font-black text-white mt-1.5 tracking-tight group-hover:text-indigo-400 transition-colors">
                    {stats.totalCvs}
                  </h3>
                </div>
                <div className="p-3.5 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/10 group-hover:bg-indigo-500/20 transition-all duration-300 shadow-md shadow-indigo-500/5">
                  <FileText className="w-5 h-5" />
                </div>
              </div>

              <div className="glass-card p-6 rounded-2xl border border-slate-800 flex items-center justify-between group hover:border-purple-500/30 transition-all duration-300">
                <div>
                  <span className="text-slate-400 text-xs font-medium">Candidaturas Kanban</span>
                  <h3 className="text-3xl font-black text-white mt-1.5 tracking-tight group-hover:text-purple-400 transition-colors">
                    {stats.totalOffers}
                  </h3>
                </div>
                <div className="p-3.5 bg-purple-500/10 text-purple-400 rounded-xl border border-purple-500/10 group-hover:bg-purple-500/20 transition-all duration-300 shadow-md shadow-purple-500/5">
                  <Kanban className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* Quick overview layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="glass-card p-6 rounded-3xl border border-slate-800 lg:col-span-2">
                <h3 className="text-base font-bold text-white mb-1">Información General del Sistema</h3>
                <p className="text-slate-400 text-xs font-light mb-6">Estado global del entorno y base de datos relacional.</p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-light">
                  <div className="p-4 bg-slate-950/60 border border-slate-850 rounded-2xl">
                    <span className="text-slate-500 font-bold block mb-1">PROVEEDOR PLAN GRATIS</span>
                    <span className="text-slate-200 font-semibold uppercase">{freeProvider}</span>
                    <span className="text-slate-400 block mt-0.5">Modelo: {freeModel}</span>
                  </div>

                  <div className="p-4 bg-slate-950/60 border border-slate-850 rounded-2xl">
                    <span className="text-slate-500 font-bold block mb-1">PROVEEDOR PLAN PRO</span>
                    <span className="text-slate-200 font-semibold uppercase text-amber-400">{proProvider}</span>
                    <span className="text-slate-400 block mt-0.5">Modelo: {proModel}</span>
                  </div>

                  <div className="p-4 bg-slate-950/60 border border-slate-850 rounded-2xl">
                    <span className="text-slate-500 font-bold block mb-1">PROMPTS INSTALADOS</span>
                    <span className="text-slate-200 font-semibold">{promptsList.length} Prompts guardados</span>
                    <span className="text-emerald-400 block mt-0.5 font-medium">
                      {promptsList.filter(p => p.isActive).length} Activos actualmente
                    </span>
                  </div>

                  <div className="p-4 bg-slate-950/60 border border-slate-850 rounded-2xl">
                    <span className="text-slate-500 font-bold block mb-1">TASA DE CONVERSIÓN PRO</span>
                    <span className="text-slate-200 font-semibold">
                      {stats.totalUsers > 0 
                        ? `${((stats.activeSubscriptions / stats.totalUsers) * 100).toFixed(1)}%` 
                        : '0%'
                      } de usuarios totales
                    </span>
                    <span className="text-slate-400 block mt-0.5">Ingresos recurrentes activos</span>
                  </div>
                </div>

                <div className="mt-6 p-4 rounded-2xl border border-slate-800 bg-slate-950/40 flex items-start gap-3">
                  <div className="p-2 bg-purple-500/10 text-purple-400 rounded-lg border border-purple-500/20 shrink-0">
                    <Shield className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white mb-0.5">Control de Suscripciones Manuales</h4>
                    <p className="text-[11px] text-slate-400 leading-relaxed font-light">
                      Como administrador, puedes ascender cuentas ordinarias a PRO o conceder privilegios directamente desde la pestaña de Usuarios para facilitar pruebas rápidas o dar soporte directo.
                    </p>
                  </div>
                </div>
              </div>

              {/* Quick AI status */}
              <div className="glass-card p-6 rounded-3xl border border-slate-800 flex flex-col justify-between">
                <div>
                  <h3 className="text-base font-bold text-white mb-1">Estado de los Motores IA</h3>
                  <p className="text-slate-400 text-xs font-light mb-6">Detalles de las APIs conectadas actualmente.</p>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-900 pb-3">
                      <div>
                        <span className="text-xs font-bold text-slate-300 block">OpenRouter</span>
                        <span className="text-[10px] text-slate-500">Plan Free & Backups</span>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">Activo</span>
                    </div>

                    <div className="flex items-center justify-between border-b border-slate-900 pb-3">
                      <div>
                        <span className="text-xs font-bold text-slate-300 block">DeepSeek API</span>
                        <span className="text-[10px] text-slate-500">Plan Pro Principal</span>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold">Suscrito</span>
                    </div>

                    <div className="flex items-center justify-between pb-1">
                      <div>
                        <span className="text-xs font-bold text-slate-300 block">Gemini API</span>
                        <span className="text-[10px] text-slate-500">Pro & Multimodal</span>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 font-bold">Configurado</span>
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-4 border-t border-slate-900">
                  <button
                    onClick={() => setActiveTab('ai')}
                    className="w-full bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-200 hover:text-white font-bold py-2.5 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5"
                  >
                    <span>Configurar Modelos</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab: Users Management */}
        {activeTab === 'users' && (
          <div className="glass-card p-6 rounded-3xl border border-slate-800 animate-fadeIn">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-base font-bold text-white">Listado Completo de Usuarios</h3>
                <p className="text-slate-400 text-xs font-light">Explora y gestiona los roles y el estado de suscripción de los candidatos.</p>
              </div>

              {/* Search Bar */}
              <div className="relative w-full md:w-72">
                <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-600" />
                <input
                  type="text"
                  placeholder="Buscar por nombre o correo..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-slate-950 border border-slate-850 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 transition-all w-full"
                />
              </div>
            </div>

            {filteredUsers.length === 0 ? (
              <div className="border border-slate-900 border-dashed rounded-2xl p-12 text-center text-slate-500 text-xs font-light">
                No se encontraron usuarios que coincidan con la búsqueda.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-850">
                <table className="min-w-full divide-y divide-slate-850 text-left text-xs font-light">
                  <thead className="bg-slate-950/60 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-4">Usuario</th>
                      <th className="px-6 py-4">Correo Electrónico</th>
                      <th className="px-6 py-4">Rol</th>
                      <th className="px-6 py-4">Suscripción</th>
                      <th className="px-6 py-4">Fecha Registro</th>
                      <th className="px-6 py-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900 bg-slate-950/10">
                    {filteredUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-slate-900/35 transition-colors group">
                        <td className="px-6 py-4 font-semibold text-white whitespace-nowrap">
                          {user.name || 'Sin nombre'}
                        </td>
                        <td className="px-6 py-4 text-slate-300 whitespace-nowrap">
                          {user.email}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {user.role === 'admin' ? (
                            <span className="bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 w-fit shadow-sm shadow-purple-500/5">
                              <Shield className="w-3 h-3" /> Admin
                            </span>
                          ) : (
                            <span className="bg-slate-900 text-slate-400 border border-slate-800 text-[10px] font-bold px-2 py-0.5 rounded-md w-fit">
                              Usuario
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {user.subscriptionStatus === 'active' ? (
                            <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-bold px-2.5 py-0.5 rounded-md flex items-center gap-1 w-fit shadow-md shadow-amber-500/5">
                              <Crown className="w-3 h-3 text-amber-400" /> Socio Pro
                            </span>
                          ) : (
                            <span className="bg-slate-900 text-slate-500 border border-slate-800/10 text-[10px] font-medium px-2 py-0.5 rounded-md w-fit">
                              Plan Free
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-slate-400 whitespace-nowrap">
                          {new Date(user.createdAt).toLocaleDateString('es-ES', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <button
                            onClick={() => handleViewUserDetails(user)}
                            className="bg-slate-900 hover:bg-slate-800 border border-slate-850 hover:border-slate-700 text-sky-400 hover:text-sky-300 font-bold px-3 py-1.5 rounded-lg text-[10px] transition-all group-hover:scale-[1.03]"
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
          <div className="max-w-2xl mx-auto glass-card p-6 rounded-3xl border border-slate-800 animate-fadeIn">
            <div className="border-b border-slate-900 pb-4 mb-6">
              <h3 className="text-base font-bold text-white">Configuración del Motor de Inteligencia Artificial</h3>
              <p className="text-slate-400 text-xs font-light mt-0.5">Asigna qué proveedor de API y qué modelo específico se utilizará en cada plan de usuario.</p>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-6">
              
              {/* Free Plan Settings */}
              <div className="bg-slate-950/40 p-5 rounded-2xl border border-slate-850">
                <h4 className="text-xs font-bold text-white flex items-center gap-2 mb-4">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  PLAN GRATUITO (FREE)
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Proveedor</label>
                    <select
                      value={freeProvider}
                      onChange={(e) => setFreeProvider(e.target.value)}
                      className="bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white w-full focus:outline-none focus:border-sky-500 transition-colors"
                    >
                      <option value="openrouter">OpenRouter (Recomendado)</option>
                      <option value="deepseek">DeepSeek Oficial</option>
                      <option value="gemini">Gemini Oficial (Google)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Modelo específico</label>
                    <input
                      type="text"
                      value={freeModel}
                      onChange={(e) => setFreeModel(e.target.value)}
                      placeholder="e.g. openrouter/free"
                      className="bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white w-full placeholder-slate-700 focus:outline-none focus:border-sky-500 transition-colors font-mono"
                      required
                    />
                  </div>
                </div>
                <div className="mt-2 text-[10px] text-slate-500 font-light">
                  * Por defecto para el plan Free se utiliza el modelo `openrouter/free` provisto por OpenRouter.
                </div>
              </div>

              {/* PRO Plan Settings */}
              <div className="bg-slate-950/40 p-5 rounded-2xl border border-slate-850">
                <h4 className="text-xs font-bold text-amber-400 flex items-center gap-2 mb-4">
                  <Crown className="w-3.5 h-3.5 text-amber-400" />
                  PLAN PREMIUM (PRO)
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Proveedor</label>
                    <select
                      value={proProvider}
                      onChange={(e) => setProProvider(e.target.value)}
                      className="bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white w-full focus:outline-none focus:border-sky-500 transition-colors"
                    >
                      <option value="deepseek">DeepSeek Oficial (Recomendado)</option>
                      <option value="gemini">Gemini Oficial (Google)</option>
                      <option value="openrouter">OpenRouter</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Modelo específico</label>
                    <input
                      type="text"
                      value={proModel}
                      onChange={(e) => setProModel(e.target.value)}
                      placeholder="e.g. deepseek-chat"
                      className="bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white w-full placeholder-slate-700 focus:outline-none focus:border-sky-500 transition-colors font-mono"
                      required
                    />
                  </div>
                </div>
                <div className="mt-2 text-[10px] text-slate-500 font-light">
                  * Recomendaciones: para DeepSeek oficial usar `deepseek-chat`, para Gemini usar `gemini-1.5-pro` o `gemini-1.5-flash`.
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold py-3.5 rounded-xl text-xs transition-all shadow-md shadow-sky-500/10 flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  Guardar Configuración de IA
                </button>
              </div>
            </form>
          </div>
        )}
        {/* Tab: Prompts Management */}
        {activeTab === 'prompts' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-950/40 p-6 rounded-3xl border border-slate-800">
              <div>
                <h3 className="text-base font-bold text-white">Biblioteca de Prompts Dinámicos</h3>
                <p className="text-slate-400 text-xs font-light mt-0.5">Define las directrices del sistema y plantillas de usuario que gobernarán las optimizaciones de IA.</p>
              </div>
              <div className="flex items-center gap-3.5 w-full sm:w-auto shrink-0">
                <button
                  onClick={() => setShowArchived(!showArchived)}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                    showArchived
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {showArchived ? 'Ocultar Archivados' : 'Mostrar Archivados'}
                </button>
                <button
                  onClick={openCreatePromptModal}
                  className="bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition-all shadow-md shadow-sky-500/10 flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  Crear Nuevo Prompt
                </button>
              </div>
            </div>

            {promptsList.length === 0 ? (
              <div className="glass-card border border-slate-800 border-dashed rounded-3xl p-16 text-center">
                <div className="bg-slate-900 border border-slate-850 p-4 rounded-full text-slate-500 w-fit mx-auto mb-4 animate-pulse">
                  <Code className="w-8 h-8" />
                </div>
                <h4 className="text-base font-bold text-white mb-1">No hay prompts personalizados en la DB</h4>
                <p className="text-slate-400 text-xs font-light max-w-sm mx-auto mb-6">
                  El sistema está utilizando los prompts estáticos por defecto. Crea tu primer prompt dinámico para empezar a gestionarlo.
                </p>
                <button
                  onClick={openCreatePromptModal}
                  className="bg-slate-900 hover:bg-slate-850 text-slate-200 font-bold px-4 py-2 rounded-xl text-xs border border-slate-800 hover:border-slate-750 transition-all"
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
                    className={`glass-card p-6 rounded-2xl border transition-all relative overflow-hidden group ${
                      prompt.isActive 
                        ? 'border-emerald-500/35 shadow-lg shadow-emerald-950/5' 
                        : prompt.isArchived
                          ? 'border-amber-950/20 opacity-60 hover:opacity-100'
                          : 'border-slate-800/80 hover:border-slate-700'
                    }`}
                  >
                    {/* Glowing side accent for active prompt */}
                    {prompt.isActive && (
                      <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500" />
                    )}

                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
                      <div>
                        <div className="flex items-center gap-2.5 mb-1.5">
                          <h4 className="font-bold text-white text-base">
                            {prompt.name}
                          </h4>
                          {prompt.isActive && (
                            <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md flex items-center gap-0.5">
                              <Check className="w-2.5 h-2.5" /> Activo
                            </span>
                          )}
                          {prompt.isArchived && (
                            <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md">
                              Archivado
                            </span>
                          )}
                          {!prompt.isActive && !prompt.isArchived && (
                            <span className="bg-slate-900 text-slate-500 border border-slate-800/10 text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md">
                              Inactivo
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] bg-slate-900 border border-slate-850 text-slate-400 font-mono px-2 py-0.5 rounded-md">
                          Función: {prompt.key}
                        </span>
                        {prompt.isStrict && (
                          <span className="ml-2 text-[10px] bg-indigo-950/40 border border-indigo-500/20 text-indigo-400 font-mono px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                            <Sparkles className="w-2.5 h-2.5 animate-pulse" /> MD Estricto
                          </span>
                        )}
                      </div>

                      {/* Prompts actions toolbar */}
                      <div className="flex items-center gap-2 self-start">
                        {!prompt.isActive && !prompt.isArchived && (
                          <button
                            onClick={() => handleTogglePromptActive(prompt.id, prompt.key)}
                            className="bg-slate-900 hover:bg-slate-800 text-emerald-400 hover:text-emerald-300 font-semibold px-3 py-1.5 rounded-lg text-[10px] border border-slate-800 hover:border-slate-700 transition-colors"
                          >
                            Activar
                          </button>
                        )}
                        <button
                          onClick={() => handleTogglePromptArchive(prompt.id, !prompt.isArchived)}
                          className={`bg-slate-900 font-semibold px-3 py-1.5 rounded-lg text-[10px] border transition-colors ${
                            prompt.isArchived
                              ? 'text-amber-400 hover:text-amber-300 border-slate-800 hover:border-slate-755'
                              : 'text-slate-400 hover:text-white border-slate-800 hover:border-slate-700'
                          }`}
                          disabled={prompt.isActive}
                          title={prompt.isActive ? "No puedes archivar un prompt activo" : ""}
                        >
                          {prompt.isArchived ? 'Desarchivar' : 'Archivar'}
                        </button>
                        <button
                          onClick={() => openEditPromptModal(prompt)}
                          className="bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white p-2 rounded-lg border border-slate-800 hover:border-slate-700 transition-colors"
                          title="Editar"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        {!prompt.isActive && (
                          <button
                            onClick={() => handleDeletePrompt(prompt.id)}
                            className="bg-slate-900 hover:bg-rose-950/20 text-slate-500 hover:text-rose-400 p-2 rounded-lg border border-slate-800 hover:border-rose-900/30 transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Collapsible system prompt display */}
                    <div className="space-y-3 font-mono text-[10px] text-slate-400">
                      <div className="bg-slate-950/80 rounded-xl p-4 border border-slate-850">
                        <span className="block text-[9px] text-slate-500 font-bold uppercase tracking-wider mb-2">SYSTEM INSTRUCTION (Directiva de Sistema)</span>
                        <div className="whitespace-pre-wrap leading-relaxed max-h-36 overflow-y-auto pr-1">
                          {prompt.systemPrompt}
                        </div>
                      </div>

                      <div className="bg-slate-950/80 rounded-xl p-4 border border-slate-850">
                        <span className="block text-[9px] text-slate-500 font-bold uppercase tracking-wider mb-2">USER TEMPLATE (Estructura de Usuario)</span>
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
      </main>

      {/* MODAL 1: User Details Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 bg-[#030712]/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-slate-950 border border-slate-800 w-full max-w-3xl rounded-3xl overflow-hidden shadow-2xl relative">
            <button
              onClick={() => setSelectedUser(null)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white p-2 rounded-xl bg-slate-900/50 border border-slate-800 hover:bg-slate-900 transition-all z-10"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Profile banner */}
            <div className="bg-gradient-to-r from-sky-950/40 to-indigo-950/30 p-6 border-b border-slate-900">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-2">
                <div>
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-0.5">FICHA DETALLADA DE CANDIDATO</span>
                  <h3 className="text-xl font-bold text-white leading-tight">
                    {selectedUser.name || 'Sin nombre'}
                  </h3>
                  <p className="text-slate-400 text-xs font-light">{selectedUser.email}</p>
                </div>

                {/* Sub status pill */}
                <div className="flex items-center gap-2">
                  {selectedUser.role === 'admin' ? (
                    <span className="bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[10px] font-bold px-3 py-1 rounded-lg flex items-center gap-1 shadow-sm">
                      <Shield className="w-3.5 h-3.5" /> Administrador
                    </span>
                  ) : (
                    <span className="bg-slate-900 text-slate-400 border border-slate-800 text-[10px] font-bold px-3 py-1 rounded-lg">
                      Usuario Ordinario
                    </span>
                  )}

                  {selectedUser.subscriptionStatus === 'active' ? (
                    <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-bold px-3 py-1 rounded-lg flex items-center gap-1 shadow-md shadow-amber-500/5">
                      <Crown className="w-3.5 h-3.5 text-amber-400" /> Premium PRO
                    </span>
                  ) : (
                    <span className="bg-slate-900 text-slate-500 border border-slate-800/10 text-[10px] font-medium px-3 py-1 rounded-lg">
                      Suscripción: Inactiva
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              
              {/* Administrative Actions */}
              <div className="bg-slate-900/30 p-5 rounded-2xl border border-slate-900">
                <h4 className="text-xs font-bold text-white mb-3 flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-sky-400" />
                  Herramientas Administrativas de Soporte
                </h4>

                <div className="flex flex-wrap items-center gap-4">
                  {/* Role Toggle */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">Rango de Seguridad</span>
                    <button
                      onClick={() => handleToggleUserRole(selectedUser.id, selectedUser.role)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 ${
                        selectedUser.role === 'admin'
                          ? 'bg-purple-950/20 border-purple-800/40 text-purple-400 hover:bg-purple-950/40'
                          : 'bg-slate-900 border-slate-800 hover:border-slate-750 text-slate-300'
                      }`}
                    >
                      <Shield className="w-3.5 h-3.5" />
                      <span>{selectedUser.role === 'admin' ? 'Quitar Admin' : 'Hacer Administrador'}</span>
                    </button>
                  </div>

                  {/* Subscription Toggle */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">Suscripción Manual</span>
                    <div className="flex items-center gap-1 bg-slate-950 p-1 border border-slate-850 rounded-xl">
                      <button
                        onClick={() => handleUpdateSubscription(selectedUser.id, 'active')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                          selectedUser.subscriptionStatus === 'active'
                            ? 'bg-amber-500 text-slate-950'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Activar PRO
                      </button>
                      <button
                        onClick={() => handleUpdateSubscription(selectedUser.id, 'none')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                          selectedUser.subscriptionStatus !== 'active'
                            ? 'bg-slate-800 text-slate-300'
                            : 'text-slate-500 hover:text-white'
                        }`}
                      >
                        Desactivar
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-3 text-[10px] text-slate-500 flex items-start gap-1 font-light leading-relaxed">
                  <AlertTriangle className="w-3 h-3 text-slate-500 shrink-0 mt-0.5" />
                  <span>
                    El cambio de suscripción manual sobreescribe directamente en la base de datos sin afectar a los cobros activos en Stripe. Ideal para cuentas de pruebas o soporte temporal.
                  </span>
                </div>
              </div>

              {/* Dynamic user stats details */}
              {loadingDetails ? (
                <div className="text-center py-12 text-slate-500 text-xs font-light flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-sky-400" />
                  <span>Cargando currículums y candidaturas en la base de datos...</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* CVs card list */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-white flex items-center gap-1.5 border-b border-slate-900 pb-2">
                      <FileText className="w-4 h-4 text-sky-400" />
                      Currículums ({userDetails?.cvs.length || 0})
                    </h4>

                    {userDetails?.cvs.length === 0 ? (
                      <div className="text-slate-500 text-[11px] font-light bg-slate-950/40 p-4 rounded-2xl border border-slate-900 text-center">
                        Este usuario no ha creado ningún CV todavía.
                      </div>
                    ) : (
                      <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                        {userDetails?.cvs.map((cv: any) => (
                          <div key={cv.id} className="p-3 bg-slate-950/60 rounded-xl border border-slate-900 flex items-center justify-between text-xs">
                            <div>
                              <span className="font-semibold text-slate-200 block truncate max-w-[200px]">{cv.title}</span>
                              <span className="text-[10px] text-slate-500 font-light block">
                                Template: <span className="capitalize">{cv.templateName}</span> • Margen: {cv.pageMargin}
                              </span>
                            </div>
                            <span className="text-[9px] bg-slate-900 text-slate-400 border border-slate-800 px-2 py-0.5 rounded">
                              {cv.isBase ? 'CV Base' : 'Copia'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Kanban Offers list */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-white flex items-center gap-1.5 border-b border-slate-900 pb-2">
                      <Kanban className="w-4 h-4 text-purple-400" />
                      Postulaciones Kanban ({userDetails?.offers.length || 0})
                    </h4>

                    {userDetails?.offers.length === 0 ? (
                      <div className="text-slate-500 text-[11px] font-light bg-slate-950/40 p-4 rounded-2xl border border-slate-900 text-center">
                        El usuario no ha enlazado ofertas en su tablero.
                      </div>
                    ) : (
                      <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                        {userDetails?.offers.map((offer: any) => (
                          <div key={offer.id} className="p-3 bg-slate-950/60 rounded-xl border border-slate-900 flex items-center justify-between text-xs">
                            <div>
                              <span className="font-semibold text-slate-200 block truncate max-w-[180px]">{offer.title}</span>
                              <span className="text-[10px] text-slate-500 font-light block">
                                {offer.company} • Vía: <span className="capitalize">{offer.platform}</span>
                              </span>
                            </div>
                            
                            {/* status badges */}
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded capitalize ${
                              offer.status === 'offer' ? 'bg-emerald-500/10 text-emerald-400' :
                              offer.status === 'interview' ? 'bg-amber-500/10 text-amber-400' :
                              offer.status === 'rejected' ? 'bg-rose-500/10 text-rose-400' :
                              'bg-slate-900 text-slate-400'
                            }`}>
                              {offer.status === 'interested' ? 'Interesado' :
                               offer.status === 'applied' ? 'Postulado' :
                               offer.status === 'interview' ? 'Entrevista' :
                               offer.status === 'offer' ? 'Oferta 🎉' :
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
            <div className="p-4 bg-slate-950 border-t border-slate-900 flex justify-end">
              <button
                onClick={() => setSelectedUser(null)}
                className="bg-slate-900 hover:bg-slate-850 text-slate-300 font-bold px-5 py-2 rounded-xl text-xs border border-slate-800 transition-colors"
              >
                Cerrar Ficha
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Add/Edit Prompt Modal */}
      {isPromptModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#030712]/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-slate-950 border border-slate-800 w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl relative">
            <button
              onClick={() => setIsPromptModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white p-2 rounded-xl bg-slate-900/50 border border-slate-800 hover:bg-slate-900 transition-all z-10"
            >
              <X className="w-4 h-4" />
            </button>

            <form onSubmit={handlePromptFormSubmit}>
              <div className="bg-gradient-to-r from-sky-950/40 to-indigo-950/30 p-6 border-b border-slate-900">
                <div className="mt-2">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-0.5">EDITOR DE PROMPTS DINÁMICOS</span>
                  <h3 className="text-lg font-bold text-white">
                    {promptForm.id ? 'Editar Prompt Existente' : 'Crear Nuevo Prompt de Optimización'}
                  </h3>
                  <p className="text-slate-400 text-xs font-light">Asocia directrices directas al motor de inteligencia artificial.</p>
                </div>
              </div>

              <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto text-xs font-light">
                
                {/* Name */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Nombre Descriptivo</label>
                  <input
                    type="text"
                    value={promptForm.name}
                    onChange={(e) => setPromptForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g. Asesor Harvard Avanzado con STAR"
                    className="bg-slate-950 border border-slate-850 rounded-xl px-3.5 py-2.5 text-xs text-white w-full placeholder-slate-700 focus:outline-none focus:border-sky-500 transition-colors"
                    required
                  />
                </div>

                {/* Key (Associated Function) */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Función Asociada (Key)</label>
                  <select
                    value={promptForm.key}
                    onChange={(e) => setPromptForm(prev => ({ ...prev, key: e.target.value }))}
                    className="bg-slate-950 border border-slate-850 rounded-xl px-3.5 py-2.5 text-xs text-white w-full focus:outline-none focus:border-sky-500 transition-colors"
                  >
                    <option value="optimize_cv">optimize_cv (Optimizar CV para Ofertas de Empleo)</option>
                  </select>
                  <span className="text-[10px] text-slate-500 font-light block mt-0.5">
                    * Actualmente, solo existe la función de optimización de CV. En un futuro, si agregas nuevas características, podrás ligar sus prompts con claves únicas desde aquí.
                  </span>
                </div>

                {/* Strict Mode Checkbox */}
                <div className="flex items-center gap-3 bg-indigo-950/20 border border-indigo-500/10 p-3.5 rounded-xl mb-4">
                  <input
                    type="checkbox"
                    id="isStrict"
                    checked={promptForm.isStrict}
                    onChange={(e) => setPromptForm(prev => ({ ...prev, isStrict: e.target.checked }))}
                    className="rounded bg-slate-950 border-slate-800 text-indigo-500 focus:ring-indigo-500/20 w-4 h-4 cursor-pointer"
                  />
                  <div className="flex flex-col">
                    <label htmlFor="isStrict" className="text-xs font-bold text-indigo-300 cursor-pointer select-none flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
                      Regla superestricta de formato Markdown (.MD)
                    </label>
                    <span className="text-[10px] text-slate-400 font-light mt-0.5">
                      Fuerza al modelo de IA a omitir explicaciones adicionales y bloques de código, devolviendo únicamente Markdown estructurado.
                    </span>
                  </div>
                </div>

                {/* System Prompt */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">System Prompt (Directrices)</label>
                  <textarea
                    value={promptForm.systemPrompt}
                    onChange={(e) => setPromptForm(prev => ({ ...prev, systemPrompt: e.target.value }))}
                    placeholder="Eres un redactor experto en CVs estilo Harvard. Analiza la oferta e integra palabras clave..."
                    className="bg-slate-950 border border-slate-850 rounded-xl px-3.5 py-2.5 text-xs text-white w-full placeholder-slate-750 focus:outline-none focus:border-sky-500 transition-colors h-28 font-mono leading-relaxed"
                    required
                  />
                </div>

                {/* User Prompt */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">User Prompt Template (Plantilla de Datos)</label>
                  <textarea
                    value={promptForm.userPrompt}
                    onChange={(e) => setPromptForm(prev => ({ ...prev, userPrompt: e.target.value }))}
                    placeholder="CV Base:\n{{cv}}\n\nOferta:\n{{job}}"
                    className="bg-slate-950 border border-slate-850 rounded-xl px-3.5 py-2.5 text-xs text-white w-full placeholder-slate-750 focus:outline-none focus:border-sky-500 transition-colors h-24 font-mono leading-relaxed"
                    required
                  />
                  <span className="text-[10px] text-slate-500 font-light block mt-0.5">
                    * Utiliza obligatoriamente los marcadores <code className="text-sky-400 font-mono font-bold">{"{{cv}}"}</code> y <code className="text-sky-400 font-mono font-bold">{"{{job}}"}</code> para indicarle al servicio dónde inyectar los datos reales del usuario.
                  </span>
                </div>

                {/* Is Active & Is Archived */}
                <div className="flex flex-col gap-3 pt-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isActive"
                      checked={promptForm.isActive}
                      onChange={(e) => setPromptForm(prev => ({ ...prev, isActive: e.target.checked, isArchived: e.target.checked ? false : prev.isArchived }))}
                      className="rounded bg-slate-950 border-slate-800 text-sky-500 focus:ring-sky-500/20 w-4 h-4 cursor-pointer"
                    />
                    <label htmlFor="isActive" className="text-xs font-semibold text-slate-300 cursor-pointer select-none">
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
                      className="rounded bg-slate-950 border-slate-800 text-sky-500 focus:ring-sky-500/20 w-4 h-4 cursor-pointer disabled:opacity-50"
                    />
                    <label htmlFor="isArchived" className="text-xs font-semibold text-slate-300 cursor-pointer select-none">
                      Archivar prompt (no se mostrará a los usuarios durante la optimización)
                    </label>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 bg-slate-950 border-t border-slate-900 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsPromptModalOpen(false)}
                  className="bg-slate-900 hover:bg-slate-850 text-slate-400 font-bold px-4 py-2 rounded-xl text-xs border border-slate-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold px-5 py-2 rounded-xl text-xs transition-all shadow-md shadow-sky-500/10 flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Guardar Cambios</span>
                </button>
              </div>
            </form>
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
