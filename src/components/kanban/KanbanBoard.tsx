"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import NextLink from 'next/link';
import { JobOffer, CV } from '@/db/schema';
import KanbanCard from './KanbanCard';
import JobOfferDetailsModal from './JobOfferDetailsModal';
import { createJobOffer, updateJobOfferStatus, analyzeFailuresAction } from '@/app/dashboard/kanban/actions';
import { formatDate } from '@/lib/utils';
import { Plus, X, Briefcase, Building2, Link, FileText, CheckCircle2, RefreshCw, Bookmark, Send, Calendar, PartyPopper, Ban, Search, SlidersHorizontal, Minimize2, Maximize2, Link2, ListChecks, Archive, Eye, Inbox, Clipboard, Check, Bot, Sparkles, SendHorizontal, MessageSquare } from 'lucide-react';
import { DragDropContext, Droppable } from '@hello-pangea/dnd';
import { useLanguage } from '@/lib/i18n/LanguageContext';

interface KanbanBoardProps {
  offers: JobOffer[];
  userCvs: CV[];
}

interface Column {
  id: 'interested' | 'applied' | 'interview' | 'offer' | 'rejected';
  title: string;
  shortTitle: string;
  description: string;
  color: string;
  borderColor: string;
  glowColor: string;
}

const ARCHIVED_STATUS_PREFIX = 'archived:';

function isArchivedStatus(status: string) {
  return status.startsWith(ARCHIVED_STATUS_PREFIX);
}

