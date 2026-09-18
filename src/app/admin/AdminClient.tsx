'use client';

import { useState, useTransition, useEffect } from 'react';
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
  Eye,
  Copy,
  RotateCcw,
  Cpu
} from 'lucide-react';
import {
  updateAISetting,
  saveModelCatalogAction,
  resetModelCatalogAction,
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
  getAdminAuditStats,
  getOpenRouterKeyInfo
} from './actions';
import AlertModal from '@/components/ui/AlertModal';
import { AdminUserDetailsSkeleton } from '@/components/skeletons';
import { Bone, times } from '@/components/ui/Skeleton';

import {
  type CustomModelConfig,
  type AiProvider,
  parseModelCatalog,
  getModelsForPlanAndProvider,
  DEFAULT_FREE_PROVIDER,
  DEFAULT_FREE_MODEL,
  DEFAULT_PRO_PROVIDER,
  DEFAULT_PRO_MODEL
} from '@/lib/models';

const getModelsForProvider = (
  provider: string,
  currentValue: string,
  modelList: Record<string, { value: string; label: string }[]>
) => {
  const list = modelList[provider] || [];
  if (currentValue && !list.some((m) => m.value === currentValue)) {
    return [...list, { value: currentValue, label: `${currentValue} (Personalizado)` }];
  }
  return list;
};


interface AdminClientProps {
  initialStats: {
    totalUsers: number;
    totalGuests: number;
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
  const [logCurrentPage, setLogCurrentPage] = useState(1);
  const logsPerPage = 50;

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
  const [showEnglishFields, setShowEnglishFields] = useState(false);
  const [promptForm, setPromptForm] = useState<{
    id?: string;
    name: string;
    nameEn: string;
    key: string;
    description: string;
    descriptionEn: string;
    color: string;
    systemPrompt: string;
    userPrompt: string;
    isActive: boolean;
    isArchived: boolean;
    isStrict: boolean;
  }>({
    name: '',
    nameEn: '',
    key: 'optimize_cv',
    description: '',
    descriptionEn: '',
    color: '#8b5cf6',
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

  // Reset logs page to 1 when filters change
  useEffect(() => {
    setLogCurrentPage(1);
  }, [logSearchQuery, logActionFilter, logDateFilter]);

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

  const totalLogPages = Math.ceil(filteredAuditLogs.length / logsPerPage);
  const paginatedAuditLogs = filteredAuditLogs.slice(
    (logCurrentPage - 1) * logsPerPage,
    logCurrentPage * logsPerPage
  );

  // IA Settings form state (local fields)
  const getSettingValue = (key: string, fallback: string) => {
    const s = dbSettings.find((item) => item.key === key);
    return s ? s.value : fallback;
  };

  const [freeProvider, setFreeProvider] = useState(() => getSettingValue('free_provider', DEFAULT_FREE_PROVIDER));
  const [freeModel, setFreeModel] = useState(() => getSettingValue('free_model', DEFAULT_FREE_MODEL));
  const [proProvider, setProProvider] = useState(() => getSettingValue('pro_provider', DEFAULT_PRO_PROVIDER));
  const [proModel, setProModel] = useState(() => getSettingValue('pro_model', DEFAULT_PRO_MODEL));

  // Catálogo dinámico de modelos de IA
  const [modelCatalog, setModelCatalog] = useState<CustomModelConfig[]>(() => {
    const raw = getSettingValue('ai_models_catalog', '');
    return parseModelCatalog(raw);
  });

  const [modelSearchQuery, setModelSearchQuery] = useState('');
  const [modelProviderFilter, setModelProviderFilter] = useState<'all' | AiProvider>('all');
  const [modelPlanFilter, setModelPlanFilter] = useState<'all' | 'free' | 'pro'>('all');
  const [copiedModelId, setCopiedModelId] = useState<string | null>(null);

  // Modal para Añadir / Editar Modelo
  const [isModelModalOpen, setIsModelModalOpen] = useState(false);
  const [editingModelId, setEditingModelId] = useState<string | null>(null);
  const [modelFormData, setModelFormData] = useState<{
    provider: AiProvider;
    value: string;
    label: string;
    plans: ('free' | 'pro')[];
    description: string;
  }>({
    provider: 'openrouter',
    value: '',
    label: '',
    plans: ['free', 'pro'],
    description: '',
  });

  useEffect(() => {
    const rawCatalog = dbSettings.find((s) => s.key === 'ai_models_catalog')?.value;
    if (rawCatalog) {
      setModelCatalog(parseModelCatalog(rawCatalog));
    }
  }, [dbSettings]);

  const filteredModelCatalog = modelCatalog.filter((m) => {
    if (modelProviderFilter !== 'all' && m.provider !== modelProviderFilter) return false;
    if (modelPlanFilter !== 'all' && !m.plans.includes(modelPlanFilter)) return false;
    if (modelSearchQuery.trim()) {
      const q = modelSearchQuery.toLowerCase();
      const matchesLabel = m.label.toLowerCase().includes(q);
      const matchesValue = m.value.toLowerCase().includes(q);
      const matchesDesc = m.description?.toLowerCase().includes(q);
      if (!matchesLabel && !matchesValue && !matchesDesc) return false;
    }
    return true;
  });

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

  // OpenRouter API key limits & credit info
  const [openRouterKeyInfo, setOpenRouterKeyInfo] = useState<any | null>(null);
  const [loadingKeyInfo, setLoadingKeyInfo] = useState(false);
  const [keyInfoError, setKeyInfoError] = useState<string | null>(null);
  const [isOpenRouterInfoExpanded, setIsOpenRouterInfoExpanded] = useState(false);

  const fetchOpenRouterKeyInfo = async () => {
    setLoadingKeyInfo(true);
    setKeyInfoError(null);
    try {
      const res = await getOpenRouterKeyInfo();
      if (res.success) {
        setOpenRouterKeyInfo(res.data);
      } else {
        setKeyInfoError(res.error || 'Error al obtener la información de OpenRouter');
      }
    } catch (err: any) {
      setKeyInfoError(err.message || 'Error de red al conectar con el servidor.');
    } finally {
      setLoadingKeyInfo(false);
    }
  };

  useEffect(() => {
    if (isOpenRouterInfoExpanded && !openRouterKeyInfo && !loadingKeyInfo) {
      fetchOpenRouterKeyInfo();
    }
  }, [isOpenRouterInfoExpanded, openRouterKeyInfo, loadingKeyInfo]);

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

  // Model Catalog Actions
  const handleCopyModelId = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedModelId(id);
    setTimeout(() => setCopiedModelId(null), 2000);
  };

  const openCreateModelModal = () => {
    setEditingModelId(null);
    setModelFormData({
      provider: modelProviderFilter !== 'all' ? modelProviderFilter : 'openrouter',
      value: '',
      label: '',
      plans: ['free', 'pro'],
      description: '',
    });
    setIsModelModalOpen(true);
  };

  const openEditModelModal = (model: CustomModelConfig) => {
    setEditingModelId(model.id);
    setModelFormData({
      provider: model.provider,
      value: model.value,
      label: model.label,
      plans: [...model.plans],
      description: model.description || '',
    });
    setIsModelModalOpen(true);
  };

  const handleSaveModel = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanVal = modelFormData.value.trim();
    const cleanLabel = modelFormData.label.trim();

    if (!cleanVal) {
      showToast('El ID del modelo (API) es obligatorio', 'error');
      return;
    }
    if (!cleanLabel) {
      showToast('El nombre o etiqueta es obligatorio', 'error');
      return;
    }
    if (modelFormData.plans.length === 0) {
      showToast('Selecciona al menos un plan (Gratuito o Premium)', 'error');
      return;
    }

    const duplicate = modelCatalog.find(
      (m) => m.provider === modelFormData.provider && m.value === cleanVal && m.id !== editingModelId
    );
    if (duplicate) {
      showToast(`Ya existe un modelo con ID "${cleanVal}" para este proveedor`, 'error');
      return;
    }

    let updatedCatalog: CustomModelConfig[];
    if (editingModelId) {
      const oldModel = modelCatalog.find((m) => m.id === editingModelId);
      updatedCatalog = modelCatalog.map((m) => {
        if (m.id === editingModelId) {
          return {
            ...m,
            provider: modelFormData.provider,
            value: cleanVal,
            label: cleanLabel,
            plans: modelFormData.plans,
            description: modelFormData.description.trim() || undefined,
          };
        }
        return m;
      });

      if (oldModel && oldModel.value !== cleanVal) {
        if (freeProvider === oldModel.provider && freeModel === oldModel.value) setFreeModel(cleanVal);
        if (proProvider === oldModel.provider && proModel === oldModel.value) setProModel(cleanVal);
      }
    } else {
      const newModel: CustomModelConfig = {
        id: `custom-${modelFormData.provider}-${cleanVal.replace(/[^a-zA-Z0-9_-]/g, '_')}-${Date.now()}`,
        provider: modelFormData.provider,
        value: cleanVal,
        label: cleanLabel,
        plans: modelFormData.plans,
        description: modelFormData.description.trim() || undefined,
        isBuiltin: false,
      };
      updatedCatalog = [newModel, ...modelCatalog];
    }

    setModelCatalog(updatedCatalog);
    setIsModelModalOpen(false);

    const res = await saveModelCatalogAction(updatedCatalog);
    if (res.success) {
      showToast(editingModelId ? 'Modelo actualizado correctamente' : 'Modelo añadido al catálogo');
      refreshData();
    } else {
      showToast(res.error || 'Error al guardar el catálogo en la base de datos', 'error');
    }
  };

  const handleDeleteModel = async (model: CustomModelConfig) => {
    const isUsedInFree = freeProvider === model.provider && freeModel === model.value;
    const isUsedInPro = proProvider === model.provider && proModel === model.value;

    if (isUsedInFree || isUsedInPro) {
      const where = isUsedInFree && isUsedInPro
        ? 'ambos planes (Gratuito y Premium)'
        : isUsedInFree
          ? 'el Plan Gratuito'
          : 'el Plan Premium';
      showToast(`No se puede eliminar: "${model.label}" está seleccionado en ${where}. Cambia primero la asignación arriba.`, 'error');
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Eliminar Modelo de IA',
      message: `¿Estás seguro de que deseas eliminar "${model.label}" (${model.value}) del catálogo? Ya no estará disponible para seleccionar en los planes.`,
      type: 'danger',
      confirmLabel: 'Eliminar Modelo',
      onConfirm: async () => {
        const updated = modelCatalog.filter((m) => m.id !== model.id);
        setModelCatalog(updated);
        const res = await saveModelCatalogAction(updated);
        if (res.success) {
          showToast(`Modelo "${model.label}" eliminado del catálogo`);
          refreshData();
        } else {
          showToast(res.error || 'Error al eliminar modelo', 'error');
        }
      },
    });
  };

