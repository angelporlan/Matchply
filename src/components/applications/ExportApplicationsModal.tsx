"use client";

import React, { useState } from 'react';
import { Download, Copy, Check, X, Loader2, FileSpreadsheet, CheckSquare, Square } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { getOffersExportDataAction } from '@/app/dashboard/applications/export-actions';
import { formatDataAsCsv, formatDataAsTsv, triggerCsvDownload, ExportColumnDefinition } from '@/lib/export-helpers';

interface ExportApplicationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedOfferIds: string[];
  visibleColumns?: string[];
  onToast: (message: string, type?: 'success' | 'info') => void;
}

interface ExportFieldDef {
  key: string;
  labelKey: string;
  section: 'main' | 'datesAndFollowup' | 'details';
  defaultChecked: boolean;
}

const ALL_EXPORT_FIELDS: ExportFieldDef[] = [
  { key: 'title', labelKey: 'title', section: 'main', defaultChecked: true },
  { key: 'company', labelKey: 'company', section: 'main', defaultChecked: true },
  { key: 'status', labelKey: 'status', section: 'main', defaultChecked: true },
  { key: 'url', labelKey: 'url', section: 'main', defaultChecked: true },
  { key: 'platform', labelKey: 'platform', section: 'main', defaultChecked: true },
  { key: 'scoreOverall', labelKey: 'scoreOverall', section: 'main', defaultChecked: true },

  { key: 'createdAt', labelKey: 'createdAt', section: 'datesAndFollowup', defaultChecked: true },
  { key: 'updatedAt', labelKey: 'updatedAt', section: 'datesAndFollowup', defaultChecked: false },
  { key: 'nextFollowupDate', labelKey: 'nextFollowupDate', section: 'datesAndFollowup', defaultChecked: false },
  { key: 'cvTitle', labelKey: 'cvTitle', section: 'datesAndFollowup', defaultChecked: false },

  { key: 'description', labelKey: 'description', section: 'details', defaultChecked: true },
  { key: 'tldr', labelKey: 'tldr', section: 'details', defaultChecked: false },
  { key: 'coverLetter', labelKey: 'coverLetter', section: 'details', defaultChecked: false },
  { key: 'outreachMessage', labelKey: 'outreachMessage', section: 'details', defaultChecked: false },
];