export default function KanbanBoard({ offers, userCvs }: KanbanBoardProps) {
  const router = useRouter();
  const { t, language } = useLanguage();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedOfferForDetails, setSelectedOfferForDetails] = useState<JobOffer | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [cvFilter, setCvFilter] = useState<'all' | 'linked' | 'unlinked'>('all');
  const [viewMode, setViewMode] = useState<'compact' | 'comfortable'>('compact');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | '7days' | 'custom'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isDateDropdownOpen, setIsDateDropdownOpen] = useState(false);

  // Copy Modal States
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [copyDateFilter, setCopyDateFilter] = useState<'all' | 'today' | '7days' | 'custom'>('all');
  const [copyStartDate, setCopyStartDate] = useState('');
  const [copyEndDate, setCopyEndDate] = useState('');
  const [copied, setCopied] = useState(false);

  // Sync copy filters with active board filters when copy modal opens
  useEffect(() => {
    if (isCopyModalOpen) {
      setCopyDateFilter(dateFilter);
      setCopyStartDate(startDate);
      setCopyEndDate(endDate);
      setCopied(false);
    }
  }, [isCopyModalOpen, dateFilter, startDate, endDate]);

  const getFilteredOffersForCopy = () => {
    return localOffers.filter((offer) => {
      if (isArchivedStatus(offer.status)) return false;

      let matchesDateFilter = true;
      if (copyDateFilter !== 'all') {
        const offerDate = new Date(offer.createdAt);
        offerDate.setHours(0, 0, 0, 0);
        const offerTime = offerDate.getTime();

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayTime = today.getTime();

        if (copyDateFilter === 'today') {
          matchesDateFilter = offerTime === todayTime;
        } else if (copyDateFilter === '7days') {
          const sevenDaysAgo = new Date(today);
          sevenDaysAgo.setDate(today.getDate() - 7);
          const sevenDaysAgoTime = sevenDaysAgo.getTime();
          matchesDateFilter = offerTime >= sevenDaysAgoTime && offerTime <= todayTime;
        } else if (copyDateFilter === 'custom') {
          if (copyStartDate) {
            const start = new Date(copyStartDate + 'T00:00:00');
            matchesDateFilter = matchesDateFilter && offerTime >= start.getTime();
          }
          if (copyEndDate) {
            const end = new Date(copyEndDate + 'T00:00:00');
            matchesDateFilter = matchesDateFilter && offerTime <= end.getTime();
          }
        }
      }
      return matchesDateFilter;
    });
  };

  const getOffersReportText = (filterType: 'all' | 'today' | '7days' | 'custom', startVal: string, endVal: string, limitForAi = false) => {
    let targetOffers = localOffers.filter((offer) => {
      if (isArchivedStatus(offer.status)) return false;

      let matchesDateFilter = true;
      if (filterType !== 'all') {
        const offerDate = new Date(offer.createdAt);
        offerDate.setHours(0, 0, 0, 0);
        const offerTime = offerDate.getTime();

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayTime = today.getTime();

        if (filterType === 'today') {
          matchesDateFilter = offerTime === todayTime;
        } else if (filterType === '7days') {
          const sevenDaysAgo = new Date(today);
          sevenDaysAgo.setDate(today.getDate() - 7);
          const sevenDaysAgoTime = sevenDaysAgo.getTime();
          matchesDateFilter = offerTime >= sevenDaysAgoTime && offerTime <= todayTime;
        } else if (filterType === 'custom') {
          if (startVal) {
            const start = new Date(startVal + 'T00:00:00');
            matchesDateFilter = matchesDateFilter && offerTime >= start.getTime();
          }
          if (endVal) {
            const end = new Date(endVal + 'T00:00:00');
            matchesDateFilter = matchesDateFilter && offerTime <= end.getTime();
          }
        }
      }
      return matchesDateFilter;
    });

    if (targetOffers.length === 0) return '';

    // Limit to the 8 most recent applications if limitForAi is true to prevent token overload
    if (limitForAi && targetOffers.length > 8) {
      targetOffers = targetOffers.slice(0, 8);
    }

    const usedCvIds = new Set<string>();
    targetOffers.forEach(o => {
      if (o.cvId) usedCvIds.add(o.cvId);
    });

    const uniqueCvs = userCvs.filter(cv => usedCvIds.has(cv.id));
    const isEs = language === 'es';
    
    const titleText = isEs ? 'REPORTE DE POSTULACIONES - MATCHPLY' : 'APPLICATIONS REPORT - MATCHPLY';
    const periodLabel = isEs ? 'Período' : 'Period';
    const exportDateLabel = isEs ? 'Fecha de exportación' : 'Export date';
    const applicationsSectionTitle = isEs ? 'POSTULACIONES COPIADAS' : 'COPIED APPLICATIONS';
    const cvsSectionTitle = isEs ? 'CURRÍCULUMS VINCULADOS' : 'LINKED CVs';
    
    let periodValue = '';
    if (filterType === 'all') {
      periodValue = isEs ? 'Todas las postulaciones' : 'All applications';
    } else if (filterType === 'today') {
      periodValue = isEs ? 'Hoy' : 'Today';
    } else if (filterType === '7days') {
      periodValue = isEs ? 'Últimos 7 días' : 'Last 7 days';
    } else if (filterType === 'custom') {
      const startStr = startVal ? formatDate(new Date(startVal + 'T00:00:00')) : '...';
      const endStr = endVal ? formatDate(new Date(endVal + 'T00:00:00')) : '...';
      periodValue = isEs ? `Rango: ${startStr} - ${endStr}` : `Range: ${startStr} - ${endStr}`;
    }

    const todayDate = new Date();
    const formattedExportDate = `${formatDate(todayDate)} ${todayDate.toLocaleTimeString(language === 'es' ? 'es-ES' : 'en-US', { hour: '2-digit', minute: '2-digit' })}`;

    let textStr = `==================================================
${titleText}
==================================================
• ${periodLabel}: ${periodValue}
• ${exportDateLabel}: ${formattedExportDate}

==================================================
${applicationsSectionTitle} (${targetOffers.length})
==================================================
`;

    targetOffers.forEach((offer, idx) => {
      const statusText = t(`kanban.columns.${offer.status}.title`);
      const cvObj = offer.cvId ? userCvs.find(cv => cv.id === offer.cvId) : null;
      const cvTitle = cvObj ? cvObj.title : (isEs ? 'Ninguno' : 'None');

      // Truncate job description if limitForAi is enabled
      let descriptionText = offer.description || (isEs ? 'Sin descripción' : 'No description');
      if (limitForAi && descriptionText.length > 600) {
        descriptionText = descriptionText.substring(0, 600) + '... [Descripción truncada para optimización de tokens]';
      }

      textStr += `
--------------------------------------------------
${idx + 1}. ${offer.title.toUpperCase()} en ${offer.company.toUpperCase()}
--------------------------------------------------
• ${isEs ? 'Puesto' : 'Job Title'}: ${offer.title}
• ${isEs ? 'Empresa' : 'Company'}: ${offer.company}
• ${isEs ? 'Enlace' : 'Link'}: ${offer.url || (isEs ? 'No proporcionado' : 'Not provided')}
• ${isEs ? 'Plataforma' : 'Platform'}: ${offer.platform}
• ${isEs ? 'Estado' : 'Status'}: ${statusText}
• ${isEs ? 'CV Vinculado' : 'Linked CV'}: ${cvTitle}

• ${isEs ? 'Descripción' : 'Description'}:
${descriptionText}
`;
    });

    if (uniqueCvs.length > 0) {
      textStr += `
==================================================
${cvsSectionTitle} (${uniqueCvs.length})
==================================================
`;

      uniqueCvs.forEach((cv) => {
        const offersUsingThisCv = targetOffers.filter(o => o.cvId === cv.id);
        const offersList = offersUsingThisCv
          .map(o => `  - ${o.title} en ${o.company} (${t(`kanban.columns.${o.status}.title`)})`)
          .join('\n');

        // Truncate CV content if limitForAi is enabled
        let cvContentText = cv.content;
        if (limitForAi && cvContentText.length > 3000) {
          cvContentText = cvContentText.substring(0, 3000) + '\n... [Contenido del CV truncado para optimización de tokens]';
        }

        textStr += `
--------------------------------------------------
CV: ${cv.title}
${isEs ? 'Utilizado en las siguientes postulaciones:' : 'Used in the following applications:'}
${offersList}

${isEs ? 'Contenido del CV:' : 'CV Content:'}
${cvContentText}
--------------------------------------------------
`;
      });
    }

    return textStr;
  };

  const handleCopyData = async () => {
    const textStr = getOffersReportText(copyDateFilter, copyStartDate, copyEndDate);
    if (!textStr) return;

    try {
      await navigator.clipboard.writeText(textStr);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        setIsCopyModalOpen(false);
      }, 1500);
    } catch (err) {
      console.error('Error al copiar al portapapeles:', err);
    }
  };

  // AI Chatbot States
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant', content: string }>>([]);
  const [chatInputValue, setChatInputValue] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);

  // Suggested quick questions
  const chatSuggestedQuestions = language === 'es' 
    ? [
        { id: 'common_failures', text: '¿Cuáles son mis fallos más comunes?' },
        { id: 'improve_cv', text: '¿Cómo puedo adaptar mejor mis CVs?' },
        { id: 'general_advice', text: 'Dame un consejo general para mi embudo' }
      ]
    : [
        { id: 'common_failures', text: 'What are my most common failures?' },
        { id: 'improve_cv', text: 'How can I adapt my CVs better?' },
        { id: 'general_advice', text: 'Give me a general tip for my funnel' }
      ];

  // Initialize chat with greeting
  useEffect(() => {
    if (isChatOpen && chatMessages.length === 0) {
      const isEs = language === 'es';
      setChatMessages([
        {
          role: 'assistant',
          content: isEs
            ? "¡Hola! Bienvenido a tu Asesor de Carrera IA en Matchply. Analizaré tu embudo de candidaturas activas y currículums para ayudarte a identificar qué puede estar fallando en tus procesos y cómo solucionarlo.\n\n¿Quieres que analice tus postulaciones actuales?"
            : "Hello! Welcome to your AI Career Coach at Matchply. I will analyze your active application funnel and resumes to help you identify what might be failing and how to fix it.\n\nWould you like me to analyze your current applications?"
        }
      ]);
    }
  }, [isChatOpen, chatMessages, language]);

  // Observer/Interval typing simulation
  const startTypingSimulation = (fullText: string, onUpdate: (text: string) => void, onComplete: () => void) => {
    let currentLength = 0;
    const speed = 12; // Speed in ms
    const interval = setInterval(() => {
      currentLength += 4; // Add 4 chars at a time
      if (currentLength >= fullText.length) {
        onUpdate(fullText);
        clearInterval(interval);
        onComplete();
      } else {
        onUpdate(fullText.substring(0, currentLength));
      }
    }, speed);
    return () => clearInterval(interval);
  };

  const handleStartAiAnalysis = async () => {
    if (isChatLoading) return;
    setIsChatLoading(true);
    const isEs = language === 'es';
    
    // Add user message to trigger analysis
    const userMsg = isEs ? "Analiza mi embudo de postulaciones, por favor." : "Analyze my applications funnel, please.";
    setChatMessages(prev => [...prev, { role: 'user', content: userMsg }]);

    // Format target offers using active board date filters
    const reportText = getOffersReportText(dateFilter, startDate, endDate, true);

    if (!reportText) {
      setIsChatLoading(false);
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: isEs
          ? "No he encontrado candidaturas activas en tu tablero según el filtro de fechas seleccionado. Por favor, crea candidaturas antes de realizar el análisis."
          : "I couldn't find any active applications on your board matching the selected date filters. Please create some applications before analyzing."
      }]);
      return;
    }

    try {
      const result = await analyzeFailuresAction(reportText);
      if (result.error) {
        setIsChatLoading(false);
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          content: isEs
            ? `Lo siento, ha ocurrido un error al procesar el análisis: ${result.error}`
            : `Sorry, an error occurred while processing the analysis: ${result.error}`
        }]);
      } else if (result.analysis) {
        // Add an empty assistant message to fill with typing simulation
        setChatMessages(prev => [...prev, { role: 'assistant', content: '' }]);
        
        startTypingSimulation(
          result.analysis,
          (partialText) => {
            setChatMessages(prev => {
              const updated = [...prev];
              updated[updated.length - 1] = { role: 'assistant', content: partialText };
              return updated;
            });
          },
          () => {
            setIsChatLoading(false);
          }
        );
      }
    } catch (err) {
      setIsChatLoading(false);
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: isEs
          ? "Lo siento, ocurrió un error inesperado de red al conectar con el motor de IA."
          : "Sorry, an unexpected network error occurred while connecting to the AI engine."
      }]);
    }
  };

  const handleSendChatMessage = async (e: React.FormEvent | string) => {
    if (typeof e !== 'string') {
      e.preventDefault();
    }
    const messageText = typeof e === 'string' ? e : chatInputValue;
    if (!messageText.trim() || isChatLoading) return;

    if (typeof e !== 'string') {
      setChatInputValue('');
    }
    
    setIsChatLoading(true);
    setChatMessages(prev => [...prev, { role: 'user', content: messageText }]);

    const isEs = language === 'es';
    const reportText = getOffersReportText(dateFilter, startDate, endDate, true);
    
    const updatedHistory = [...chatMessages, { role: 'user', content: messageText }];
    const conversationHistoryText = updatedHistory
      .slice(-6) // Include last 6 messages for context
      .map(msg => `${msg.role === 'user' ? 'Usuario' : 'Asistente de IA'}: ${msg.content}`)
      .join('\n\n');

    const promptContext = `
[DATOS DE POSTULACIONES DEL USUARIO]
${reportText}

[HISTORIAL RECIENTE DEL CHAT]
${conversationHistoryText}

[NUEVA CONSULTA DEL USUARIO]
${messageText}

Responde de forma concisa y directa al usuario.
`;

    try {
      const result = await analyzeFailuresAction(promptContext);
      if (result.error) {
        setIsChatLoading(false);
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          content: isEs
            ? `Lo siento, ha ocurrido un error al responder: ${result.error}`
            : `Sorry, an error occurred while generating a response: ${result.error}`
        }]);
      } else if (result.analysis) {
        setChatMessages(prev => [...prev, { role: 'assistant', content: '' }]);
        
        startTypingSimulation(
          result.analysis,
          (partialText) => {
            setChatMessages(prev => {
              const updated = [...prev];
              updated[updated.length - 1] = { role: 'assistant', content: partialText };
              return updated;
            });
          },
          () => {
            setIsChatLoading(false);
          }
        );
      }
    } catch (err) {
      setIsChatLoading(false);
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: isEs
          ? "Lo siento, ha ocurrido un error al conectar con la IA."
          : "Sorry, an error occurred while communicating with the AI."
      }]);
    }
  };

  const renderMessageContent = (content: string) => {
    if (!content) return <span className="inline-block w-1.5 h-3.5 bg-[#8b5cf6] dark:bg-violet-400 animate-pulse ml-0.5" />;

    const lines = content.split('\n');
    return lines.map((line, lineIdx) => {
      if (!line.trim()) {
        return <div key={lineIdx} className="h-2" />;
      }
      
      if (line.startsWith('### ')) {
        return <h4 key={lineIdx} className="text-xs font-bold text-[#1e1b4b] dark:text-white mt-3 mb-1.5 font-display">{line.slice(4)}</h4>;
      }
      if (line.startsWith('## ')) {
        return <h3 key={lineIdx} className="text-sm font-bold text-[#1e1b4b] dark:text-white mt-4 mb-2 border-b border-[#1e1b4b]/10 dark:border-white/5 pb-1 font-display">{line.slice(3)}</h3>;
      }
      if (line.startsWith('# ')) {
        return <h2 key={lineIdx} className="text-base font-bold text-[#1e1b4b] dark:text-white mt-4 mb-2 font-display">{line.slice(2)}</h2>;
      }
      if (line.startsWith('---') || line.startsWith('===')) {
        return <hr key={lineIdx} className="my-2 border-[#1e1b4b]/10 dark:border-white/5" />;
      }

      const listMatch = line.match(/^(\s*)[-\*•]\s+(.*)$/);
      let processedText: React.ReactNode = line;
      let isListItem = false;
      let textToProcess = line;

      if (listMatch) {
        isListItem = true;
        textToProcess = listMatch[2];
      }

      const boldRegex = /\*\*(.*?)\*\*/g;
      const parts = [];
      let lastIndex = 0;
      let match;
      
      while ((match = boldRegex.exec(textToProcess)) !== null) {
        if (match.index > lastIndex) {
          parts.push(textToProcess.substring(lastIndex, match.index));
        }
        parts.push(<strong key={match.index} className="font-bold text-[#1e1b4b] dark:text-white">{match[1]}</strong>);
        lastIndex = boldRegex.lastIndex;
      }
      
      if (lastIndex < textToProcess.length) {
        parts.push(textToProcess.substring(lastIndex));
      }
      
      processedText = parts.length > 0 ? parts : textToProcess;

      if (isListItem) {
        return (
          <li key={lineIdx} className="ml-4 list-disc text-xs text-[#1e1b4b]/80 dark:text-slate-300 font-sans my-0.5 leading-relaxed">
            {processedText}
          </li>
        );
      }

      return (
        <p key={lineIdx} className="text-xs text-[#1e1b4b]/80 dark:text-slate-300 font-sans leading-relaxed my-1">
          {processedText}
        </p>
      );
    });
  };

  // Hydration state
  const [hasMounted, setHasMounted] = useState(false);

  // Drag and drop states
  const [localOffers, setLocalOffers] = useState(offers);
  const [draggingOfferId, setDraggingOfferId] = useState<string | null>(null);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    setLocalOffers(offers);
  }, [offers]);

  // Drag and Drop Handlers
  const handleDragStart = (start: any) => {
    setDraggingOfferId(start.draggableId);
  };

  const handleDragEnd = async (result: any) => {
    setDraggingOfferId(null);
    const { destination, source, draggableId } = result;

    // Dropped outside a column or in the same place
    if (!destination) return;
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    const targetColumnId = destination.droppableId as Column['id'];
    const offerId = draggableId;

    const offer = localOffers.find(o => o.id === offerId);
    if (!offer || offer.status === targetColumnId) return;

    // Optimistic UI update
    const previousOffers = [...localOffers];
    setLocalOffers(prev => prev.map(o => o.id === offerId ? { ...o, status: targetColumnId, updatedAt: new Date() } : o));

    const actionResult = await updateJobOfferStatus(offerId, targetColumnId);
    if (actionResult.error) {
      // Revert if db update fails
      setLocalOffers(previousOffers);
    } else {
      router.refresh();
    }
  };

  const handleDeleteOffer = (offerId: string) => {
    setLocalOffers(prev => prev.filter(o => o.id !== offerId));
  };

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    company: '',
    url: '',
    platform: 'linkedin',
    description: '',
  });

  const columns: Column[] = [
    { id: 'interested', title: t('kanban.columns.interested.title'), shortTitle: t('kanban.columns.interested.shortTitle'), description: t('kanban.columns.interested.desc'), color: 'text-indigo-400 bg-indigo-500/10', borderColor: 'border-indigo-500/20', glowColor: 'rgba(99,102,241,0.15)' },
    { id: 'applied', title: t('kanban.columns.applied.title'), shortTitle: t('kanban.columns.applied.shortTitle'), description: t('kanban.columns.applied.desc'), color: 'text-blue-400 bg-blue-500/10', borderColor: 'border-blue-500/20', glowColor: 'rgba(59,130,246,0.15)' },
    { id: 'interview', title: t('kanban.columns.interview.title'), shortTitle: t('kanban.columns.interview.shortTitle'), description: t('kanban.columns.interview.desc'), color: 'text-amber-400 bg-amber-500/10', borderColor: 'border-amber-500/20', glowColor: 'rgba(245,158,11,0.15)' },
    { id: 'offer', title: t('kanban.columns.offer.title'), shortTitle: t('kanban.columns.offer.shortTitle'), description: t('kanban.columns.offer.desc'), color: 'text-emerald-400 bg-emerald-500/10', borderColor: 'border-emerald-500/20', glowColor: 'rgba(16,185,129,0.15)' },
    { id: 'rejected', title: t('kanban.columns.rejected.title'), shortTitle: t('kanban.columns.rejected.shortTitle'), description: t('kanban.columns.rejected.desc'), color: 'text-rose-400 bg-rose-500/10', borderColor: 'border-rose-500/20', glowColor: 'rgba(244,63,94,0.15)' },
  ];

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const boardOffers = localOffers.filter((offer) => !isArchivedStatus(offer.status));
  const archivedOffers = localOffers.filter((offer) => isArchivedStatus(offer.status));
  const linkedOffers = boardOffers.filter((offer) => Boolean(offer.cvId)).length;
  const filteredOffers = boardOffers.filter((offer) => {
    const matchesSearch = !normalizedSearch || [offer.title, offer.company, offer.platform]
      .some((value) => value?.toLowerCase().includes(normalizedSearch));
    const matchesCvFilter =
      cvFilter === 'all' ||
      (cvFilter === 'linked' && Boolean(offer.cvId)) ||
      (cvFilter === 'unlinked' && !offer.cvId);

    // Date filter logic
    let matchesDateFilter = true;
    if (dateFilter !== 'all') {
      const offerDate = new Date(offer.createdAt);
      offerDate.setHours(0, 0, 0, 0);
      const offerTime = offerDate.getTime();

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayTime = today.getTime();

      if (dateFilter === 'today') {
        matchesDateFilter = offerTime === todayTime;
      } else if (dateFilter === '7days') {
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(today.getDate() - 7);
        const sevenDaysAgoTime = sevenDaysAgo.getTime();
        matchesDateFilter = offerTime >= sevenDaysAgoTime && offerTime <= todayTime;
      } else if (dateFilter === 'custom') {
        if (startDate) {
          const start = new Date(startDate + 'T00:00:00');
          matchesDateFilter = matchesDateFilter && offerTime >= start.getTime();
        }
        if (endDate) {
          const end = new Date(endDate + 'T00:00:00');
          matchesDateFilter = matchesDateFilter && offerTime <= end.getTime();
        }
      }
    }

    return matchesSearch && matchesCvFilter && matchesDateFilter;
  });
  const hasActiveFilters = Boolean(normalizedSearch) || cvFilter !== 'all' || dateFilter !== 'all';

  const renderColumnIcon = (columnId: Column['id']) => {
    switch (columnId) {
      case 'interested':
        return <Bookmark className="w-3.5 h-3.5" />;
      case 'applied':
        return <Send className="w-3.5 h-3.5" />;
      case 'interview':
        return <Calendar className="w-3.5 h-3.5" />;
      case 'offer':
        return <PartyPopper className="w-3.5 h-3.5" />;
      case 'rejected':
        return <Ban className="w-3.5 h-3.5" />;
      default:
        return null;
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!formData.title || !formData.company) {
      setError(t('kanban.modal.requiredError'));
      return;
    }

    setLoading(true);
    const result = await createJobOffer(formData);
    setLoading(false);

    if (result.error) {
      setError(result.error);
    } else {
      setIsModalOpen(false);
      setFormData({
        title: '',
        company: '',
        url: '',
        platform: 'linkedin',
        description: '',
      });
      router.refresh();
    }
  };

  if (!hasMounted) {
    return (
      <div className="w-full min-h-[500px] flex flex-col items-center justify-center py-20 font-display">
        <RefreshCw className="w-8 h-8 text-[#8b5cf6] animate-spin stroke-[1.75]" />
        <p className="text-xs text-[#1e1b4b]/60 dark:text-slate-400 mt-3 font-sans">{t('kanban.board.loading')}</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Cabecera del Tablero */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-5">
        <div>
          <h2 className="text-2xl font-bold text-[#1e1b4b] dark:text-white tracking-tight flex items-center gap-2 font-display">
            <Briefcase className="w-6 h-6 text-[#8b5cf6] dark:text-violet-400 stroke-[1.75]" />
            {t('kanban.board.title')}
          </h2>
          <p className="text-[#1e1b4b]/60 dark:text-slate-400 text-sm mt-1 font-sans">
            {t('kanban.board.subtitle')}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto font-display">
          <button
            onClick={() => setIsCopyModalOpen(true)}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-[8px] bg-white dark:bg-[#1f2937] border border-[#1e1b4b]/10 dark:border-white/5 hover:border-[#8b5cf6]/30 text-[#1e1b4b]/70 dark:text-slate-300 hover:text-[#8b5cf6] dark:hover:text-violet-400 font-semibold text-sm transition-all shadow-sm"
          >
            <Clipboard className="w-4 h-4 text-[#8b5cf6] stroke-[1.75]" />
            {t('kanban.copyDataModal.copyDataBtn')}
          </button>

          <NextLink
            href="/dashboard/kanban/archived"
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-[8px] bg-white dark:bg-[#1f2937] border border-[#1e1b4b]/10 dark:border-white/5 hover:border-amber-500/30 text-[#1e1b4b]/70 dark:text-slate-300 hover:text-[#1e1b4b] dark:hover:text-white font-semibold text-sm transition-all shadow-sm"
          >
            <Archive className="w-4 h-4 text-amber-500 stroke-[1.75]" />
            {t('kanban.board.archivedBtn')}
            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-200 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
              {archivedOffers.length}
            </span>
          </NextLink>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-2 px-5 py-3 rounded-[8px] bg-[#1e1b4b] hover:bg-[#1e1b4b]/90 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-[#0b0f19] font-semibold text-sm shadow-sm transition-all duration-300 transform hover:-translate-y-0.5"
          >
            <Plus className="w-4 h-4 stroke-[1.75]" />
            {t('kanban.board.newApplicationBtn')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5 font-display">
        <div className="rounded-[12px] border border-[#1e1b4b]/10 dark:border-white/5 bg-white dark:bg-[#1f2937] px-4 py-3 shadow-sm">
          <p className="text-[10px] uppercase tracking-wider text-[#1e1b4b]/40 dark:text-slate-500 font-bold">{t('kanban.board.activeBadge')}</p>
          <p className="text-xl font-bold text-[#1e1b4b] dark:text-white mt-1">{boardOffers.length}</p>
        </div>
        <div className="rounded-[12px] border border-[#1e1b4b]/10 dark:border-white/5 bg-white dark:bg-[#1f2937] px-4 py-3 shadow-sm">
          <p className="text-[10px] uppercase tracking-wider text-[#1e1b4b]/40 dark:text-slate-500 font-bold">{t('kanban.board.archivedBadge')}</p>
          <p className="text-xl font-bold text-amber-600 dark:text-amber-300 mt-1">{archivedOffers.length}</p>
        </div>
        <div className="rounded-[12px] border border-[#1e1b4b]/10 dark:border-white/5 bg-white dark:bg-[#1f2937] px-4 py-3 shadow-sm">
          <p className="text-[10px] uppercase tracking-wider text-[#1e1b4b]/40 dark:text-slate-500 font-bold">{t('kanban.board.linkedBadge')}</p>
          <p className="text-xl font-bold text-[#2ecc71] mt-1">{linkedOffers}</p>
        </div>
        <div className="rounded-[12px] border border-[#1e1b4b]/10 dark:border-white/5 bg-white dark:bg-[#1f2937] px-4 py-3 shadow-sm">
          <p className="text-[10px] uppercase tracking-wider text-[#1e1b4b]/40 dark:text-slate-500 font-bold">{t('kanban.board.showingBadge')}</p>
          <p className="text-xl font-bold text-[#1e1b4b] dark:text-white mt-1">{filteredOffers.length}</p>
        </div>
      </div>

      <div className="flex flex-col xl:flex-row gap-3 xl:items-center xl:justify-between mb-5">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-[#1e1b4b]/40 dark:text-slate-500 stroke-[1.75]" />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={t('kanban.board.searchPlaceholder')}
            className="w-full bg-white dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 rounded-[8px] pl-10 pr-10 py-3 text-sm text-[#1e1b4b] dark:text-white placeholder-[#1e1b4b]/40 dark:placeholder-slate-500 focus:outline-none focus:border-[#8b5cf6] dark:focus:border-[#8b5cf6] transition-all font-sans"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-[8px] text-[#1e1b4b]/40 dark:text-slate-500 hover:text-[#1e1b4b] dark:hover:text-white hover:bg-[#fafafa] dark:hover:bg-[#1f2937] transition-colors"
              aria-label={t('kanban.board.clearSearch')}
              title={t('kanban.board.clearSearch')}
            >
              <X className="w-3.5 h-3.5 stroke-[1.75]" />
            </button>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="flex items-center gap-1 rounded-[8px] border border-[#1e1b4b]/10 dark:border-white/10 bg-white dark:bg-[#1f2937] p-1 shadow-sm font-display">
            <SlidersHorizontal className="w-4 h-4 text-[#1e1b4b]/40 dark:text-slate-500 ml-2 hidden sm:block stroke-[1.75]" />
            {[
              { value: 'all', label: t('kanban.board.filterAll') },
              { value: 'linked', label: t('kanban.board.filterLinked') },
              { value: 'unlinked', label: t('kanban.board.filterUnlinked') },
            ].map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => setCvFilter(filter.value as 'all' | 'linked' | 'unlinked')}
                className={`px-3 py-2 rounded-[8px] text-xs font-bold transition-all ${
                  cvFilter === filter.value
                    ? 'bg-[#1e1b4b] dark:bg-white text-white dark:text-[#0b0f19] shadow-sm'
                    : 'text-[#1e1b4b]/60 dark:text-slate-400 hover:text-[#1e1b4b] dark:hover:text-white'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {/* Filtro de Fechas */}
          <div className="relative font-display">
            <button
              type="button"
              onClick={() => setIsDateDropdownOpen(!isDateDropdownOpen)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-[8px] border text-xs font-bold transition-all shadow-sm ${
                dateFilter !== 'all'
                  ? 'bg-[#8b5cf6]/10 border-[#8b5cf6]/30 text-[#8b5cf6] dark:text-violet-400'
                  : 'bg-white dark:bg-[#1f2937] border-[#1e1b4b]/10 dark:border-white/10 text-[#1e1b4b]/60 dark:text-slate-400 hover:text-[#1e1b4b] dark:hover:text-white'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 stroke-[1.75]" />
              {dateFilter === 'all' && t('kanban.board.dateFilterAll')}
              {dateFilter === 'today' && t('kanban.board.dateFilterToday')}
              {dateFilter === '7days' && t('kanban.board.dateFilter7Days')}
              {dateFilter === 'custom' && (
                startDate || endDate 
                  ? `${startDate ? formatDate(new Date(startDate + 'T00:00:00')) : ''} - ${endDate ? formatDate(new Date(endDate + 'T00:00:00')) : ''}` 
                  : t('kanban.board.dateFilterCustom')
              )}
            </button>

            {isDateDropdownOpen && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setIsDateDropdownOpen(false)} 
                />
                <div className="absolute right-0 mt-1.5 w-64 rounded-[12px] border border-[#1e1b4b]/10 dark:border-white/10 bg-white dark:bg-[#1f2937] p-3 shadow-xl z-20 space-y-2.5 animate-in fade-in duration-100">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#1e1b4b]/40 dark:text-slate-500 px-1">
                    {t('kanban.board.filterBtnLabel')}
                  </div>
                  
                  <div className="flex flex-col gap-1">
                    {[
                      { value: 'all', label: t('kanban.board.dateFilterAll') },
                      { value: 'today', label: t('kanban.board.dateFilterToday') },
                      { value: '7days', label: t('kanban.board.dateFilter7Days') },
                      { value: 'custom', label: t('kanban.board.dateFilterCustom') },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          setDateFilter(opt.value as any);
                          if (opt.value !== 'custom') {
                            setIsDateDropdownOpen(false);
                          }
                        }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-[6px] text-xs font-semibold transition-all ${
                          dateFilter === opt.value
                            ? 'bg-[#1e1b4b] dark:bg-white text-white dark:text-[#0b0f19]'
                            : 'text-[#1e1b4b]/70 dark:text-slate-300 hover:bg-[#fafafa] dark:hover:bg-[#0b0f19]/45'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {dateFilter === 'custom' && (
                    <div className="pt-2 border-t border-[#1e1b4b]/10 dark:border-white/5 space-y-2">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-[#1e1b4b]/50 dark:text-slate-400">
                          {t('kanban.board.dateStart')}
                        </label>
                        <input
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="w-full bg-[#fafafa] dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 rounded-[6px] px-2 py-1 text-xs text-[#1e1b4b] dark:text-white focus:outline-none focus:border-[#8b5cf6] dark:focus:border-[#8b5cf6]"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-[#1e1b4b]/50 dark:text-slate-400">
                          {t('kanban.board.dateEnd')}
                        </label>
                        <input
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          className="w-full bg-[#fafafa] dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 rounded-[6px] px-2 py-1 text-xs text-[#1e1b4b] dark:text-white focus:outline-none focus:border-[#8b5cf6] dark:focus:border-[#8b5cf6]"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-1 rounded-[8px] border border-[#1e1b4b]/10 dark:border-white/10 bg-white dark:bg-[#1f2937] p-1 shadow-sm font-display">
            <button
              type="button"
              onClick={() => setViewMode('compact')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-[8px] text-xs font-bold transition-all ${
                viewMode === 'compact'
                  ? 'bg-[#1e1b4b] dark:bg-white text-white dark:text-[#0b0f19] shadow-sm'
                  : 'text-[#1e1b4b]/60 dark:text-slate-400 hover:text-[#1e1b4b] dark:hover:text-white'
              }`}
            >
              <Minimize2 className="w-3.5 h-3.5 stroke-[1.75]" />
              {t('kanban.board.viewCompact')}
            </button>
            <button
              type="button"
              onClick={() => setViewMode('comfortable')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-[8px] text-xs font-bold transition-all ${
                viewMode === 'comfortable'
                  ? 'bg-[#1e1b4b] dark:bg-white text-white dark:text-[#0b0f19] shadow-sm'
                  : 'text-[#1e1b4b]/60 dark:text-slate-400 hover:text-[#1e1b4b] dark:hover:text-white'
              }`}
            >
              <Maximize2 className="w-3.5 h-3.5 stroke-[1.75]" />
              {t('kanban.board.viewComfortable')}
            </button>
          </div>
        </div>
      </div>

      {/* Grid de Columnas (Kanban) */}
      <DragDropContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="-mx-4 px-4 overflow-x-auto pb-4 scrollbar-custom">
          <div className="grid min-w-[1180px] grid-cols-5 gap-4 items-start">
            {columns.map((column) => {
              const rawColumnOffers = boardOffers.filter((offer) => offer.status === column.id);
              const columnOffers = filteredOffers.filter((offer) => offer.status === column.id);

              return (
                <div
                  key={column.id}
                  aria-label={`Columna ${column.title}`}
                  className={`flex h-[calc(100vh-330px)] min-h-[520px] max-h-[760px] flex-col bg-white dark:bg-[#1f2937] rounded-[12px] border relative overflow-hidden transition-all duration-300 ${
                    draggingOfferId && !columnOffers.some(o => o.id === draggingOfferId)
                      ? 'shadow-sm border-[#1e1b4b]/10 dark:border-white/5'
                      : `${column.borderColor} shadow-sm hover:shadow-md`
                  }`}
                >
                  {/* Cabecera de la columna */}
                  <div className="shrink-0 p-3.5 pb-3 border-b border-[#1e1b4b]/10 dark:border-white/5 bg-[#fafafa] dark:bg-[#0b0f19]/45">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full inline-flex items-center gap-1.5 ${column.color}`}>
                          {renderColumnIcon(column.id)}
                          {column.shortTitle}
                        </span>
                        <p className="text-[11px] text-[#1e1b4b]/50 dark:text-slate-400 mt-2 truncate font-sans">{column.description}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 font-display">
                        <span className="text-sm font-bold text-[#1e1b4b] dark:text-white bg-white dark:bg-[#0b0f19] px-2.5 py-1 rounded-[8px] border border-[#1e1b4b]/10 dark:border-white/10 shadow-sm">
                          {hasActiveFilters && rawColumnOffers.length > 0 ? `${columnOffers.length}/${rawColumnOffers.length}` : rawColumnOffers.length}
                        </span>
                        <span className="text-[10px] font-medium text-[#1e1b4b]/40 dark:text-slate-500">
                          {t('kanban.board.offersCount')}
                        </span>
                      </div>
                    </div>
                    {rawColumnOffers.length > 0 && (
                      <div className="mt-3 h-1.5 rounded-full bg-[#fafafa] dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${column.color.split(' ')[1]}`}
                          style={{
                            width: `${Math.max(8, Math.round((columnOffers.length / rawColumnOffers.length) * 100))}%`,
                            opacity: hasActiveFilters ? 0.8 : 1,
                          }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Lista de tarjetas */}
                  <Droppable droppableId={column.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`flex-1 overflow-y-auto scrollbar-custom p-3 pr-2 transition-all duration-200 ${
                          viewMode === 'compact' ? 'space-y-2.5' : 'space-y-4'
                        } ${
                          snapshot.isDraggingOver
                            ? 'bg-[#8b5cf6]/5 dark:bg-[#8b5cf6]/8 shadow-inner border border-dashed border-[#8b5cf6]/25 dark:border-violet-500/25 rounded-b-[12px] -m-[1px]'
                            : ''
                        }`}
                      >
                        {columnOffers.length === 0 ? (
                          <div className="h-full min-h-[260px] flex flex-col items-center justify-center border-2 border-dashed border-[#1e1b4b]/10 dark:border-white/10 rounded-[12px] p-6 text-center text-[#1e1b4b]/40 dark:text-slate-500">
                            {hasActiveFilters ? (
                              <>
                                <Search className="w-6 h-6 mb-2 text-[#1e1b4b]/30 dark:text-slate-600 opacity-70 stroke-[1.75]" />
                                <p className="text-[11px] font-bold uppercase tracking-wider font-display">{t('kanban.board.noResults')}</p>
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="w-6 h-6 mb-2 text-[#1e1b4b]/30 dark:text-slate-600 opacity-60 stroke-[1.75]" />
                                <p className="text-[11px] font-bold uppercase tracking-wider font-display">{t('kanban.board.emptyBoard')}</p>
                              </>
                            )}
                          </div>
                        ) : (
                          columnOffers.map((offer, index) => (
                            <KanbanCard
                              key={offer.id}
                              offer={offer}
                              userCvs={userCvs}
                              onOpenDetails={setSelectedOfferForDetails}
                              density={viewMode}
                              index={index}
                              onDelete={handleDeleteOffer}
                            />
                          ))
                        )}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>

                  <div className="shrink-0 border-t border-[#1e1b4b]/10 dark:border-white/5 bg-[#fafafa] dark:bg-[#0b0f19]/45 px-3.5 py-2.5">
                    <div className="flex items-center justify-between gap-2 text-[10px] text-[#1e1b4b]/40 dark:text-slate-500 font-sans">
                      <span className="flex items-center gap-1.5 min-w-0">
                        <ListChecks className="w-3.5 h-3.5 shrink-0 stroke-[1.75]" />
                        <span className="truncate">{columnOffers.length} {t('kanban.board.visibleText')}</span>
                      </span>
                      <span className="flex items-center gap-1.5 shrink-0">
                        <Link2 className="w-3.5 h-3.5 stroke-[1.75]" />
                        {columnOffers.filter((offer) => offer.cvId).length}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </DragDropContext>



      {/* Modal Premium para copiar Candidaturas */}
      {isCopyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-md transition-opacity animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-white dark:bg-[#1f2937] border border-[#1e1b4b]/10 dark:border-white/10 rounded-[12px] p-6 md:p-8 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            
            {/* Adornos visuales */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#8b5cf6]/3 dark:bg-[#8b5cf6]/5 rounded-full filter blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#8b5cf6]/3 dark:bg-[#8b5cf6]/5 rounded-full filter blur-3xl pointer-events-none" />

            <div className="flex justify-between items-start mb-6 relative z-10">
              <div>
                <h3 className="text-lg font-bold text-[#1e1b4b] dark:text-white flex items-center gap-2 font-display">
                  <Clipboard className="w-5 h-5 text-[#8b5cf6] dark:text-violet-400 stroke-[1.75]" />
                  {t('kanban.copyDataModal.title')}
                </h3>
                <p className="text-xs text-[#1e1b4b]/60 dark:text-slate-400 mt-1 font-sans">
                  {t('kanban.copyDataModal.subtitle')}
                </p>
              </div>
              <button
                onClick={() => setIsCopyModalOpen(false)}
                className="text-[#1e1b4b]/60 dark:text-slate-400 hover:text-[#1e1b4b] dark:hover:text-white p-1 rounded-[8px] hover:bg-[#fafafa] dark:hover:bg-[#0b0f19]/45 transition-all"
              >
                <X className="w-5 h-5 stroke-[1.75]" />
              </button>
            </div>

            <div className="space-y-5 relative z-10">
              {/* Selector de Período */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-[#1e1b4b]/80 dark:text-slate-200 font-display">
                  {t('kanban.copyDataModal.filterLabel')}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'all', label: t('kanban.copyDataModal.all') },
                    { value: 'today', label: t('kanban.copyDataModal.today') },
                    { value: '7days', label: t('kanban.copyDataModal.week') },
                    { value: 'custom', label: t('kanban.copyDataModal.custom') },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setCopyDateFilter(opt.value as any)}
                      className={`px-3 py-2.5 rounded-[8px] text-xs font-semibold border text-center transition-all ${
                        copyDateFilter === opt.value
                          ? 'bg-[#1e1b4b] dark:bg-white text-white dark:text-[#0b0f19] border-[#1e1b4b] dark:border-white shadow-sm'
                          : 'bg-white dark:bg-[#1f2937] border-[#1e1b4b]/10 dark:border-white/10 text-[#1e1b4b]/70 dark:text-slate-300 hover:border-[#8b5cf6]/30 hover:text-[#8b5cf6] dark:hover:text-violet-400'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Rango Personalizado */}
              {copyDateFilter === 'custom' && (
                <div className="grid grid-cols-2 gap-4 p-3.5 bg-[#fafafa] dark:bg-[#0b0f19]/30 border border-[#1e1b4b]/10 dark:border-white/5 rounded-[8px] animate-in slide-in-from-top-2 duration-200">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-[#1e1b4b]/50 dark:text-slate-400 uppercase tracking-wider font-display">
                      {t('kanban.copyDataModal.startDate')}
                    </label>
                    <input
                      type="date"
                      value={copyStartDate}
                      onChange={(e) => setCopyStartDate(e.target.value)}
                      className="w-full bg-white dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 rounded-[6px] px-3 py-2 text-xs text-[#1e1b4b] dark:text-white focus:outline-none focus:border-[#8b5cf6] dark:focus:border-[#8b5cf6] transition-all font-sans"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-[#1e1b4b]/50 dark:text-slate-400 uppercase tracking-wider font-display">
                      {t('kanban.copyDataModal.endDate')}
                    </label>
                    <input
                      type="date"
                      value={copyEndDate}
                      onChange={(e) => setCopyEndDate(e.target.value)}
                      className="w-full bg-white dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 rounded-[6px] px-3 py-2 text-xs text-[#1e1b4b] dark:text-white focus:outline-none focus:border-[#8b5cf6] dark:focus:border-[#8b5cf6] transition-all font-sans"
                    />
                  </div>
                </div>
              )}

              {/* Resumen de Exportación */}
              <div className="p-4 rounded-[8px] bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-2">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 font-display">
                  {t('kanban.copyDataModal.summary')}
                </h4>
                <div className="grid grid-cols-2 gap-4 text-xs font-semibold">
                  <div className="text-[#1e1b4b]/70 dark:text-slate-300">
                    {t('kanban.copyDataModal.foundOffers').replace('{count}', getFilteredOffersForCopy().length.toString())}
                  </div>
                  <div className="text-[#1e1b4b]/70 dark:text-slate-300">
                    {t('kanban.copyDataModal.linkedCvs').replace('{count}', (() => {
                      const offers = getFilteredOffersForCopy();
                      const ids = new Set(offers.filter(o => o.cvId).map(o => o.cvId));
                      return ids.size.toString();
                    })())}
                  </div>
                </div>
              </div>

              {/* Botones de acción */}
              <div className="flex justify-end gap-3 pt-4 border-t border-[#1e1b4b]/10 dark:border-white/5 font-display">
                <button
                  type="button"
                  onClick={() => setIsCopyModalOpen(false)}
                  className="px-4 py-2.5 text-sm font-semibold text-[#1e1b4b]/60 dark:text-slate-400 hover:text-[#1e1b4b] dark:hover:text-white transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleCopyData}
                  disabled={getFilteredOffersForCopy().length === 0}
                  className={`flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-bold text-white rounded-[8px] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed ${
                    copied
                      ? 'bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600'
                      : 'bg-[#8b5cf6] hover:bg-[#7c3aed] dark:bg-violet-600 dark:hover:bg-violet-700 shadow-md hover:-translate-y-0.5'
                  }`}
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 stroke-[2]" />
                      {t('kanban.copyDataModal.successToast')}
                    </>
                  ) : (
                    <>
                      <Clipboard className="w-4 h-4 stroke-[1.75]" />
                      {t('kanban.copyDataModal.copyBtn')}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Premium para crear Candidatura */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-md transition-opacity">
          <div className="relative w-full max-w-lg bg-white dark:bg-[#1f2937] border border-[#1e1b4b]/10 dark:border-white/10 rounded-[12px] p-6 md:p-8 shadow-2xl overflow-hidden">
            
            {/* Adornos visuales */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#8b5cf6]/3 dark:bg-[#8b5cf6]/5 rounded-full filter blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#8b5cf6]/3 dark:bg-[#8b5cf6]/5 rounded-full filter blur-3xl pointer-events-none" />

            <div className="flex justify-between items-start mb-6 relative z-10">
              <div>
                <h3 className="text-lg font-bold text-[#1e1b4b] dark:text-white flex items-center gap-2 font-display">
                  <Briefcase className="w-5 h-5 text-[#8b5cf6] dark:text-violet-400 stroke-[1.75]" />
                  {t('kanban.modal.addTitle')}
                </h3>
                <p className="text-xs text-[#1e1b4b]/60 dark:text-slate-400 mt-1 font-sans">
                  {t('kanban.modal.addDesc')}
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-[#1e1b4b]/60 dark:text-slate-400 hover:text-[#1e1b4b] dark:hover:text-white p-1 rounded-[8px] hover:bg-[#fafafa] dark:hover:bg-[#0b0f19]/45 transition-all"
              >
                <X className="w-5 h-5 stroke-[1.75]" />
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs rounded-[8px] font-medium font-sans">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#1e1b4b]/80 dark:text-slate-200 flex items-center gap-1.5 font-display">
                    <FileText className="w-3.5 h-3.5 text-[#1e1b4b]/50 dark:text-slate-400 stroke-[1.75]" />
                    {t('kanban.modal.jobField')}
                  </label>
                  <input
                    type="text"
                    name="title"
                    required
                    value={formData.title}
                    onChange={handleInputChange}
                    placeholder={t('kanban.modal.jobPlaceholder')}
                    className="w-full bg-white dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 rounded-[8px] px-3.5 py-2.5 text-sm text-[#1e1b4b] dark:text-white placeholder-[#1e1b4b]/40 dark:placeholder-slate-500 focus:outline-none focus:border-[#8b5cf6] dark:focus:border-[#8b5cf6] transition-all font-sans"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#1e1b4b]/80 dark:text-slate-200 flex items-center gap-1.5 font-display">
                    <Building2 className="w-3.5 h-3.5 text-[#1e1b4b]/50 dark:text-slate-400 stroke-[1.75]" />
                    {t('kanban.modal.companyField')}
                  </label>
                  <input
                    type="text"
                    name="company"
                    required
                    value={formData.company}
                    onChange={handleInputChange}
                    placeholder={t('kanban.modal.companyPlaceholder')}
                    className="w-full bg-white dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 rounded-[8px] px-3.5 py-2.5 text-sm text-[#1e1b4b] dark:text-white placeholder-[#1e1b4b]/40 dark:placeholder-slate-500 focus:outline-none focus:border-[#8b5cf6] dark:focus:border-[#8b5cf6] transition-all font-sans"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#1e1b4b]/80 dark:text-slate-200 flex items-center gap-1.5 font-display">
                    <Link className="w-3.5 h-3.5 text-[#1e1b4b]/50 dark:text-slate-400 stroke-[1.75]" />
                    {t('kanban.modal.linkField')}
                  </label>
                  <input
                    type="url"
                    name="url"
                    value={formData.url}
                    onChange={handleInputChange}
                    placeholder="https://..."
                    className="w-full bg-white dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 rounded-[8px] px-3.5 py-2.5 text-sm text-[#1e1b4b] dark:text-white placeholder-[#1e1b4b]/40 dark:placeholder-slate-500 focus:outline-none focus:border-[#8b5cf6] dark:focus:border-[#8b5cf6] transition-all font-sans"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#1e1b4b]/80 dark:text-slate-200 font-display">{t('kanban.modal.platformField')}</label>
                  <select
                    name="platform"
                    value={formData.platform}
                    onChange={handleInputChange}
                    className="w-full bg-white dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 rounded-[8px] px-3.5 py-2.5 text-sm text-[#1e1b4b] dark:text-white focus:outline-none focus:border-[#8b5cf6] dark:focus:border-[#8b5cf6] transition-all cursor-pointer font-sans"
                  >
                    <option value="linkedin">LinkedIn</option>
                    <option value="infojobs">InfoJobs</option>
                    <option value="indeed">Indeed</option>
                    <option value="other">{t('kanban.modal.platformOther')}</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#1e1b4b]/80 dark:text-slate-200 font-display">
                  {t('kanban.modal.descField')}
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows={4}
                  placeholder={t('kanban.modal.descPlaceholder')}
                  className="w-full bg-white dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 rounded-[8px] px-3.5 py-2.5 text-sm text-[#1e1b4b] dark:text-white placeholder-[#1e1b4b]/40 dark:placeholder-slate-500 focus:outline-none focus:border-[#8b5cf6] dark:focus:border-[#8b5cf6] transition-all resize-none font-sans"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-[#1e1b4b]/10 dark:border-white/5 font-display">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 text-sm font-semibold text-[#1e1b4b]/60 dark:text-slate-400 hover:text-[#1e1b4b] dark:hover:text-white transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#1e1b4b] hover:bg-[#1e1b4b]/90 dark:bg-white dark:hover:bg-slate-100 dark:text-[#0b0f19] rounded-[8px] transition-all disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      {t('kanban.modal.savingBtn')}
                    </>
                  ) : (
                    t('kanban.modal.saveBtn')
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {selectedOfferForDetails && (
        <JobOfferDetailsModal
          isOpen={!!selectedOfferForDetails}
          onClose={() => setSelectedOfferForDetails(null)}
          offer={offers.find(o => o.id === selectedOfferForDetails.id) || selectedOfferForDetails}
          userCvs={userCvs}
        />
      )}

      {/* Botón Redondo Flotante de IA Chatbot */}
      <button
        onClick={() => setIsChatOpen(!isChatOpen)}
        className="fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full bg-gradient-to-tr from-[#8b5cf6] to-[#a78bfa] text-white flex items-center justify-center shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 border border-[#8b5cf6]/20 transition-all hover:scale-105 active:scale-95 duration-300 group"
        aria-label="Asesor de Carrera IA"
        title="Asesor de Carrera IA"
      >
        <Sparkles className="w-6 h-6 animate-pulse group-hover:rotate-12 transition-transform duration-300" />
      </button>

      {/* Panel Flotante de IA Chatbot */}
      {isChatOpen && (
        <div className="fixed bottom-24 right-6 w-96 h-[550px] max-w-[calc(100vw-2rem)] max-h-[calc(100vh-8rem)] bg-white dark:bg-[#1f2937] border border-[#1e1b4b]/10 dark:border-white/10 rounded-[16px] shadow-2xl z-40 overflow-hidden flex flex-col animate-in slide-in-from-bottom-5 fade-in duration-300 font-sans text-left">
          {/* Cabecera del Chat */}
          <div className="shrink-0 p-4 bg-[#1e1b4b] dark:bg-[#0b0f19] text-white flex items-center justify-between border-b border-[#1e1b4b]/10 dark:border-white/5">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-[#8b5cf6] dark:text-violet-400 stroke-[1.75]" />
              <div>
                <h4 className="text-xs font-bold font-display tracking-wide">Asesor de Carrera IA</h4>
                <p className="text-[10px] text-slate-400">Matchply Coach</p>
              </div>
            </div>
            <button
              onClick={() => setIsChatOpen(false)}
              className="text-slate-400 hover:text-white p-1 rounded-[8px] hover:bg-white/10 transition-all"
            >
              <X className="w-4 h-4 stroke-[1.75]" />
            </button>
          </div>

          {/* Historial de Mensajes */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50 dark:bg-[#0b0f19]/20 scrollbar-custom">
            {chatMessages.map((msg, idx) => {
              const isAssistant = msg.role === 'assistant';
              return (
                <div
                  key={idx}
                  className={`flex ${isAssistant ? 'justify-start' : 'justify-end'} animate-in fade-in slide-in-from-bottom-1 duration-200`}
                >
                  <div
                    className={`max-w-[85%] rounded-[12px] p-3 text-xs shadow-sm leading-relaxed ${
                      isAssistant
                        ? 'bg-white dark:bg-[#1f2937] border border-[#1e1b4b]/5 dark:border-white/5 text-[#1e1b4b] dark:text-slate-200'
                        : 'bg-[#8b5cf6] text-white'
                    }`}
                  >
                    <div className="space-y-1">
                      {isAssistant ? renderMessageContent(msg.content) : msg.content}
                    </div>

                    {/* Botón de acción inicial en el primer mensaje de la IA */}
                    {isAssistant && idx === 0 && chatMessages.length === 1 && (
                      <div className="mt-3 flex justify-start">
                        <button
                          onClick={handleStartAiAnalysis}
                          disabled={isChatLoading}
                          className="flex items-center gap-1.5 px-3.5 py-2 rounded-[8px] bg-[#8b5cf6] hover:bg-[#7c3aed] text-white text-[11px] font-bold shadow-md hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50"
                        >
                          <Sparkles className="w-3 h-3 stroke-[2]" />
                          {language === 'es' ? 'Analizar mi embudo' : 'Analyze my funnel'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Cargador de la IA */}
            {isChatLoading && chatMessages[chatMessages.length - 1]?.role === 'user' && (
              <div className="flex justify-start animate-in fade-in duration-200">
                <div className="bg-white dark:bg-[#1f2937] border border-[#1e1b4b]/5 dark:border-white/5 rounded-[12px] p-3 shadow-sm flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#8b5cf6] animate-bounce duration-1000" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 rounded-full bg-[#8b5cf6] animate-bounce duration-1000" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 rounded-full bg-[#8b5cf6] animate-bounce duration-1000" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
          </div>

          {/* Preguntas sugeridas */}
          {chatMessages.length > 1 && !isChatLoading && (
            <div className="px-4 py-2 bg-slate-50/50 dark:bg-[#0b0f19]/10 border-t border-[#1e1b4b]/5 dark:border-white/5 flex gap-1.5 overflow-x-auto scrollbar-none whitespace-nowrap">
              {chatSuggestedQuestions.map((q) => (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => handleSendChatMessage(q.text)}
                  className="px-2.5 py-1.5 rounded-full border border-[#8b5cf6]/20 bg-white dark:bg-[#1f2937] hover:border-[#8b5cf6]/50 hover:bg-[#8b5cf6]/5 dark:hover:bg-violet-950/20 text-[#8b5cf6] dark:text-violet-400 text-[10px] font-bold transition-all shadow-sm"
                >
                  {q.text}
                </button>
              ))}
            </div>
          )}

          {/* Input de Envío */}
          <form
            onSubmit={handleSendChatMessage}
            className="shrink-0 p-3 bg-white dark:bg-[#1f2937] border-t border-[#1e1b4b]/10 dark:border-white/10 flex items-center gap-2"
          >
            <input
              type="text"
              value={chatInputValue}
              onChange={(e) => setChatInputValue(e.target.value)}
              disabled={isChatLoading}
              placeholder={language === 'es' ? 'Pregunta algo a tu asesor...' : 'Ask your coach something...'}
              className="flex-1 bg-[#fafafa] dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 rounded-[8px] px-3 py-2 text-xs text-[#1e1b4b] dark:text-white placeholder-[#1e1b4b]/40 dark:placeholder-slate-500 focus:outline-none focus:border-[#8b5cf6] dark:focus:border-[#8b5cf6] transition-all"
            />
            <button
              type="submit"
              disabled={!chatInputValue.trim() || isChatLoading}
              className="p-2 rounded-[8px] bg-[#8b5cf6] hover:bg-[#7c3aed] text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
            >
              <SendHorizontal className="w-4 h-4 stroke-[1.75]" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