  const handleResetCatalog = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Restaurar Catálogo Predeterminado',
      message: '¿Estás seguro de que deseas restaurar los modelos predeterminados del sistema? Los modelos personalizados que no pertenezcan a la lista estándar serán eliminados.',
      type: 'warning',
      confirmLabel: 'Restaurar Predeterminados',
      onConfirm: async () => {
        const res = await resetModelCatalogAction();
        if (res.success && res.catalog) {
          setModelCatalog(res.catalog);
          showToast('Catálogo de modelos restaurado a los valores predeterminados');
          refreshData();
        } else {
          showToast(res.error || 'Error al restaurar modelos', 'error');
        }
      },
    });
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
      nameEn: '',
      key: 'optimize_cv',
      description: '',
      descriptionEn: '',
      color: '#8b5cf6',
      systemPrompt: 'Eres un redactor experto en CVs estilo Harvard...',
      userPrompt: 'CV Base:\n{{cv}}\n\nOferta de Trabajo:\n{{job}}',
      isActive: false,
      isArchived: false,
      isStrict: false,
    });
    setShowEnglishFields(false);
    setIsPromptModalOpen(true);
  };

  // Open prompt modal in editing mode
  const openEditPromptModal = (prompt: any) => {
    setPromptForm({
      id: prompt.id,
      name: prompt.name,
      nameEn: prompt.nameEn || '',
      key: prompt.key,
      description: prompt.description || '',
      descriptionEn: prompt.descriptionEn || '',
      color: prompt.color || '#8b5cf6',
      systemPrompt: prompt.systemPrompt,
      userPrompt: prompt.userPrompt,
      isActive: prompt.isActive,
      isArchived: prompt.isArchived || false,
      isStrict: prompt.isStrict || false,
    });
    setShowEnglishFields(!!prompt.nameEn || !!prompt.descriptionEn);
    setIsPromptModalOpen(true);
  };

  // Filtered users for search list
  const filteredUsers = usersList.filter(u =>
    u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="relative text-text overflow-x-hidden font-sans">
      {/* Glow effects background */}
      <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-ai/5 dark:bg-ai/8 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[5%] left-[-15%] w-[45%] h-[45%] rounded-full bg-ai/3 dark:bg-ai/5 blur-[120px] pointer-events-none" />

      {/* Toast Notification */}
      {notification && (
        <div className={`fixed bottom-5 right-5 z-50 px-5 py-3.5 rounded-[12px] flex items-center gap-3 border shadow-lg transition-all transform animate-bounce ${
          notification.type === 'success'
            ? 'bg-surface border-action/30 dark:border-action/40 text-success-text shadow-md shadow-action/5'
            : 'bg-surface border-rose-500/30 dark:border-rose-500/40 text-rose-600 dark:text-rose-400 shadow-md shadow-rose-500/5'
        }`}>
          <div className={`p-1 rounded-full ${notification.type === 'success' ? 'bg-action/10' : 'bg-rose-500/10'}`}>
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
            <h1 className="text-2xl font-bold font-display text-text flex items-center gap-2">
              <Shield className="w-6 h-6 text-ai stroke-[1.75]" />
              Panel de Administración
            </h1>
            <p className="text-text-muted text-xs font-light font-sans mt-0.5">
              Gestiona usuarios registrados, suscripciones y configuraciones del motor de IA.
            </p>
          </div>
          <button
            onClick={refreshData}
            className="text-text-muted dark:text-slate-300 hover:text-text dark:hover:text-white p-2 rounded-[8px] bg-surface hover:bg-canvas dark:hover:bg-surface-muted/80 border border-subtle transition-all flex items-center gap-1.5 text-xs font-semibold shadow-sm font-display shrink-0"
            title="Refrescar Datos"
          >
            <RefreshCw className={`w-3.5 h-3.5 stroke-[1.75] ${isPending ? 'animate-spin' : ''}`} />
            <span>Sincronizar Datos</span>
          </button>
        </div>

        {/* Upper Tabs Navigation */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 mb-8 bg-surface border border-subtle p-2 rounded-[12px] shadow-sm">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 w-full md:w-auto">
            <button
              onClick={() => setActiveTab('stats')}
              className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-[8px] text-xs font-bold transition-all font-display border ${
                activeTab === 'stats'
                  ? 'bg-text dark:bg-white text-canvas border-text dark:border-white shadow-sm'
                  : 'text-text-muted hover:text-text dark:hover:text-white hover:bg-canvas dark:hover:bg-canvas/30 border-transparent'
              }`}
            >
              <Sparkles className="w-4 h-4 stroke-[1.75]" />
              <span>Resumen</span>
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-[8px] text-xs font-bold transition-all font-display border ${
                activeTab === 'users'
                  ? 'bg-text dark:bg-white text-canvas border-text dark:border-white shadow-sm'
                  : 'text-text-muted hover:text-text dark:hover:text-white hover:bg-canvas dark:hover:bg-canvas/30 border-transparent'
              }`}
            >
              <Users className="w-4 h-4 stroke-[1.75]" />
              <span>Usuarios ({usersList.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('ai')}
              className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-[8px] text-xs font-bold transition-all font-display border ${
                activeTab === 'ai'
                  ? 'bg-text dark:bg-white text-canvas border-text dark:border-white shadow-sm'
                  : 'text-text-muted hover:text-text dark:hover:text-white hover:bg-canvas dark:hover:bg-canvas/30 border-transparent'
              }`}
            >
              <Settings className="w-4 h-4 stroke-[1.75]" />
              <span>Modelos IA</span>
            </button>
            <button
              onClick={() => setActiveTab('prompts')}
              className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-[8px] text-xs font-bold transition-all font-display border ${
                activeTab === 'prompts'
                  ? 'bg-text dark:bg-white text-canvas border-text dark:border-white shadow-sm'
                  : 'text-text-muted hover:text-text dark:hover:text-white hover:bg-canvas dark:hover:bg-canvas/30 border-transparent'
              }`}
            >
              <Code className="w-4 h-4 stroke-[1.75]" />
              <span>Gestión Prompts</span>
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-[8px] text-xs font-bold transition-all font-display border ${
                activeTab === 'logs'
                  ? 'bg-text dark:bg-white text-canvas border-text dark:border-white shadow-sm'
                  : 'text-text-muted hover:text-text dark:hover:text-white hover:bg-canvas dark:hover:bg-canvas/30 border-transparent'
              }`}
            >
              <Terminal className="w-4 h-4 stroke-[1.75]" />
              <span>Auditoría</span>
            </button>
          </div>
          
          <div className="text-text-muted text-[11px] px-3 font-light text-center md:text-right">
            Sincronización en tiempo real activa • PostgreSQL
          </div>
        </div>

        {/* Tab content areas */}
        {activeTab === 'stats' && (
          <div className="space-y-8 animate-fadeIn">
            {/* Stat Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
              <div className="bg-surface p-6 rounded-[12px] border border-subtle flex items-center justify-between group hover:border-ai/30 dark:hover:border-ai/40 hover:shadow-md transition-all duration-300">
                <div>
                  <span className="text-text-muted text-xs font-medium font-sans">Usuarios Registrados</span>
                  <h3 className="text-3xl font-bold font-display text-text mt-1.5 tracking-tight group-hover:text-ai dark:group-hover:text-violet-400 transition-colors">
                    {stats.totalUsers}
                  </h3>
                </div>
                <div className="p-3.5 bg-ai/10 dark:bg-ai/20 text-ai rounded-[8px] border border-ai/10 dark:border-ai/20 group-hover:bg-ai/20 transition-all duration-300 shadow-sm">
                  <Users className="w-5 h-5 stroke-[1.75]" />
                </div>
              </div>

              <div className="bg-surface p-6 rounded-[12px] border border-subtle flex items-center justify-between group hover:border-slate-500/30 dark:hover:border-slate-500/40 hover:shadow-md transition-all duration-300">
                <div>
                  <span className="text-text-muted text-xs font-medium font-sans">Pruebas (Invitados)</span>
                  <h3 className="text-3xl font-bold font-display text-text mt-1.5 tracking-tight group-hover:text-slate-500 dark:group-hover:text-slate-400 transition-colors">
                    {stats.totalGuests}
                  </h3>
                </div>
                <div className="p-3.5 bg-control/10 dark:bg-control/20 text-slate-500 dark:text-text-muted rounded-[8px] border border-slate-500/10 dark:border-slate-500/20 group-hover:bg-control/20 transition-all duration-300 shadow-sm">
                  <Users className="w-5 h-5 stroke-[1.75]" />
                </div>
              </div>

              <div className="bg-surface p-6 rounded-[12px] border border-subtle flex items-center justify-between group hover:border-action/30 dark:hover:border-action/40 hover:shadow-md transition-all duration-300">
                <div>
                  <span className="text-text-muted text-xs font-medium font-sans">Suscripciones PRO</span>
                  <h3 className="text-3xl font-bold font-display text-success-text mt-1.5 tracking-tight">
                    {stats.activeSubscriptions}
                  </h3>
                </div>
                <div className="p-3.5 bg-action/10 dark:bg-action/20 text-success-text rounded-[8px] border border-action/10 dark:border-action/20 group-hover:bg-action/20 transition-all duration-300 shadow-sm">
                  <Crown className="w-5 h-5 stroke-[1.75]" />
                </div>
              </div>

              <div className="bg-surface p-6 rounded-[12px] border border-subtle flex items-center justify-between group hover:border-ai/30 dark:hover:border-ai/40 hover:shadow-md transition-all duration-300">
                <div>
                  <span className="text-text-muted text-xs font-medium font-sans">Currículums Creados</span>
                  <h3 className="text-3xl font-bold font-display text-text mt-1.5 tracking-tight group-hover:text-ai dark:group-hover:text-violet-400 transition-colors">
                    {stats.totalCvs}
                  </h3>
                </div>
                <div className="p-3.5 bg-ai/10 dark:bg-ai/20 text-ai rounded-[8px] border border-ai/10 dark:border-ai/20 group-hover:bg-ai/20 transition-all duration-300 shadow-sm">
                  <FileText className="w-5 h-5 stroke-[1.75]" />
                </div>
              </div>

              <div className="bg-surface p-6 rounded-[12px] border border-subtle flex items-center justify-between group hover:border-ai/30 dark:hover:border-ai/40 hover:shadow-md transition-all duration-300">
                <div>
                  <span className="text-text-muted text-xs font-medium font-sans">Postulaciones</span>
                  <h3 className="text-3xl font-bold font-display text-text mt-1.5 tracking-tight group-hover:text-ai dark:group-hover:text-violet-400 transition-colors">
                    {stats.totalOffers}
                  </h3>
                </div>
                <div className="p-3.5 bg-ai/10 dark:bg-ai/20 text-ai rounded-[8px] border border-ai/10 dark:border-ai/20 group-hover:bg-ai/20 transition-all duration-300 shadow-sm">
                  <Kanban className="w-5 h-5 stroke-[1.75]" />
                </div>
              </div>
            </div>

            {/* Quick overview layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-surface p-6 rounded-[12px] border border-subtle lg:col-span-2 shadow-sm">
                <h3 className="text-base font-semibold font-display text-text mb-1">Información General del Sistema</h3>
                <p className="text-text-muted text-xs font-light mb-6">Estado global del entorno y base de datos relacional.</p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-light">
                  <div className="p-4 bg-canvas/40 border border-subtle rounded-[12px]">
                    <span className="text-text-muted font-bold block mb-1 text-[10px] tracking-wider">PROVEEDOR PLAN GRATIS</span>
                    <span className="text-text font-semibold uppercase">{freeProvider}</span>
                    <span className="text-text-muted block mt-0.5">Modelo: {freeModel}</span>
                  </div>

                  <div className="p-4 bg-canvas/40 border border-subtle rounded-[12px]">
                    <span className="text-text-muted font-bold block mb-1 text-[10px] tracking-wider">PROVEEDOR PLAN PRO</span>
                    <span className="text-success-text font-semibold uppercase">{proProvider}</span>
                    <span className="text-text-muted block mt-0.5">Modelo: {proModel}</span>
                  </div>

                  <div className="p-4 bg-canvas/40 border border-subtle rounded-[12px]">
                    <span className="text-text-muted font-bold block mb-1 text-[10px] tracking-wider">PROMPTS INSTALADOS</span>
                    <span className="text-text font-semibold">{promptsList.length} Prompts guardados</span>
                    <span className="text-success-text block mt-0.5 font-medium">
                      {promptsList.filter(p => p.isActive).length} Activos actualmente
                    </span>
                  </div>

                  <div className="p-4 bg-canvas/40 border border-subtle rounded-[12px]">
                    <span className="text-text-muted font-bold block mb-1 text-[10px] tracking-wider">TASA DE CONVERSIÓN PRO</span>
                    <span className="text-text font-semibold">
                      {stats.totalUsers > 0 
                        ? `${((stats.activeSubscriptions / stats.totalUsers) * 100).toFixed(1)}%` 
                        : '0%'
                      } de usuarios totales
                    </span>
                    <span className="text-text-muted block mt-0.5">Ingresos recurrentes activos</span>
                  </div>
                </div>

                <div className="mt-6 p-4 rounded-[12px] border border-subtle bg-canvas/50 dark:bg-canvas/20 flex items-start gap-3">
                  <div className="p-2 bg-ai/10 text-ai rounded-[8px] border border-ai/20 shrink-0">
                    <Shield className="w-4 h-4 stroke-[1.75]" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-text mb-0.5 font-display">Control de Suscripciones Manuales</h4>
                    <p className="text-[11px] text-text-muted leading-relaxed font-light font-sans">
                      Como administrador, puedes ascender cuentas ordinarias a PRO o conceder privilegios directamente desde la pestaña de Usuarios para facilitar pruebas rápidas o dar soporte directo.
                    </p>
                  </div>
                </div>
              </div>

              {/* Quick AI status */}
              <div className="bg-surface p-6 rounded-[12px] border border-subtle flex flex-col justify-between shadow-sm">
                <div>
                  <h3 className="text-base font-semibold font-display text-text mb-1">Estado de los Motores IA</h3>
                  <p className="text-text-muted text-xs font-light mb-6">Detalles de las APIs conectadas actualmente.</p>

                  <div className="space-y-4 font-sans">
                    <div className="flex items-center justify-between border-b border-subtle pb-3">
                      <div>
                        <span className="text-xs font-bold text-text block">OpenRouter</span>
                        <span className="text-[10px] text-text-muted">Plan Free & Backups</span>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-[8px] bg-action/10 text-success-text border border-action/20 font-bold">Activo</span>
                    </div>

                    <div className="flex items-center justify-between border-b border-subtle pb-3">
                      <div>
                        <span className="text-xs font-bold text-text block">DeepSeek API</span>
                        <span className="text-[10px] text-text-muted">Plan PRO Principal</span>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-[8px] bg-action/10 text-success-text border border-action/20 font-bold">Suscrito</span>
                    </div>

                    <div className="flex items-center justify-between pb-1">
                      <div>
                        <span className="text-xs font-bold text-text block">Gemini API</span>
                        <span className="text-[10px] text-text-muted">PRO & Multimodal</span>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-[8px] bg-ai/10 text-ai border border-ai/20 font-bold">Configurado</span>
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-4 border-t border-subtle">
                  <button
                    onClick={() => setActiveTab('ai')}
                    className="w-full bg-text hover:bg-text/90 dark:bg-white dark:hover:bg-surface-muted border border-text dark:border-white text-canvas font-bold py-2.5 rounded-[8px] text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm font-display"
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
          <div className="bg-surface p-6 rounded-[12px] border border-subtle shadow-sm animate-fadeIn">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-base font-semibold font-display text-text">Listado Completo de Usuarios</h3>
                <p className="text-text-muted text-xs font-light font-sans">Explora y gestiona los roles y el estado de suscripción de los candidatos.</p>
              </div>

              {/* Search Bar */}
              <div className="relative w-full md:w-72">
                <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-text-muted stroke-[1.75]" />
                <input
                  type="text"
                  placeholder="Buscar por nombre o correo..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-canvas/40 border border-subtle rounded-[8px] pl-10 pr-4 py-2.5 text-xs text-text placeholder-text-muted focus:outline-none focus:border-ai transition-all w-full font-sans"
                />
              </div>
            </div>

            {filteredUsers.length === 0 ? (
              <div className="border border-subtle border-dashed rounded-[12px] p-12 text-center text-text-muted text-xs font-light font-sans">
                No se encontraron usuarios que coincidan con la búsqueda.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-[12px] border border-subtle shadow-sm">
                <table className="min-w-full divide-y divide-subtle dark:divide-white/10 text-left text-xs font-light font-sans">
                  <thead className="bg-canvas/30 text-[10px] text-text-muted font-bold uppercase tracking-wider font-display">
                    <tr>
                      <th className="px-6 py-4">Usuario</th>
                      <th className="px-6 py-4">Correo Electrónico</th>
                      <th className="px-6 py-4">Rol</th>
                      <th className="px-6 py-4">Suscripción</th>
                      <th className="px-6 py-4">Fecha Registro</th>
                      <th className="px-6 py-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-subtle dark:divide-white/5 bg-surface/50">
                    {filteredUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-canvas dark:hover:bg-canvas/20 transition-colors group">
                        <td className="px-6 py-4 font-semibold text-text whitespace-nowrap font-display">
                          {user.name || 'Sin nombre'}
                        </td>
                        <td className="px-6 py-4 text-text-muted dark:text-slate-300 whitespace-nowrap">
                          {user.email}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {user.role === 'admin' ? (
                            <span className="bg-ai/10 text-ai border border-ai/20 dark:border-violet-500/30 text-[10px] font-bold px-2 py-0.5 rounded-[8px] flex items-center gap-1 w-fit shadow-sm font-display">
                              <Shield className="w-3 h-3 stroke-[1.75]" /> Admin
                            </span>
                          ) : (
                            <span className="bg-canvas/40 text-text-muted border border-subtle text-[10px] font-bold px-2 py-0.5 rounded-[8px] w-fit font-display">
                              Usuario
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {user.subscriptionStatus === 'active' ? (
                            <span className="bg-action/10 text-success-text border border-action/20 dark:border-action/30 text-[10px] font-bold px-2.5 py-0.5 rounded-[8px] flex items-center gap-1 w-fit shadow-sm font-display">
                              <Crown className="w-3.5 h-3.5 text-success-text stroke-[1.75]" /> PRO
                            </span>
                          ) : (
                            <span className="bg-canvas/40 text-text-muted border border-subtle text-[10px] font-medium px-2 py-0.5 rounded-[8px] w-fit font-display">
                              Plan Free
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-text-muted whitespace-nowrap">
                          {new Date(user.createdAt).toLocaleDateString('es-ES', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <button
                            onClick={() => handleViewUserDetails(user)}
                            className="bg-surface hover:bg-canvas dark:hover:bg-canvas/30 border border-subtle hover:border-ai/30 dark:hover:border-ai/40 text-ai hover:text-ai/85 font-bold px-3 py-1.5 rounded-[8px] text-[10px] transition-all font-display shadow-sm"
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
          <div className="space-y-6 animate-fadeIn">
            {/* Asignación de Modelos por Plan */}
            <div className="bg-surface p-6 rounded-[12px] border border-subtle shadow-sm">
              <div className="border-b border-subtle pb-4 mb-6">
                <h3 className="text-base font-semibold font-display text-text">Configuración del Motor de IA</h3>
                <p className="text-text-muted text-xs font-light mt-0.5 font-sans">Asigna qué proveedor de API y qué modelo específico se utilizará en cada plan de usuario.</p>
              </div>

              <form onSubmit={handleSaveSettings} className="space-y-6">
                
                {/* Free Plan Settings */}
                <div className="bg-canvas/40 p-5 rounded-[12px] border border-subtle">
                  <h4 className="text-xs font-bold text-text flex items-center gap-2 mb-4 font-display">
                    <span className="w-2 h-2 rounded-full bg-action" />
                    PLAN GRATUITO (FREE)
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5 font-sans">
                      <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider block font-display">Proveedor</label>
                      <select
                        value={freeProvider}
                        onChange={(e) => {
                          const val = e.target.value as AiProvider;
                          setFreeProvider(val);
                          const list = getModelsForPlanAndProvider(modelCatalog, 'free', val);
                          if (list.length > 0) {
                            setFreeModel(list[0].value);
                          }
                        }}
                        className="bg-surface border border-subtle rounded-[8px] px-3.5 py-2.5 text-xs text-text focus:outline-none focus:border-ai dark:focus:border-ai transition-colors w-full"
                      >
                        <option value="openrouter" className="dark:bg-surface">OpenRouter (Recomendado)</option>
                        <option value="deepseek" className="dark:bg-surface">DeepSeek Oficial</option>
                        <option value="gemini" className="dark:bg-surface">Gemini Oficial (Google)</option>
                      </select>
                    </div>

                    <div className="space-y-1.5 font-sans">
                      <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider block font-display">Modelo específico</label>
                      <select
                        value={freeModel}
                        onChange={(e) => setFreeModel(e.target.value)}
                        className="bg-surface border border-subtle rounded-[8px] px-3.5 py-2.5 text-xs text-text focus:outline-none focus:border-ai dark:focus:border-ai transition-colors w-full"
                      >
                        {getModelsForPlanAndProvider(modelCatalog, 'free', freeProvider, freeModel).map((m) => (
                          <option key={m.value} value={m.value} className="dark:bg-surface">{m.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="mt-2 text-[10px] text-text-muted font-light font-sans">
                    * Puedes añadir o editar los modelos disponibles para este plan en el catálogo inferior.
                  </div>
                </div>

                {/* PRO Plan Settings */}
                <div className="bg-canvas/40 p-5 rounded-[12px] border border-subtle">
                  <h4 className="text-xs font-bold text-ai flex items-center gap-2 mb-4 font-display">
                    <Crown className="w-3.5 h-3.5 text-ai stroke-[1.75]" />
                    PLAN PREMIUM (PRO)
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5 font-sans">
                      <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider block font-display">Proveedor</label>
                      <select
                        value={proProvider}
                        onChange={(e) => {
                          const val = e.target.value as AiProvider;
                          setProProvider(val);
                          const list = getModelsForPlanAndProvider(modelCatalog, 'pro', val);
                          if (list.length > 0) {
                            setProModel(list[0].value);
                          }
                        }}
                        className="bg-surface border border-subtle rounded-[8px] px-3.5 py-2.5 text-xs text-text focus:outline-none focus:border-ai dark:focus:border-ai transition-colors w-full"
                      >
                        <option value="openrouter" className="dark:bg-surface">OpenRouter (Recomendado)</option>
                        <option value="deepseek" className="dark:bg-surface">DeepSeek Oficial</option>
                        <option value="gemini" className="dark:bg-surface">Gemini Oficial (Google)</option>
                      </select>
                    </div>

                    <div className="space-y-1.5 font-sans">
                      <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider block font-display">Modelo específico</label>
                      <select
                        value={proModel}
                        onChange={(e) => setProModel(e.target.value)}
                        className="bg-surface border border-subtle rounded-[8px] px-3.5 py-2.5 text-xs text-text focus:outline-none focus:border-ai dark:focus:border-ai transition-colors w-full"
                      >
                        {getModelsForPlanAndProvider(modelCatalog, 'pro', proProvider, proModel).map((m) => (
                          <option key={m.value} value={m.value} className="dark:bg-surface">{m.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="mt-2 text-[10px] text-text-muted font-light font-sans">
                    * Puedes añadir o editar los modelos disponibles para este plan en el catálogo inferior.
                  </div>
                </div>

                {/* Submit Buttons */}
                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full bg-text dark:bg-white hover:bg-text/90 dark:hover:bg-surface-muted border border-text dark:border-white text-canvas font-bold py-3.5 rounded-[8px] text-xs transition-all shadow-sm flex items-center justify-center gap-2 font-display cursor-pointer"
                  >
                    <Check className="w-4 h-4 stroke-[1.75]" />
                    Guardar Configuración de IA
                  </button>
                </div>
              </form>
            </div>

            {/* Catálogo de Modelos de IA */}
            <div className="bg-surface p-6 rounded-[12px] border border-subtle shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-subtle pb-4 mb-5">
                <div>
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-ai stroke-[2]" />
                    <h3 className="text-base font-semibold font-display text-text">Catálogo y Listado de Modelos</h3>
                  </div>
                  <p className="text-text-muted text-xs font-light mt-0.5 font-sans">
                    Añade nuevos modelos o edita los existentes. Aparecerán disponibles inmediatamente en los selectores de planes superiores.
                  </p>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                  <button
                    type="button"
                    onClick={handleResetCatalog}
                    className="bg-surface hover:bg-canvas text-text-muted hover:text-text border border-subtle font-bold px-3 py-2 rounded-[8px] text-xs transition-all shadow-xs flex items-center gap-1.5 font-display cursor-pointer"
                    title="Restaurar a los modelos predeterminados del sistema"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Restaurar</span> Predeterminados
                  </button>
                  <button
                    type="button"
                    onClick={openCreateModelModal}
                    className="bg-text dark:bg-white hover:bg-text/90 dark:hover:bg-surface-muted border border-text dark:border-white text-canvas font-bold px-4 py-2 rounded-[8px] text-xs transition-all shadow-sm flex items-center gap-1.5 font-display cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[2]" />
                    <span>Añadir Modelo</span>
                  </button>
                </div>
              </div>

              {/* Filtros y Búsqueda */}
              <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 mb-4 font-sans text-xs">
                {/* Búsqueda */}
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-text-muted stroke-[1.75]" />
                  <input
                    type="text"
                    placeholder="Buscar por nombre o ID del modelo..."
                    value={modelSearchQuery}
                    onChange={(e) => setModelSearchQuery(e.target.value)}
                    className="bg-canvas/50 border border-subtle rounded-[8px] pl-9 pr-3 py-1.5 text-xs text-text focus:outline-none focus:border-ai w-full transition-colors"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {/* Filtro por Proveedor */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider font-display mr-1">Proveedor:</span>
                    {(['all', 'openrouter', 'deepseek', 'gemini'] as const).map((prov) => {
                      const count = prov === 'all'
                        ? modelCatalog.length
                        : modelCatalog.filter((m) => m.provider === prov).length;
                      const labels: Record<string, string> = {
                        all: 'Todos',
                        openrouter: 'OpenRouter',
                        deepseek: 'DeepSeek',
                        gemini: 'Gemini',
                      };
                      const active = modelProviderFilter === prov;
                      return (
                        <button
                          key={prov}
                          type="button"
                          onClick={() => setModelProviderFilter(prov)}
                          className={`px-2.5 py-1 rounded-[6px] text-xs font-semibold font-display transition-all cursor-pointer ${
                            active
                              ? 'bg-ai text-white shadow-xs'
                              : 'bg-canvas/50 text-text-muted hover:text-text border border-subtle'
                          }`}
                        >
                          {labels[prov]} ({count})
                        </button>
                      );
                    })}
                  </div>

                  {/* Filtro por Plan */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider font-display mr-1">Plan:</span>
                    {(['all', 'free', 'pro'] as const).map((plan) => {
                      const active = modelPlanFilter === plan;
                      const labels = { all: 'Todos', free: 'Gratuito', pro: 'Premium' };
                      return (
                        <button
                          key={plan}
                          type="button"
                          onClick={() => setModelPlanFilter(plan)}
                          className={`px-2 py-1 rounded-[6px] text-xs font-semibold font-display transition-all cursor-pointer ${
                            active
                              ? 'bg-text dark:bg-white text-canvas'
                              : 'bg-canvas/50 text-text-muted hover:text-text border border-subtle'
                          }`}
                        >
                          {labels[plan]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Tabla de Modelos */}
              <div className="border border-subtle rounded-[10px] overflow-hidden bg-surface">
                {filteredModelCatalog.length === 0 ? (
                  <div className="p-8 text-center text-text-muted text-xs font-sans">
                    <p>No se encontraron modelos con los filtros seleccionados.</p>
                    <button
                      type="button"
                      onClick={() => { setModelSearchQuery(''); setModelProviderFilter('all'); setModelPlanFilter('all'); }}
                      className="mt-2 text-ai hover:underline font-semibold cursor-pointer"
                    >
                      Limpiar filtros
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs font-sans">
                      <thead className="bg-canvas/50 text-[10px] uppercase font-bold text-text-muted font-display tracking-wider border-b border-subtle">
                        <tr>
                          <th className="px-4 py-3">Nombre del Modelo</th>
                          <th className="px-4 py-3">ID de API (Value)</th>
                          <th className="px-4 py-3">Proveedor</th>
                          <th className="px-4 py-3">Planes</th>
                          <th className="px-4 py-3">Estado</th>
                          <th className="px-4 py-3 text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-subtle">
                        {filteredModelCatalog.map((model) => {
                          const isUsedInFree = freeProvider === model.provider && freeModel === model.value;
                          const isUsedInPro = proProvider === model.provider && proModel === model.value;
                          const isCopied = copiedModelId === model.id;

                          return (
                            <tr key={model.id} className="hover:bg-canvas/30 transition-colors">
                              <td className="px-4 py-3">
                                <div className="font-bold text-text font-display">{model.label}</div>
                                {model.description && (
                                  <div className="text-[11px] text-text-muted font-light truncate max-w-xs">{model.description}</div>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <div className="inline-flex items-center gap-1.5 bg-canvas/70 border border-subtle px-2 py-0.5 rounded-[6px] font-mono text-[11px] text-text">
                                  <span>{model.value}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleCopyModelId(model.id, model.value)}
                                    className="text-text-muted hover:text-ai transition-colors p-0.5 cursor-pointer"
                                    title="Copiar ID de API"
                                  >
                                    {isCopied ? <Check className="w-3 h-3 text-action" /> : <Copy className="w-3 h-3" />}
                                  </button>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`inline-block px-2 py-0.5 rounded-[6px] font-bold text-[10px] font-display uppercase tracking-wider ${
                                  model.provider === 'openrouter'
                                    ? 'bg-ai/10 text-ai border border-ai/20'
                                    : model.provider === 'deepseek'
                                      ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                                      : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                }`}>
                                  {model.provider === 'openrouter' ? 'OpenRouter' : model.provider === 'deepseek' ? 'DeepSeek' : 'Gemini'}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1">
                                  {model.plans.includes('free') && (
                                    <span className="bg-canvas border border-subtle text-text-muted px-1.5 py-0.5 rounded text-[10px] font-bold font-display">
                                      Free
                                    </span>
                                  )}
                                  {model.plans.includes('pro') && (
                                    <span className="bg-ai/10 border border-ai/20 text-ai px-1.5 py-0.5 rounded text-[10px] font-bold font-display flex items-center gap-0.5">
                                      <Crown className="w-2.5 h-2.5" /> Pro
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex flex-wrap items-center gap-1">
                                  {isUsedInFree && (
                                    <span className="bg-action/10 text-success-text border border-action/20 text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-[6px] font-display">
                                      Activo en Free
                                    </span>
                                  )}
                                  {isUsedInPro && (
                                    <span className="bg-ai/15 text-ai border border-ai/30 text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-[6px] font-display">
                                      Activo en Pro
                                    </span>
                                  )}
                                  {!isUsedInFree && !isUsedInPro && (
                                    <span className="text-text-muted text-[11px] font-light italic">
                                      Disponible
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right whitespace-nowrap">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => openEditModelModal(model)}
                                    className="p-1.5 text-text-muted hover:text-ai hover:bg-canvas rounded-[6px] transition-all cursor-pointer"
                                    title="Editar modelo"
                                  >
                                    <Edit className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteModel(model)}
                                    className="p-1.5 text-text-muted hover:text-rose-500 hover:bg-rose-500/10 rounded-[6px] transition-all cursor-pointer"
                                    title="Eliminar modelo del catálogo"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Accordion / Desplegable para OpenRouter API Key Info */}
            <div className="bg-surface p-6 rounded-[12px] border border-subtle shadow-sm">
              <button
                type="button"
                onClick={() => setIsOpenRouterInfoExpanded(!isOpenRouterInfoExpanded)}
                className="w-full flex items-center justify-between p-4 bg-canvas/30 rounded-[12px] border border-subtle hover:bg-surface-muted dark:hover:bg-white/5 transition-all text-text cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-ai" />
                  <span className="text-xs font-bold font-display">Límites y Créditos de OpenRouter</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-text-muted font-light">
                    {isOpenRouterInfoExpanded ? 'Ocultar' : 'Ver créditos y límites'}
                  </span>
                  <ChevronRight className={`w-4 h-4 text-text-muted transition-transform duration-200 ${isOpenRouterInfoExpanded ? 'rotate-90' : ''}`} />
                </div>
              </button>

              {isOpenRouterInfoExpanded && (
                <div className="mt-4 bg-canvas/40 p-5 rounded-[12px] border border-subtle animate-fadeIn">
                  <div className="flex items-center justify-between border-b border-subtle pb-3 mb-4">
                    <div className="flex items-center gap-2">
                      <Terminal className="w-4 h-4 text-ai" />
                      <h4 className="text-xs font-bold text-text font-display">Límites y Créditos de OpenRouter</h4>
                    </div>
                    <button
                      type="button"
                      onClick={fetchOpenRouterKeyInfo}
                      disabled={loadingKeyInfo}
                      className="p-1.5 text-text-muted hover:text-ai dark:hover:text-ai rounded-full hover:bg-surface-muted dark:hover:bg-white/5 transition-all cursor-pointer"
                      title="Recargar límites"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${loadingKeyInfo ? 'animate-spin' : ''}`} />
                    </button>
                  </div>

                  {loadingKeyInfo ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4" aria-busy="true">
                      {times(4).map((index) => (
                        <div key={index} className="bg-surface border border-subtle p-3 rounded-[8px] space-y-2">
                          <Bone className="h-2.5 w-20" />
                          <Bone className="h-5 w-16" />
                        </div>
                      ))}
                    </div>
                  ) : keyInfoError ? (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-500/90 text-[11px] rounded-[8px] flex items-start gap-2.5 font-sans">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
                      <div>
                        <span className="font-bold">Aviso de OpenRouter:</span> {keyInfoError}
                        <p className="mt-1 text-[10px] text-text-muted font-light">Asegúrate de que la variable de entorno <code className="font-mono bg-white dark:bg-black/30 px-1 rounded">OPENROUTER_API_KEY</code> esté configurada en tu archivo <code className="font-mono bg-white dark:bg-black/30 px-1 rounded">.env</code>.</p>
                      </div>
                    </div>
                  ) : openRouterKeyInfo ? (
                    <div className="space-y-4 font-sans text-xs">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div className="bg-surface border border-subtle p-3 rounded-[8px]">
                          <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider block font-display">Créditos Restantes</span>
                          <span className="text-sm font-bold text-success-text font-mono mt-1 block">
                            {openRouterKeyInfo.limit_remaining !== null 
                              ? `$${Number(openRouterKeyInfo.limit_remaining).toFixed(4)}`
                              : 'Ilimitado'}
                          </span>
                        </div>

                        <div className="bg-surface border border-subtle p-3 rounded-[8px]">
                          <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider block font-display">Crédito Límite</span>
                          <span className="text-sm font-bold text-text font-mono mt-1 block">
                            {openRouterKeyInfo.limit !== null 
                              ? `$${Number(openRouterKeyInfo.limit).toFixed(2)}`
                              : 'Ilimitado'}
                          </span>
                        </div>

                        <div className="bg-surface border border-subtle p-3 rounded-[8px]">
                          <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider block font-display">Uso Acumulado</span>
                          <span className="text-sm font-bold text-amber-500 font-mono mt-1 block">
                            ${Number(openRouterKeyInfo.usage).toFixed(4)}
                          </span>
                        </div>

                        <div className="bg-surface border border-subtle p-3 rounded-[8px]">
                          <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider block font-display">Uso Diario</span>
                          <span className="text-sm font-bold text-ai font-mono mt-1 block">
                            ${Number(openRouterKeyInfo.usage_daily).toFixed(4)}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-t border-subtle pt-3 text-[10px] text-text-muted font-light">
                        <div className="flex items-center gap-1.5">
                          <span>Etiqueta Key:</span>
                          <span className="font-mono bg-white dark:bg-black/30 px-1.5 py-0.5 rounded text-text font-bold">{openRouterKeyInfo.label || 'Sin etiqueta'}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span>Nivel:</span>
                          <span className={`px-1.5 py-0.5 rounded font-bold ${
                            openRouterKeyInfo.is_free_tier 
                              ? 'bg-rose-500/10 text-rose-500' 
                              : 'bg-action/10 text-success-text'
                          }`}>
                            {openRouterKeyInfo.is_free_tier ? 'Free Tier (Límite 20 rq/min)' : 'Pro Tier (Saldo cargado)'}
                          </span>
                        </div>
                      </div>

                      {openRouterKeyInfo.is_free_tier && (
                        <div className="mt-3.5 p-3.5 bg-blue-500/5 dark:bg-blue-500/10 border border-blue-500/10 dark:border-blue-500/20 rounded-[8px] text-[10px] text-text-muted dark:text-slate-300 leading-relaxed space-y-1.5 font-sans">
                          <div className="font-bold flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                            <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                            <span>Información de Límites en Cuenta Gratuita (Free Tier)</span>
                          </div>
                          <p>
                            OpenRouter no devuelve un contador de peticiones restantes en su API (se gestiona de manera global), pero aplica las siguientes reglas por día para modelos con terminación <code className="font-mono bg-white dark:bg-black/20 px-1 rounded font-bold">:free</code>:
                          </p>
                          <ul className="list-disc pl-4 space-y-1">
                            <li>
                              <span className="font-bold">Límite actual:</span> Al no tener saldo cargado en tu cuenta, tu límite es de <span className="font-bold text-rose-500 dark:text-rose-450">50 peticiones al día</span>.
                            </li>
                            <li>
                              <span className="font-bold">Cómo subirlo a 1000/día:</span> Si realizas una recarga mínima de <span className="font-bold text-success-text">$10 USD</span> en tu cuenta de OpenRouter, el límite diario de modelos gratuitos subirá automáticamente a <span className="font-bold text-success-text">1000 peticiones al día</span>.
                            </li>
                            <li>
                              <span className="font-bold">Límite de velocidad:</span> Máximo 20 peticiones por minuto.
                            </li>
                          </ul>
                        </div>
                      )}

                      {!openRouterKeyInfo.is_free_tier && (
                        <div className="mt-3.5 p-3.5 bg-action/5 dark:bg-action/10 border border-action/10 dark:border-action/20 rounded-[8px] text-[10px] text-text-muted dark:text-slate-300 leading-relaxed space-y-1.5 font-sans">
                          <div className="font-bold flex items-center gap-1.5 text-success-text">
                            <Sparkles className="w-3.5 h-3.5 text-success-text" />
                            <span>Cuenta OpenRouter con Crédito Activo</span>
                          </div>
                          <p>
                            Al tener saldo en tu cuenta de OpenRouter, cuentas con acceso prioritario y mayores límites de velocidad en todos los modelos compatibles.
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-2 text-text-muted text-xs font-sans">
                      No se pudo cargar la información de límites.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab: Prompts Management */}
        {activeTab === 'prompts' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface p-6 rounded-[12px] border border-subtle shadow-sm text-text">
              <div>
                <h3 className="text-base font-semibold font-display text-text">Biblioteca de Prompts Dinámicos</h3>
                <p className="text-text-muted text-xs font-light mt-0.5 font-sans">Define las directrices del sistema y plantillas de usuario que gobernarán las optimizaciones de IA.</p>
              </div>
              <div className="flex items-center gap-3.5 w-full sm:w-auto shrink-0">
                <button
                  onClick={() => setShowArchived(!showArchived)}
                  className={`px-4 py-2.5 rounded-[8px] text-xs font-bold transition-all border font-display ${
                    showArchived
                      ? 'bg-amber-500/10 text-amber-600 border-amber-500/20 hover:bg-amber-500/20'
                      : 'bg-surface border-subtle text-text-muted hover:text-text dark:hover:text-white hover:bg-canvas dark:hover:bg-canvas/30'
                  }`}
                >
                  {showArchived ? 'Ocultar Archivados' : 'Mostrar Archivados'}
                </button>
                <button
                  onClick={openCreatePromptModal}
                  className="bg-text dark:bg-white hover:bg-text/90 dark:hover:bg-surface-muted border border-text dark:border-white text-canvas font-bold px-4 py-2.5 rounded-[8px] text-xs transition-all shadow-sm flex items-center justify-center gap-1.5 font-display"
                >
                  <Plus className="w-4 h-4 stroke-[1.75]" />
                  Crear Nuevo Prompt
                </button>
              </div>
            </div>

            {promptsList.length === 0 ? (
              <div className="bg-surface border border-subtle border-dashed rounded-[12px] p-16 text-center shadow-sm">
                <div className="bg-canvas border border-control p-4 rounded-full text-text-muted w-fit mx-auto mb-4">
                  <Code className="w-8 h-8 stroke-[1.75]" />
                </div>
                <h4 className="text-base font-semibold font-display text-text mb-1">No hay prompts personalizados en la DB</h4>
                <p className="text-text-muted text-xs font-light max-w-sm mx-auto mb-6 font-sans">
                  El sistema está utilizando los prompts estáticos por defecto. Crea tu primer prompt dinámico para empezar a gestionarlo.
                </p>
                <button
                  onClick={openCreatePromptModal}
                  className="bg-surface hover:bg-canvas dark:hover:bg-canvas/30 text-text font-bold px-4 py-2 rounded-[8px] text-xs border border-subtle transition-all shadow-sm font-display"
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
                    className={`bg-surface p-6 rounded-[12px] border transition-all relative overflow-hidden group shadow-sm ${
                      prompt.isActive 
                        ? 'border-action/60 shadow-lg shadow-action/5' 
                        : prompt.isArchived
                          ? 'border-subtle opacity-60 hover:opacity-100'
                          : 'border-subtle hover:border-control dark:hover:border-white/20'
                    }`}
                  >
                    {/* Glowing side accent for active prompt */}
                    {prompt.isActive && (
                      <div className="absolute top-0 left-0 w-1.5 h-full bg-action" />
                    )}

                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
                      <div>
                        <div className="flex items-center gap-2.5 mb-1.5">
                          <h4 className="font-bold font-display text-text text-base flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full shrink-0 border border-subtle" style={{ backgroundColor: prompt.color || '#8b5cf6' }} />
                            {prompt.name}
                          </h4>
                          {prompt.isActive && (
                            <span className="bg-action/10 text-success-text border border-action/20 text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-[8px] flex items-center gap-0.5 font-display">
                              <Check className="w-2.5 h-2.5 stroke-[1.75]" /> Activo
                            </span>
                          )}
                          {prompt.isArchived && (
                            <span className="bg-amber-500/10 text-amber-600 dark:text-amber-500 border border-amber-500/20 dark:border-amber-500/30 text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-[8px] font-display">
                              Archivado
                            </span>
                          )}
                          {!prompt.isActive && !prompt.isArchived && (
                            <span className="bg-canvas/40 text-text-muted border border-subtle text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-[8px] font-display">
                              Inactivo
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] bg-canvas/40 border border-subtle text-text-muted font-mono px-2 py-0.5 rounded-[8px]">
                          Función: {prompt.key}
                        </span>
                        {prompt.isStrict && (
                          <span className="ml-2 text-[10px] bg-ai/10 border border-ai/20 text-ai font-mono px-2 py-0.5 rounded-[8px] inline-flex items-center gap-1">
                            <Sparkles className="w-2.5 h-2.5 stroke-[1.75] animate-pulse" /> MD Estricto
                          </span>
                        )}
                      </div>

                      {/* Prompts actions toolbar */}
                      <div className="flex items-center gap-2 self-start">
                        {!prompt.isActive && !prompt.isArchived && (
                          <button
                            onClick={() => handleTogglePromptActive(prompt.id, prompt.key)}
                            className="bg-surface hover:bg-canvas dark:hover:bg-canvas/30 text-success-text border border-subtle hover:border-action/30 dark:hover:border-action/40 font-semibold px-3 py-1.5 rounded-[8px] text-[10px] transition-colors font-display"
                          >
                            Activar
                          </button>
                        )}
                        <button
                          onClick={() => handleTogglePromptArchive(prompt.id, !prompt.isArchived)}
                          className={`font-semibold px-3 py-1.5 rounded-[8px] text-[10px] border transition-colors font-display ${
                            prompt.isArchived
                              ? 'text-amber-600 dark:text-amber-500 hover:text-amber-500 bg-surface border-amber-500/20 dark:border-amber-500/30'
                              : 'text-text-muted hover:text-text dark:hover:text-white bg-surface border-subtle hover:bg-canvas dark:hover:bg-canvas/30'
                          }`}
                          disabled={prompt.isActive}
                          title={prompt.isActive ? "No puedes archivar un prompt activo" : ""}
                        >
                          {prompt.isArchived ? 'Desarchivar' : 'Archivar'}
                        </button>
                        <button
                          onClick={() => openEditPromptModal(prompt)}
                          className="bg-surface hover:bg-canvas dark:hover:bg-canvas/30 text-text-muted dark:text-slate-300 hover:text-text dark:hover:text-white p-2 rounded-[8px] border border-subtle transition-colors"
                          title="Editar"
                        >
                          <Edit className="w-3.5 h-3.5 stroke-[1.75]" />
                        </button>
                        {!prompt.isActive && (
                          <button
                            onClick={() => handleDeletePrompt(prompt.id)}
                            className="bg-surface hover:bg-rose-50 dark:hover:bg-rose-955/20 text-text-muted dark:text-slate-555 hover:text-rose-500 dark:hover:text-rose-400 p-2 rounded-[8px] border border-subtle hover:border-rose-200 dark:hover:border-rose-900/30 transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 className="w-3.5 h-3.5 stroke-[1.75]" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3 font-mono text-[10px] text-text-muted dark:text-slate-300">
                      {prompt.description && (
                        <div className="bg-ai/5 dark:bg-ai/10 rounded-[12px] p-4 border border-ai/10 dark:border-violet-500/20 text-xs font-light text-text font-sans leading-relaxed">
                          <span className="block text-[8px] text-ai font-bold uppercase tracking-wider mb-1 font-display">DESCRIPCIÓN DE LA OPTIMIZACIÓN (MOSTRADA AL USUARIO)</span>
                          "{prompt.description}"
                          {(prompt.nameEn || prompt.descriptionEn) && (
                            <div className="mt-2.5 pt-2.5 border-t border-ai/10 dark:border-violet-500/10 space-y-1 text-[10px] text-text-muted">
                              {prompt.nameEn && (
                                <div className="flex items-start gap-1">
                                  <span className="font-bold text-ai font-display uppercase text-[8px] mt-0.5 shrink-0">🇬🇧 Nombre EN:</span>
                                  <span className="font-sans leading-tight">{prompt.nameEn}</span>
                                </div>
                              )}
                              {prompt.descriptionEn && (
                                <div className="flex items-start gap-1">
                                  <span className="font-bold text-ai font-display uppercase text-[8px] mt-0.5 shrink-0">🇬🇧 Descripción EN:</span>
                                  <span className="font-sans leading-tight">"{prompt.descriptionEn}"</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      <div className="bg-canvas/40 rounded-[12px] p-4 border border-subtle">
                        <span className="block text-[9px] text-text-muted font-bold uppercase tracking-wider mb-2 font-display">SYSTEM INSTRUCTION (Directiva de Sistema)</span>
                        <div className="whitespace-pre-wrap leading-relaxed max-h-36 overflow-y-auto pr-1">
                          {prompt.systemPrompt}
                        </div>
                      </div>

                      <div className="bg-canvas/40 rounded-[12px] p-4 border border-subtle">
                        <span className="block text-[9px] text-text-muted font-bold uppercase tracking-wider mb-2 font-display">USER TEMPLATE (Estructura de Usuario)</span>
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
          <div className="space-y-6 animate-fadeIn text-text">
            {/* Tarjetas de Estadísticas de Hoy */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-surface p-5 rounded-[12px] border border-subtle flex items-center justify-between shadow-sm">
                <div>
                  <span className="text-text-muted text-[11px] font-medium font-sans">Registros de Hoy</span>
                  <h4 className="text-2xl font-bold font-display text-text mt-1">
                    {auditStats.registersToday}
                  </h4>
                </div>
                <div className="p-3 bg-ai/10 dark:bg-ai/20 text-ai rounded-lg">
                  <Users className="w-4.5 h-4.5 stroke-[1.75]" />
                </div>
              </div>

              <div className="bg-surface p-5 rounded-[12px] border border-subtle flex items-center justify-between shadow-sm">
                <div>
                  <span className="text-text-muted text-[11px] font-medium font-sans">Inicios de Sesión Hoy</span>
                  <h4 className="text-2xl font-bold font-display text-emerald-600 dark:text-emerald-400 mt-1">
                    {auditStats.loginsToday}
                  </h4>
                </div>
                <div className="p-3 bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-lg">
                  <UserCheck className="w-4.5 h-4.5 stroke-[1.75]" />
                </div>
              </div>

              <div className="bg-surface p-5 rounded-[12px] border border-subtle flex items-center justify-between shadow-sm">
                <div>
                  <span className="text-text-muted text-[11px] font-medium font-sans">CVs Creados Hoy</span>
                  <h4 className="text-2xl font-bold font-display text-ai mt-1">
                    {auditStats.cvsCreatedToday}
                  </h4>
                </div>
                <div className="p-3 bg-ai/10 dark:bg-ai/20 text-ai rounded-lg">
                  <FileText className="w-4.5 h-4.5 stroke-[1.75]" />
                </div>
              </div>

              <div className="bg-surface p-5 rounded-[12px] border border-subtle flex items-center justify-between shadow-sm">
                <div>
                  <span className="text-text-muted text-[11px] font-medium font-sans">Descargas PDF Hoy</span>
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
            <div className="bg-surface p-5 rounded-[12px] border border-subtle shadow-sm flex flex-col md:flex-row items-center justify-between gap-4 font-sans">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto flex-1">
                {/* Búsqueda por Email */}
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-3 w-3.5 h-3.5 text-text-muted stroke-[1.75]" />
                  <input
                    type="text"
                    placeholder="Filtrar por correo o acción..."
                    value={logSearchQuery}
                    onChange={(e) => setLogSearchQuery(e.target.value)}
                    className="bg-canvas/40 border border-subtle rounded-[8px] pl-9 pr-4 py-2 text-xs text-text focus:outline-none focus:border-ai w-full"
                  />
                </div>

                {/* Filtro por Acción */}
                <select
                  value={logActionFilter}
                  onChange={(e) => setLogActionFilter(e.target.value)}
                  className="bg-canvas/40 border border-subtle rounded-[8px] px-3 py-2 text-xs text-text focus:outline-none"
                >
                  <option value="all">Todas las acciones</option>
                  <option value="user_register">Registros tradicionales</option>
                  <option value="user_register_oauth">Registros Google OAuth</option>
                  <option value="user_login">Inicios de sesión</option>
                  <option value="cv_create_manual">CV creados a mano</option>
                  <option value="cv_optimize_ai">CV optimizados con IA</option>
                  <option value="cv_delete">CV eliminados</option>
                  <option value="job_offer_create">Postulación creada</option>
                  <option value="job_offer_status_change">Cambio de estado de postulación</option>
                  <option value="job_offer_update">Postulación editada</option>
                  <option value="job_offer_delete">Postulación borrada</option>
                  <option value="cv_download_pdf">Descargas de PDF</option>
                </select>

                {/* Filtro por Fecha */}
                <select
                  value={logDateFilter}
                  onChange={(e: any) => setLogDateFilter(e.target.value)}
                  className="bg-canvas/40 border border-subtle rounded-[8px] px-3 py-2 text-xs text-text focus:outline-none"
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
                className="bg-surface hover:bg-canvas dark:hover:bg-canvas/30 border border-subtle hover:border-ai/30 text-ai font-bold px-4 py-2.5 rounded-[8px] text-xs transition-all shadow-sm flex items-center justify-center gap-1.5 font-display w-full md:w-auto"
              >
                <Download className="w-3.5 h-3.5 stroke-[1.75]" />
                <span>Exportar Logs (JSON)</span>
              </button>
            </div>

            {/* Listado de Logs de Auditoría */}
            <div className="bg-surface border border-subtle rounded-[12px] shadow-sm overflow-hidden">
              {filteredAuditLogs.length === 0 ? (
                <div className="p-12 text-center text-text-muted text-xs font-light font-sans">
                  No se encontraron registros de auditoría coincidentes con los filtros seleccionados.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-subtle dark:divide-white/10 text-left text-xs font-sans font-light">
                    <thead className="bg-canvas/30 text-[10px] text-text-muted font-bold uppercase tracking-wider font-display">
                      <tr>
                        <th className="px-6 py-4">Fecha & Hora</th>
                        <th className="px-6 py-4">Usuario</th>
                        <th className="px-6 py-4">Acción</th>
                        <th className="px-6 py-4">Red & IP</th>
                        <th className="px-6 py-4">Navegador / SO</th>
                        <th className="px-6 py-4 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-subtle dark:divide-white/5 bg-surface/50">
                      {paginatedAuditLogs.map((log) => (
                         <tr key={log.id} className="hover:bg-canvas dark:hover:bg-canvas/20 transition-colors">
                           <td suppressHydrationWarning className="px-6 py-4 text-text-muted dark:text-slate-300 whitespace-nowrap font-mono">
                             {new Date(log.createdAt).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })}
                           </td>
                           <td className="px-6 py-4 font-semibold text-text whitespace-nowrap font-display">
                             {log.userEmail || 'Desconocido'}
                           </td>
                           <td className="px-6 py-4 whitespace-nowrap">
                             <span className={`px-2.5 py-0.5 rounded-[8px] text-[10px] font-bold font-mono border ${
                               log.action === 'user_register' || log.action === 'user_register_oauth'
                                 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                 : log.action === 'user_login'
                                 ? 'bg-ai/10 text-ai border-ai/20'
                                 : log.action === 'cv_optimize_ai'
                                 ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20'
                                 : log.action === 'cv_download_pdf'
                                 ? 'bg-amber-500/10 text-amber-600 dark:text-amber-500 border-amber-500/20'
                                 : log.action === 'cv_delete' || log.action === 'job_offer_delete'
                                 ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                                 : 'bg-control/10 text-slate-600 dark:text-text-muted border-slate-500/20'
                             }`}>
                               {log.action}
                             </span>
                           </td>
                           <td className="px-6 py-4 text-text-muted dark:text-slate-300 whitespace-nowrap font-mono">
                             {log.ipAddress || 'Sin IP'}
                           </td>
                           <td className="px-6 py-4 text-text-muted truncate max-w-[200px]" title={log.userAgent}>
                             {log.userAgent || 'Sin cabecera'}
                           </td>
                           <td className="px-6 py-4 whitespace-nowrap text-right">
                             <button
                               onClick={() => setSelectedLog(log)}
                               className="bg-surface hover:bg-canvas dark:hover:bg-canvas/30 border border-subtle hover:border-ai/30 dark:hover:border-ai/40 text-ai font-bold px-3 py-1.5 rounded-[8px] text-[10px] transition-all font-display shadow-sm flex items-center justify-center gap-1 ml-auto"
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

               {/* Pagination Controls */}
               {filteredAuditLogs.length > logsPerPage && (
                 <div className="bg-canvas/35 px-6 py-4 border-t border-subtle flex flex-col sm:flex-row items-center justify-between gap-4 font-sans text-xs text-text-muted">
                   <div>
                     Mostrando <span className="font-semibold text-text">{(logCurrentPage - 1) * logsPerPage + 1}</span> - <span className="font-semibold text-text">{Math.min(logCurrentPage * logsPerPage, filteredAuditLogs.length)}</span> de <span className="font-semibold text-text">{filteredAuditLogs.length}</span> registros
                   </div>

                   <div className="flex items-center gap-1.5 flex-wrap justify-center">
                     {/* Previous Button */}
                     <button
                       type="button"
                       disabled={logCurrentPage === 1}
                       onClick={() => setLogCurrentPage(prev => Math.max(prev - 1, 1))}
                       className="px-3 py-1.5 rounded-[6px] border border-subtle bg-surface hover:bg-canvas dark:hover:bg-canvas/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-[11px] font-semibold font-display"
                     >
                       Anterior
                     </button>

                     {/* Page Numbers */}
                     {(() => {
                       const pages = [];
                       const range = 1; // how many pages to show around current page

                       // Always show page 1
                       pages.push(
                         <button
                           key={1}
                           type="button"
                           onClick={() => setLogCurrentPage(1)}
                           className={`w-7 h-7 rounded-[6px] text-[11px] font-semibold transition-all ${logCurrentPage === 1 ? 'bg-ai-action text-on-ai-action shadow-md shadow-ai/20' : 'border border-subtle bg-surface hover:bg-canvas dark:hover:bg-canvas/30'}`}
                         >
                           1
                         </button>
                       );

                       if (logCurrentPage > range + 2) {
                         pages.push(<span key="ell-start" className="px-1 text-text-muted">...</span>);
                       }

                       // Show pages around current
                       for (let i = Math.max(2, logCurrentPage - range); i <= Math.min(totalLogPages - 1, logCurrentPage + range); i++) {
                         pages.push(
                           <button
                             key={i}
                             type="button"
                             onClick={() => setLogCurrentPage(i)}
                             className={`w-7 h-7 rounded-[6px] text-[11px] font-semibold transition-all ${logCurrentPage === i ? 'bg-ai-action text-on-ai-action shadow-md shadow-ai/20' : 'border border-subtle bg-surface hover:bg-canvas dark:hover:bg-canvas/30'}`}
                           >
                             {i}
                           </button>
                         );
                       }

                       if (logCurrentPage < totalLogPages - range - 1) {
                         pages.push(<span key="ell-end" className="px-1 text-text-muted">...</span>);
                       }

                       // Always show last page if > 1
                       if (totalLogPages > 1) {
                         pages.push(
                           <button
                             key={totalLogPages}
                             type="button"
                             onClick={() => setLogCurrentPage(totalLogPages)}
                             className={`w-7 h-7 rounded-[6px] text-[11px] font-semibold transition-all ${logCurrentPage === totalLogPages ? 'bg-ai-action text-on-ai-action shadow-md shadow-ai/20' : 'border border-subtle bg-surface hover:bg-canvas dark:hover:bg-canvas/30'}`}
                           >
                             {totalLogPages}
                           </button>
                         );
                       }

                       return pages;
                     })()}

                     {/* Next Button */}
                     <button
                       type="button"
                       disabled={logCurrentPage === totalLogPages}
                       onClick={() => setLogCurrentPage(prev => Math.min(prev + 1, totalLogPages))}
                       className="px-3 py-1.5 rounded-[6px] border border-subtle bg-surface hover:bg-canvas dark:hover:bg-canvas/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-[11px] font-semibold font-display"
                     >
                       Siguiente
                     </button>
                   </div>
                 </div>
               )}
            </div>
          </div>
        )}
      </main>

      {/* MODAL 1: User Details Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 bg-[#1e1b4b]/40 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-surface border border-subtle w-full max-w-3xl rounded-2xl overflow-hidden shadow-dialog relative text-text">
            <button
              onClick={() => setSelectedUser(null)}
              className="absolute top-5 right-5 text-text-muted hover:text-text dark:hover:text-white p-2 rounded-[8px] bg-canvas/45 border border-subtle hover:bg-canvas/80 transition-all z-10 shadow-sm"
            >
              <X className="w-4 h-4 stroke-[1.75]" />
            </button>

            {/* Profile banner */}
            <div className="bg-canvas/25 p-6 border-b border-subtle">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-2">
                <div>
                  <span className="text-[9px] font-bold text-text-muted uppercase tracking-widest block mb-0.5 font-display">FICHA DETALLADA DE CANDIDATO</span>
                  <h3 className="text-xl font-bold font-display text-text leading-tight">
                    {selectedUser.name || 'Sin nombre'}
                  </h3>
                  <p className="text-text-muted text-xs font-light font-sans">{selectedUser.email}</p>
                </div>

                {/* Sub status pill */}
                <div className="flex items-center gap-2">
                  {selectedUser.role === 'admin' ? (
                    <span className="bg-ai/10 text-ai border border-ai/20 dark:border-violet-500/30 text-[10px] font-bold px-3 py-1 rounded-[8px] flex items-center gap-1 shadow-sm font-display">
                      <Shield className="w-3.5 h-3.5 stroke-[1.75]" /> Administrador
                    </span>
                  ) : (
                    <span className="bg-canvas/40 text-text-muted border border-subtle text-[10px] font-bold px-3 py-1 rounded-[8px] font-display">
                      Usuario Ordinario
                    </span>
                  )}

                  {selectedUser.subscriptionStatus === 'active' ? (
                    <span className="bg-action/10 text-success-text border border-action/20 dark:border-action/35 text-[10px] font-bold px-3 py-1 rounded-[8px] flex items-center gap-1 shadow-sm font-display">
                      <Crown className="w-3.5 h-3.5 text-success-text stroke-[1.75]" /> Premium PRO
                    </span>
                  ) : (
                    <span className="bg-canvas/40 text-text-muted border border-subtle text-[10px] font-medium px-3 py-1 rounded-[8px] font-display">
                      Suscripción: Inactiva
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto scrollbar-custom">
              
              {/* Administrative Actions */}
              <div className="bg-canvas/35 p-5 rounded-[12px] border border-subtle">
                <h4 className="text-xs font-bold text-text mb-3 flex items-center gap-1.5 font-display">
                  <UserCheck className="w-4 h-4 text-ai stroke-[1.75]" />
                  Herramientas Administrativas de Soporte
                </h4>

                <div className="flex flex-wrap items-center gap-4">
                  {/* Role Toggle */}
                  <div className="space-y-1.5 font-sans">
                    <span className="text-[10px] font-bold text-text-muted uppercase tracking-wide block font-display">Rango de Seguridad</span>
                    <button
                      onClick={() => handleToggleUserRole(selectedUser.id, selectedUser.role)}
                      className={`px-4 py-2 rounded-[8px] text-xs font-bold transition-all border flex items-center gap-1.5 font-display shadow-sm ${
                        selectedUser.role === 'admin'
                          ? 'bg-ai/10 dark:bg-ai/20 border-ai/20 dark:border-violet-500/30 text-ai'
                          : 'bg-surface border-subtle hover:bg-canvas dark:hover:bg-canvas/35 text-text'
                      }`}
                    >
                      <Shield className="w-3.5 h-3.5 stroke-[1.75]" />
                      <span>{selectedUser.role === 'admin' ? 'Quitar Admin' : 'Hacer Administrador'}</span>
                    </button>
                  </div>

                  {/* Subscription Toggle */}
                  <div className="space-y-1.5 font-sans">
                    <span className="text-[10px] font-bold text-text-muted uppercase tracking-wide block font-display">Suscripción Manual</span>
                    <div className="flex items-center gap-1 bg-surface p-1 border border-subtle rounded-[8px]">
                      <button
                        onClick={() => handleUpdateSubscription(selectedUser.id, 'active')}
                        className={`px-3 py-1.5 rounded-[8px] text-xs font-bold transition-colors ${
                          selectedUser.subscriptionStatus === 'active'
                            ? 'bg-action text-on-action'
                            : 'text-text-muted hover:text-text dark:hover:text-white'
                        }`}
                      >
                        Activar PRO
                      </button>
                      <button
                        onClick={() => handleUpdateSubscription(selectedUser.id, 'none')}
                        className={`px-3 py-1.5 rounded-[8px] text-xs font-bold transition-colors ${
                          selectedUser.subscriptionStatus !== 'active'
                            ? 'bg-canvas text-text-muted dark:text-text'
                            : 'text-text-muted hover:text-text dark:hover:text-white'
                        }`}
                      >
                        Desactivar
                      </button>
                    </div>
                  </div>
                </div>

<div className="mt-3 text-[10px] text-text-muted flex items-start gap-1 font-light leading-relaxed font-sans">
                  <AlertTriangle className="w-3 h-3 text-text-muted shrink-0 mt-0.5 stroke-[1.75]" />
                  <span>
                    El cambio de suscripción manual sobreescribe directamente en la base de datos sin afectar a los cobros activos en Stripe. Ideal para cuentas de pruebas o soporte temporal.
                  </span>
                </div>
              </div>

              {/* Dynamic user stats details */}
              {loadingDetails ? (
                <AdminUserDetailsSkeleton />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* CVs card list */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-text flex items-center gap-1.5 border-b border-subtle pb-2 font-display">
                      <FileText className="w-4 h-4 text-ai stroke-[1.75]" />
                      Currículums ({userDetails?.cvs.length || 0})
                    </h4>

                    {userDetails?.cvs.length === 0 ? (
                      <div className="text-text-muted text-[11px] font-light bg-canvas/40 p-4 rounded-[12px] border border-subtle text-center font-sans">
                        Este usuario no ha creado ningún CV todavía.
                      </div>
                    ) : (
                      <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1 scrollbar-custom font-sans">
                        {userDetails?.cvs.map((cv: any) => (
                          <div key={cv.id} className="p-3 bg-canvas/40 rounded-[8px] border border-subtle flex items-center justify-between text-xs">
                            <div>
                              <span className="font-semibold text-text block truncate max-w-[200px] font-display">{cv.title}</span>
                              <span className="text-[10px] text-text-muted font-light block mt-0.5">
                                Template: <span className="capitalize">{cv.templateName}</span> • Margen: {cv.pageMargin}
                              </span>
                            </div>
                            <span className="text-[9px] bg-surface text-text-muted border border-subtle px-2 py-0.5 rounded font-display shadow-sm">
                              {cv.isBase ? 'CV Base' : 'Copia'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Lista de postulaciones */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-text flex items-center gap-1.5 border-b border-subtle pb-2 font-display">
                      <Kanban className="w-4 h-4 text-ai stroke-[1.75]" />
                      Postulaciones ({userDetails?.offers.length || 0})
                    </h4>

                    {userDetails?.offers.length === 0 ? (
                      <div className="text-text-muted text-[11px] font-light bg-canvas/40 p-4 rounded-[12px] border border-subtle text-center font-sans">
                        El usuario no ha enlazado ofertas en su tablero.
                      </div>
                    ) : (
                      <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1 scrollbar-custom font-sans">
                        {userDetails?.offers.map((offer: any) => (
                          <div key={offer.id} className="p-3 bg-canvas/40 rounded-[8px] border border-subtle flex items-center justify-between text-xs">
                            <div>
                              <span className="font-semibold text-text block truncate max-w-[180px] font-display">{offer.title}</span>
                              <span className="text-[10px] text-text-muted font-light block mt-0.5">
                                {offer.company} • Vía: <span className="capitalize">{offer.platform}</span>
                              </span>
                            </div>
                            
                            {/* status badges */}
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded capitalize font-display shadow-sm ${
                              offer.status === 'offer' ? 'bg-action/10 text-success-text' :
                              offer.status === 'interview' ? 'bg-amber-500/10 text-amber-600' :
                              offer.status === 'rejected' ? 'bg-rose-500/10 text-rose-600' :
                              'bg-surface text-text-muted border border-subtle'
                            }`}>
                              {offer.status === 'interested' ? 'Interesado' :
                               offer.status === 'applied' ? 'Postulado' :
                               offer.status === 'interview' ? 'Entrevista' :
                               offer.status === 'offer' ? (
                                 <span className="flex items-center gap-1">
                                   Oferta <PartyPopper className="w-3 h-3 text-success-text stroke-[1.75]" />
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
            <div className="p-4 bg-surface/85 border-t border-subtle flex justify-end font-display">
              <button
                onClick={() => setSelectedUser(null)}
                className="bg-surface hover:bg-canvas dark:hover:bg-canvas/30 text-text-muted hover:text-text dark:hover:text-white font-bold px-5 py-2 rounded-[8px] text-xs border border-subtle transition-colors shadow-sm"
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
          <div className="bg-surface border border-subtle w-full max-w-2xl rounded-2xl overflow-hidden shadow-dialog relative text-text">
            <button
              onClick={() => setIsPromptModalOpen(false)}
              className="absolute top-5 right-5 text-text-muted hover:text-text dark:hover:text-white p-2 rounded-[8px] bg-canvas/45 border border-subtle hover:bg-canvas/80 transition-all z-10 shadow-sm"
            >
              <X className="w-4 h-4 stroke-[1.75]" />
            </button>

            <form onSubmit={handlePromptFormSubmit}>
              <div className="bg-canvas/25 p-6 border-b border-subtle">
                <div className="mt-2">
                  <span className="text-[9px] font-bold text-text-muted uppercase tracking-widest block mb-0.5 font-display">EDITOR DE PROMPTS DINÁMICOS</span>
                  <h3 className="text-lg font-bold text-text font-display">
                    {promptForm.id ? 'Editar Prompt Existente' : 'Crear Nuevo Prompt de Optimización'}
                  </h3>
                  <p className="text-text-muted text-xs font-light font-sans">Asocia directrices directas al motor de inteligencia artificial.</p>
                </div>
              </div>

              <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto text-xs font-light scrollbar-custom">
                
                {/* Name */}
                <div className="space-y-1.5 font-sans">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider block font-display">Nombre Descriptivo</label>
                  <input
                    type="text"
                    value={promptForm.name}
                    onChange={(e) => setPromptForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g. Asesor Harvard Avanzado"
                    className="bg-surface border border-subtle rounded-[8px] px-3.5 py-2.5 text-xs text-text placeholder-text-muted focus:outline-none focus:border-ai dark:focus:border-ai transition-colors w-full font-sans"
                    required
                  />
                </div>

                {/* Description */}
                <div className="space-y-1.5 font-sans">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider block font-display">Descripción para el Usuario</label>
                  <textarea
                    value={promptForm.description}
                    onChange={(e) => setPromptForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="e.g. Foco absoluto en superar el filtro ATS. Adapta tu CV e inyecta cualquier tecnología o requisito crítico exigido por la oferta..."
                    className="bg-surface border border-subtle rounded-[8px] px-3.5 py-2.5 text-xs text-text placeholder-text-muted focus:outline-none focus:border-ai dark:focus:border-ai transition-colors h-20 w-full resize-none font-sans leading-relaxed"
                    maxLength={300}
                  />
                  <span className="text-[9px] text-text-muted font-light block mt-0.5 leading-normal">
                    * Esta descripción se le mostrará directamente al usuario final en la ventana de selección de optimización por IA. Si se deja vacía, se utilizará una descripción genérica estándar. Máximo 300 caracteres.
                  </span>
                </div>

                {/* English Translation Collapsible */}
                <div className="border border-subtle rounded-[8px] overflow-hidden font-sans">
                  <button
                    type="button"
                    onClick={() => setShowEnglishFields(!showEnglishFields)}
                    className="flex items-center justify-between w-full px-3.5 py-2.5 bg-surface-muted/50 dark:bg-surface-muted/30 hover:bg-surface-muted dark:hover:bg-surface-muted/50 text-xs font-semibold text-text-muted dark:text-slate-300 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm">🇬🇧</span>
                      <span>Traducción al Inglés (Opcional / Optional)</span>
                    </div>
                    <svg
                      className={`w-4 h-4 text-text-muted transition-transform duration-200 ${showEnglishFields ? 'rotate-180' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {showEnglishFields && (
                    <div className="p-4 space-y-4 bg-white/50 dark:bg-black/10 border-t border-subtle transition-all duration-300">
                      {/* Name EN */}
                      <div className="space-y-1.5 font-sans">
                        <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider block font-display">English Descriptive Name</label>
                        <input
                          type="text"
                          value={promptForm.nameEn}
                          onChange={(e) => setPromptForm(prev => ({ ...prev, nameEn: e.target.value }))}
                          placeholder="e.g. Advanced Harvard Advisor"
                          className="bg-surface border border-subtle rounded-[8px] px-3.5 py-2.5 text-xs text-text placeholder-text-muted focus:outline-none focus:border-ai dark:focus:border-ai transition-colors w-full font-sans"
                        />
                      </div>

                      {/* Description EN */}
                      <div className="space-y-1.5 font-sans">
                        <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider block font-display">English Description for User</label>
                        <textarea
                          value={promptForm.descriptionEn}
                          onChange={(e) => setPromptForm(prev => ({ ...prev, descriptionEn: e.target.value }))}
                          placeholder="e.g. Absolute focus on passing ATS filters. Adapts your CV to target key requirements..."
                          className="bg-surface border border-subtle rounded-[8px] px-3.5 py-2.5 text-xs text-text placeholder-text-muted focus:outline-none focus:border-ai dark:focus:border-ai transition-colors h-20 w-full resize-none font-sans leading-relaxed"
                          maxLength={300}
                        />
                        <span className="text-[9px] text-text-muted font-light block mt-0.5 leading-normal">
                          * If filled, this will be shown to users who have their language set to English. If left blank, the Spanish description/name will be used as fallback.
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Color Selector */}
                <div className="space-y-1.5 font-sans">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider block font-display">Color Temático del Modo</label>
                  <div className="flex items-center gap-3">
                    {/* Color Input */}
                    <div className="relative w-8 h-8 rounded-[8px] overflow-hidden border border-control dark:border-white/15 shrink-0 hover:scale-105 active:scale-95 transition-transform">
                      <input
                        type="color"
                        value={promptForm.color}
                        onChange={(e) => setPromptForm(prev => ({ ...prev, color: e.target.value }))}
                        className="absolute inset-[-4px] w-[calc(100%+8px)] h-[calc(100%+8px)] cursor-pointer"
                      />
                    </div>
                    {/* Color Presets */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {[
                        { hex: '#8b5cf6', label: 'Violeta' },
                        { hex: '#38bdf8', label: 'Cian' },
                        { hex: '#eab308', label: 'Oro' },
                        { hex: '#ea580c', label: 'Naranja' },
                        { hex: '#10b981', label: 'Esmeralda' },
                        { hex: '#f43f5e', label: 'Rosa' },
                      ].map((preset) => (
                        <button
                          key={preset.hex}
                          type="button"
                          onClick={() => setPromptForm(prev => ({ ...prev, color: preset.hex }))}
                          className="w-5 h-5 rounded-full border transition-all hover:scale-110 active:scale-95 flex items-center justify-center"
                          style={{ 
                            backgroundColor: preset.hex,
                            borderColor: promptForm.color.toLowerCase() === preset.hex.toLowerCase() ? 'white' : 'transparent',
                            boxShadow: promptForm.color.toLowerCase() === preset.hex.toLowerCase() ? `0 0 0 2px ${preset.hex}` : 'none'
                          }}
                          title={preset.label}
                        />
                      ))}
                    </div>
                    <span className="text-[10px] font-mono text-text-muted select-all">{promptForm.color.toUpperCase()}</span>
                  </div>
                  <span className="text-[9px] text-text-muted font-light block mt-0.5 leading-normal">
                    * El color se utilizará para destacar visualmente el modo de optimización en la pantalla del usuario (puntos de estado, bordes seleccionados y brillos).
                  </span>
                </div>

                {/* Key (Associated Function) */}
                <div className="space-y-1.5 font-sans">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider block font-display">Función Asociada (Key)</label>
                  <select
                    value={promptForm.key}
                    onChange={(e) => setPromptForm(prev => ({ ...prev, key: e.target.value }))}
                    className="bg-surface border border-subtle rounded-[8px] px-3.5 py-2.5 text-xs text-text focus:outline-none focus:border-ai dark:focus:border-ai transition-colors w-full font-sans"
                  >
                    <option value="optimize_cv" className="dark:bg-surface">optimize_cv (Optimizar CV para Ofertas de Empleo)</option>
                    <option value="import_cv" className="dark:bg-surface">import_cv (Importar/Convertir CV a Markdown)</option>
                    <option value="star_analyze" className="dark:bg-surface">star_analyze (Análisis de Match IA)</option>
                  </select>
                  <span className="text-[10px] text-text-muted font-light block mt-0.5">
                    * Selecciona la clave de función correspondiente para asociar el prompt a un flujo específico.
                  </span>
                </div>

                {/* Strict Mode Checkbox */}
                <div className="flex items-center gap-3 bg-ai/5 dark:bg-ai/10 border border-ai/10 dark:border-violet-500/20 p-3.5 rounded-[12px] mb-4">
                  <input
                    type="checkbox"
                    id="isStrict"
                    checked={promptForm.isStrict}
                    onChange={(e) => setPromptForm(prev => ({ ...prev, isStrict: e.target.checked }))}
                    className="rounded bg-canvas border-control dark:border-white/20 text-ai focus:ring-ai/20 w-4 h-4 cursor-pointer accent-ai"
                  />
                  <div className="flex flex-col">
                    <label htmlFor="isStrict" className="text-xs font-bold text-ai cursor-pointer select-none flex items-center gap-1.5 font-display">
                      <Sparkles className="w-3.5 h-3.5 text-ai stroke-[1.75] animate-pulse" />
                      Regla superestricta de formato Markdown (.MD)
                    </label>
                    <span className="text-[10px] text-text-muted font-light mt-0.5 font-sans">
                      Fuerza al modelo de IA a omitir explicaciones adicionales y bloques de código, devolviendo únicamente Markdown estructurado.
                    </span>
                  </div>
                </div>

                {/* System Prompt */}
                <div className="space-y-1.5 font-sans">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider block font-display">System Prompt (Directrices)</label>
                  <textarea
                    value={promptForm.systemPrompt}
                    onChange={(e) => setPromptForm(prev => ({ ...prev, systemPrompt: e.target.value }))}
                    placeholder="Eres un redactor experto en CVs estilo Harvard. Analiza la oferta e integra palabras clave..."
                    className="bg-surface border border-subtle rounded-[12px] px-3.5 py-2.5 text-xs text-text placeholder-text-muted focus:outline-none focus:border-ai dark:focus:border-ai transition-colors h-28 font-mono leading-relaxed w-full resize-none"
                    required
                  />
                </div>

                {/* User Prompt */}
                <div className="space-y-1.5 font-sans">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider block font-display">User Prompt Template (Plantilla de Datos)</label>
                  <textarea
                    value={promptForm.userPrompt}
                    onChange={(e) => setPromptForm(prev => ({ ...prev, userPrompt: e.target.value }))}
                    placeholder="CV Base:\n{{cv}}\n\nOferta:\n{{job}}"
                    className="bg-surface border border-subtle rounded-[12px] px-3.5 py-2.5 text-xs text-text placeholder-text-muted focus:outline-none focus:border-ai dark:focus:border-ai transition-colors h-24 font-mono leading-relaxed w-full resize-none"
                    required
                  />
                  <span className="text-[10px] text-text-muted font-light block mt-0.5">
                    * Utiliza obligatoriamente los marcadores <code className="text-ai font-mono font-bold">{"{{cv}}"}</code> y <code className="text-ai font-mono font-bold">{"{{job}}"}</code> para indicarle al servicio dónde inyectar los datos reales del usuario.
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
                      className="rounded bg-canvas border-control dark:border-white/20 text-ai focus:ring-ai/20 w-4 h-4 cursor-pointer accent-ai"
                    />
                    <label htmlFor="isActive" className="text-xs font-semibold text-text-muted dark:text-text cursor-pointer select-none">
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
                      className="rounded bg-canvas border-control dark:border-white/20 text-ai focus:ring-ai/20 w-4 h-4 cursor-pointer disabled:opacity-50 accent-ai"
                    />
                    <label htmlFor="isArchived" className="text-xs font-semibold text-text-muted dark:text-text cursor-pointer select-none">
                      Archivar prompt (no se mostrará a los usuarios durante la optimización)
                    </label>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 bg-surface/85 border-t border-subtle flex justify-end gap-3 font-display">
                <button
                  type="button"
                  onClick={() => setIsPromptModalOpen(false)}
                  className="bg-surface hover:bg-canvas dark:hover:bg-canvas/30 text-text-muted hover:text-text dark:hover:text-white font-bold px-4 py-2 rounded-[8px] text-xs border border-subtle transition-colors shadow-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-text dark:bg-white hover:bg-text/90 dark:hover:bg-surface-muted border border-text dark:border-white text-canvas font-bold px-5 py-2 rounded-[8px] text-xs transition-all shadow-sm flex items-center gap-1.5 font-display"
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
          <div className="bg-surface border border-control dark:border-white/10 rounded-[16px] w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="px-6 py-5 bg-canvas border-b border-subtle flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-ai/10 text-ai rounded-lg">
                  <Terminal className="w-4 h-4 stroke-[1.75]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-text font-display">Detalles del Evento</h3>
                  <p className="text-[10px] text-text-muted font-light mt-0.5">ID: {selectedLog.id}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-text-muted hover:text-text dark:hover:text-white hover:bg-surface-muted dark:hover:bg-white/5 p-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4 stroke-[1.75]" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs font-sans text-text">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3.5 bg-canvas/40 rounded-xl border border-subtle">
                  <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider block mb-1">ACCIÓN REGISTRADA</span>
                  <span className="text-ai font-bold font-mono text-[11px] bg-ai/10 dark:bg-violet-950/40 px-2 py-0.5 rounded-md border border-ai/10 w-fit block">{selectedLog.action}</span>
                </div>
                <div className="p-3.5 bg-canvas/40 rounded-xl border border-subtle">
                  <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider block mb-1">FECHA & HORA</span>
                  <span suppressHydrationWarning className="text-text font-semibold">{new Date(selectedLog.createdAt).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })}</span>
                </div>
                <div className="p-3.5 bg-canvas/40 rounded-xl border border-subtle col-span-2">
                  <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider block mb-1">USUARIO ASOCIADO</span>
                  <span className="text-text font-semibold block">{selectedLog.userEmail || 'Desconocido / No Registrado'}</span>
                  {selectedLog.userId && (
                    <span className="text-[10px] text-text-muted block mt-0.5 font-mono">ID: {selectedLog.userId}</span>
                  )}
                </div>
                <div className="p-3.5 bg-canvas/40 rounded-xl border border-subtle">
                  <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider block mb-1">DIRECCIÓN IP</span>
                  <span className="text-text font-mono font-semibold">{selectedLog.ipAddress || 'No capturada'}</span>
                </div>
                <div className="p-3.5 bg-canvas/40 rounded-xl border border-subtle">
                  <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider block mb-1">DISPOSITIVO (USER AGENT)</span>
                  <span className="text-text block truncate font-sans" title={selectedLog.userAgent}>{selectedLog.userAgent || 'No capturado'}</span>
                </div>
              </div>

              {/* JSON Payload Details */}
              <div className="space-y-1.5 font-sans">
                <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider block font-display">PAYLOAD / DETALLES DE LA ACCIÓN</span>
                <div className="bg-canvas/40 border border-subtle rounded-[12px] p-4 font-mono text-[11px] leading-relaxed overflow-x-auto text-text dark:text-emerald-300 max-h-52">
                  <pre>{JSON.stringify(JSON.parse(selectedLog.details || '{}'), null, 2)}</pre>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-canvas border-t border-subtle flex justify-end font-display">
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="bg-text dark:bg-white hover:bg-text/90 dark:hover:bg-surface-muted border border-text dark:border-white text-canvas font-bold px-5 py-2.5 rounded-[8px] text-xs transition-all shadow-sm"
              >
                Cerrar Detalles
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Añadir / Editar Modelo de IA */}
      {isModelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div
            className="bg-surface border border-subtle rounded-[16px] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-subtle flex items-center justify-between bg-canvas/40">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-ai stroke-[2]" />
                <h3 className="text-base font-semibold font-display text-text">
                  {editingModelId ? 'Editar Modelo de IA' : 'Añadir Nuevo Modelo de IA'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModelModalOpen(false)}
                className="p-1 rounded-full text-text-muted hover:text-text hover:bg-surface transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveModel} className="p-6 space-y-4 font-sans text-xs">
              {/* Proveedor */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider block font-display">
                  Proveedor de API *
                </label>
                <select
                  value={modelFormData.provider}
                  onChange={(e) => setModelFormData({ ...modelFormData, provider: e.target.value as AiProvider })}
                  className="bg-canvas border border-subtle rounded-[8px] px-3.5 py-2.5 text-xs text-text focus:outline-none focus:border-ai w-full font-medium"
                >
                  <option value="openrouter">OpenRouter (Recomendado)</option>
                  <option value="deepseek">DeepSeek Oficial</option>
                  <option value="gemini">Gemini Oficial (Google)</option>
                </select>
              </div>

              {/* Nombre / Etiqueta */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider block font-display">
                  Nombre / Etiqueta del Modelo *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Claude 3.7 Sonnet o Gemini 2.5 Pro"
                  value={modelFormData.label}
                  onChange={(e) => setModelFormData({ ...modelFormData, label: e.target.value })}
                  className="bg-canvas border border-subtle rounded-[8px] px-3.5 py-2.5 text-xs text-text focus:outline-none focus:border-ai w-full font-medium"
                />
                <p className="text-[10px] text-text-muted font-light">
                  Es el nombre descriptivo que verás en las listas y selectores de la app.
                </p>
              </div>

              {/* Identificador de API (Value) */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider block font-display">
                  Identificador Técnico en la API (Model ID) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: anthropic/claude-3.7-sonnet o gemini-2.5-pro"
                  value={modelFormData.value}
                  onChange={(e) => setModelFormData({ ...modelFormData, value: e.target.value })}
                  className="bg-canvas border border-subtle rounded-[8px] px-3.5 py-2.5 text-xs text-text focus:outline-none focus:border-ai w-full font-mono font-medium"
                />
                <p className="text-[10px] text-text-muted font-light">
                  Debe coincidir exactamente con el identificador que espera el proveedor (ej. <code className="font-mono bg-canvas px-1 py-0.5 rounded text-ai">deepseek-chat</code>, <code className="font-mono bg-canvas px-1 py-0.5 rounded text-ai">gemini-3.5-flash-lite</code> o <code className="font-mono bg-canvas px-1 py-0.5 rounded text-ai">meta-llama/llama-3.3-70b-instruct:free</code>).
                </p>
              </div>

              {/* Planes donde estará disponible */}
              <div className="space-y-1.5 pt-1">
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider block font-display">
                  Disponible para los planes *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex items-center gap-2.5 p-3 bg-canvas/50 border border-subtle rounded-[8px] cursor-pointer hover:bg-canvas transition-colors">
                    <input
                      type="checkbox"
                      checked={modelFormData.plans.includes('free')}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...modelFormData.plans, 'free' as const]
                          : modelFormData.plans.filter((p) => p !== 'free');
                        setModelFormData({ ...modelFormData, plans: next });
                      }}
                      className="w-4 h-4 rounded text-ai focus:ring-ai border-subtle"
                    />
                    <div>
                      <span className="font-bold text-text block font-display">Plan Gratuito</span>
                      <span className="text-[10px] text-text-muted font-light">Disponible para usuarios Free</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2.5 p-3 bg-canvas/50 border border-subtle rounded-[8px] cursor-pointer hover:bg-canvas transition-colors">
                    <input
                      type="checkbox"
                      checked={modelFormData.plans.includes('pro')}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...modelFormData.plans, 'pro' as const]
                          : modelFormData.plans.filter((p) => p !== 'pro');
                        setModelFormData({ ...modelFormData, plans: next });
                      }}
                      className="w-4 h-4 rounded text-ai focus:ring-ai border-subtle"
                    />
                    <div>
                      <span className="font-bold text-ai block font-display flex items-center gap-1">
                        <Crown className="w-3 h-3" /> Plan Premium
                      </span>
                      <span className="text-[10px] text-text-muted font-light">Disponible para usuarios Pro</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Descripción Opcional */}
              <div className="space-y-1 pt-1">
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider block font-display">
                  Notas / Descripción (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ej: Modelo rápido para pruebas o razonamiento avanzado"
                  value={modelFormData.description}
                  onChange={(e) => setModelFormData({ ...modelFormData, description: e.target.value })}
                  className="bg-canvas border border-subtle rounded-[8px] px-3.5 py-2 text-xs text-text focus:outline-none focus:border-ai w-full font-light"
                />
              </div>

              {/* Botones de acción del modal */}
              <div className="pt-4 border-t border-subtle flex items-center justify-end gap-2.5 font-display">
                <button
                  type="button"
                  onClick={() => setIsModelModalOpen(false)}
                  className="px-4 py-2 rounded-[8px] text-xs font-semibold text-text-muted hover:text-text hover:bg-canvas transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-text dark:bg-white hover:bg-text/90 dark:hover:bg-surface-muted text-canvas font-bold px-5 py-2 rounded-[8px] text-xs transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5 stroke-[2]" />
                  <span>{editingModelId ? 'Guardar Cambios' : 'Añadir al Catálogo'}</span>
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