export default function ExportApplicationsModal({
  isOpen,
  onClose,
  selectedOfferIds,
  visibleColumns = [],
  onToast,
}: ExportApplicationsModalProps) {
  const { t } = useLanguage();
  const [selectedFields, setSelectedFields] = useState<Set<string>>(() => {
    return new Set(ALL_EXPORT_FIELDS.filter((f) => f.defaultChecked).map((f) => f.key));
  });
  const [isLoading, setIsLoading] = useState(false);
  const [copiedSuccess, setCopiedSuccess] = useState(false);

  if (!isOpen) return null;

  const toggleField = (key: string) => {
    setSelectedFields((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedFields(new Set(ALL_EXPORT_FIELDS.map((f) => f.key)));
  };

  const deselectAll = () => {
    setSelectedFields(new Set());
  };

  const selectVisible = () => {
    const next = new Set<string>();
    // Always include key columns
    next.add('title');
    next.add('company');
    next.add('status');
    next.add('url');
    next.add('description');
    visibleColumns.forEach((col) => {
      if (col === 'score') next.add('scoreOverall');
      else if (col === 'created') next.add('createdAt');
      else if (col === 'updated') next.add('updatedAt');
      else if (col === 'followup') next.add('nextFollowupDate');
      else if (col === 'cv') next.add('cvTitle');
      else if (ALL_EXPORT_FIELDS.some((f) => f.key === col)) next.add(col);
    });
    setSelectedFields(next);
  };

  const formatDate = (val: unknown) => {
    if (!val) return '';
    try {
      const d = new Date(val as string | number | Date);
      if (isNaN(d.getTime())) return String(val);
      return d.toLocaleDateString();
    } catch {
      return String(val);
    }
  };

  const formatStatus = (val: unknown) => {
    if (!val) return '';
    const s = String(val);
    const translated = t(`applications.columns.${s}.title`);
    return translated && !translated.startsWith('applications.') ? translated : s;
  };

  const prepareExportRows = async () => {
    if (selectedFields.size === 0) {
      onToast(t('applications.table.export.toasts.noFieldsSelected'), 'info');
      return null;
    }

    setIsLoading(true);
    const result = await getOffersExportDataAction(selectedOfferIds);
    setIsLoading(false);

    if (!result.success || !result.data) {
      onToast(result.error || t('applications.table.export.toasts.error'), 'info');
      return null;
    }

    // Active column definitions
    const activeColumns: ExportColumnDefinition[] = ALL_EXPORT_FIELDS
      .filter((f) => selectedFields.has(f.key))
      .map((f) => ({
        key: f.key,
        label: t(`applications.table.export.fields.${f.labelKey}`) || f.key,
      }));

    // Format row values
    const formattedRows = result.data.map((rawRow) => {
      const formatted: Record<string, unknown> = {};
      for (const col of activeColumns) {
        const val = rawRow[col.key];
        if (col.key === 'status') {
          formatted[col.key] = formatStatus(val);
        } else if (col.key === 'createdAt' || col.key === 'updatedAt' || col.key === 'nextFollowupDate') {
          formatted[col.key] = formatDate(val);
        } else if (col.key === 'scoreOverall') {
          formatted[col.key] = val != null ? `${Math.round(Number(val))}%` : '';
        } else {
          formatted[col.key] = val ?? '';
        }
      }
      return formatted;
    });

    return { columns: activeColumns, rows: formattedRows };
  };

  const handleDownloadCsv = async () => {
    const data = await prepareExportRows();
    if (!data) return;

    const csvString = formatDataAsCsv(data.rows, data.columns);
    const dateStr = new Date().toISOString().slice(0, 10);
    triggerCsvDownload(csvString, `candidaturas-matchply-${dateStr}.csv`);
    onToast(t('applications.table.export.toasts.downloaded'));
    onClose();
  };

  const handleCopyToClipboard = async () => {
    const data = await prepareExportRows();
    if (!data) return;

    const tsvString = formatDataAsTsv(data.rows, data.columns);
    try {
      await navigator.clipboard.writeText(tsvString);
      setCopiedSuccess(true);
      onToast(t('applications.table.export.toasts.copied'));
      setTimeout(() => {
        setCopiedSuccess(false);
        onClose();
      }, 1200);
    } catch (err) {
      console.error('Clipboard copy error:', err);
      onToast(t('applications.table.export.toasts.error'), 'info');
    }
  };

  const renderSection = (sectionKey: 'main' | 'datesAndFollowup' | 'details') => {
    const fields = ALL_EXPORT_FIELDS.filter((f) => f.section === sectionKey);
    return (
      <div className="space-y-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-text-muted font-display">
          {t(`applications.table.export.sections.${sectionKey}`)}
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {fields.map((f) => {
            const isChecked = selectedFields.has(f.key);
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => toggleField(f.key)}
                className={`flex items-center gap-2.5 p-2.5 rounded-[8px] border text-left text-xs font-medium transition-colors ${
                  isChecked
                    ? 'border-ai/40 bg-ai/5 text-text font-semibold'
                    : 'border-subtle bg-canvas/60 text-text-muted hover:border-control hover:text-text'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-[4px] border flex items-center justify-center transition-colors shrink-0 ${
                    isChecked
                      ? 'bg-ai border-ai text-white'
                      : 'border-control bg-surface'
                  }`}
                >
                  {isChecked && <Check className="w-3 h-3 stroke-[2.5]" />}
                </div>
                <span className="truncate">
                  {t(`applications.table.export.fields.${f.labelKey}`)}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl rounded-[16px] border border-subtle bg-surface shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-subtle">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-[10px] bg-ai/10 text-ai">
              <FileSpreadsheet className="w-5 h-5 stroke-[1.75]" />
            </div>
            <div>
              <h3 className="text-base font-bold text-text font-display">
                {t('applications.table.export.modalTitle')}
              </h3>
              <p className="text-xs text-text-muted mt-0.5">
                {t('applications.table.export.modalDesc').replace('{count}', String(selectedOfferIds.length))}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-[8px] text-text-muted hover:text-text hover:bg-canvas transition-colors"
          >
            <X className="w-4 h-4 stroke-[1.75]" />
          </button>
        </div>

        {/* Quick select buttons */}
        <div className="flex items-center gap-2 px-5 py-2.5 bg-surface-muted/50 border-b border-subtle text-xs">
          <span className="text-text-muted font-medium mr-1">Selección:</span>
          <button
            type="button"
            onClick={selectAll}
            className="px-2.5 py-1 rounded-[6px] text-xs font-semibold text-text-muted hover:text-text hover:bg-surface transition-colors"
          >
            {t('applications.table.export.selectAll')}
          </button>
          <span className="text-text-muted opacity-40">•</span>
          <button
            type="button"
            onClick={selectVisible}
            className="px-2.5 py-1 rounded-[6px] text-xs font-semibold text-ai hover:bg-ai/10 transition-colors"
          >
            {t('applications.table.export.selectVisible')}
          </button>
          <span className="text-text-muted opacity-40">•</span>
          <button
            type="button"
            onClick={deselectAll}
            className="px-2.5 py-1 rounded-[6px] text-xs font-semibold text-text-muted hover:text-rose-500 hover:bg-surface transition-colors"
          >
            {t('applications.table.export.deselectAll')}
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5 overflow-y-auto scrollbar-custom">
          {renderSection('main')}
          {renderSection('datesAndFollowup')}
          {renderSection('details')}
        </div>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border-t border-subtle bg-surface-muted/30">
          <div className="text-xs text-text-muted font-medium">
            <span className="font-bold text-text">{selectedFields.size}</span> campos seleccionados
          </div>

          <div className="flex items-center gap-2.5 justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-3.5 py-2 rounded-[8px] text-xs font-semibold text-text-muted hover:text-text hover:bg-canvas transition-colors disabled:opacity-50"
            >
              {t('common.cancel')}
            </button>

            <button
              type="button"
              onClick={handleCopyToClipboard}
              disabled={isLoading || selectedFields.size === 0}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-[8px] border text-xs font-bold transition-all ${
                copiedSuccess
                  ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'border-subtle bg-surface text-text hover:bg-canvas hover:border-control'
              } disabled:opacity-50`}
            >
              {isLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : copiedSuccess ? (
                <Check className="w-3.5 h-3.5 stroke-[2] text-emerald-500" />
              ) : (
                <Copy className="w-3.5 h-3.5 stroke-[1.75]" />
              )}
              <span>{copiedSuccess ? t('applications.table.export.formats.copied') : t('applications.table.export.formats.copyTsv')}</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadCsv}
              disabled={isLoading || selectedFields.size === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[8px] bg-text hover:bg-text/90 dark:bg-white dark:hover:bg-surface-muted text-canvas font-bold text-xs shadow-sm transition-all disabled:opacity-50 cursor-pointer"
            >
              {isLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5 stroke-[1.75]" />
              )}
              <span>{t('applications.table.export.formats.csv')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
