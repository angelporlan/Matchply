"use client";

import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { ArrowLeft, Plus, X } from 'lucide-react';
import { saveCvContent } from '@/app/dashboard/actions';
import { Button } from '@/components/ui/Button';
import {
  parseCvDocument,
  serializeCvDocument,
  type CVContent,
  type Entry,
  type Section,
} from '@/lib/cv-document';
import { isSkillsSection, joinSkillItem, splitSkillItem } from '@/lib/cv-layout';
import { useLanguage } from '@/lib/i18n/LanguageContext';

const fieldClass = 'w-full min-h-11 bg-canvas border border-control rounded-[8px] px-3 text-sm text-text';

function fold(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function entryLabels(title: string, t: (key: string) => string): { heading: string; place: string } {
  const name = fold(title);
  if (name.includes('experienc')) return { heading: t('editor.sheet.role'), place: t('editor.sheet.company') };
  if (name.includes('educ') || name.includes('formacion')) return { heading: t('editor.form.degree'), place: t('editor.form.school') };
  if (name.includes('proyect') || name.includes('project')) return { heading: t('editor.form.projectTitle'), place: t('editor.form.organization') };
  return { heading: t('editor.form.entryTitle'), place: t('editor.form.organization') };
}

function Label({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-text-muted">{label}</span>
      {children}
    </label>
  );
}

export default function SectionForm({
  cvId,
  content,
  target,
  onContentChange,
  setSaveStatus,
  onBack,
}: {
  cvId: string;
  content: string;
  target: 'contact' | number;
  onContentChange: (markdown: string) => void;
  setSaveStatus: (status: 'saved' | 'saving' | 'error') => void;
  onBack: () => void;
}) {
  const { t } = useLanguage();
  const [doc, setDoc] = useState<CVContent>(() => parseCvDocument(content));
  const [entryIndex, setEntryIndex] = useState(0);
  const emitted = useRef(content);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSave = useRef<string | null>(null);
  const onChangeRef = useRef(onContentChange);
  const setSaveStatusRef = useRef(setSaveStatus);
  const firstField = useRef<HTMLInputElement>(null);
  onChangeRef.current = onContentChange;
  setSaveStatusRef.current = setSaveStatus;

  useEffect(() => {
    if (content === emitted.current) return;
    emitted.current = content;
    setDoc(parseCvDocument(content));
  }, [content]);

  useEffect(() => {
    setEntryIndex(0);
    firstField.current?.focus();
  }, [target]);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      const pending = pendingSave.current;
      if (pending !== null) void saveCvContent(cvId, pending);
    };
  }, [cvId]);

  const publish = (next: CVContent) => {
    const markdown = serializeCvDocument(next);
    emitted.current = markdown;
    setDoc(next);
    onChangeRef.current(markdown);
    pendingSave.current = markdown;
    setSaveStatusRef.current('saving');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const result = await saveCvContent(cvId, markdown);
      if (pendingSave.current === markdown) pendingSave.current = null;
      if (result.success) setSaveStatusRef.current('saved');
      else setSaveStatusRef.current('error');
    }, 1500);
  };

  const edit = (recipe: (draft: CVContent) => void) => {
    const next = structuredClone(doc);
    recipe(next);
    publish(next);
  };

  const section = target === 'contact' ? null : doc.sections[target];
  const heading = target === 'contact' ? t('editor.sections.contact') : (section?.title || t('editor.sheet.section'));

  return (
    <div className="h-full min-h-0 overflow-auto bg-surface">
      <div className="flex w-full flex-col gap-4 p-4 sm:p-5">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex min-h-11 items-center gap-2 rounded-[8px] px-1 text-sm font-semibold text-text hover:bg-surface-muted"
          >
            <ArrowLeft className="h-4 w-4 stroke-[1.75]" aria-hidden />
            {t('editor.sections.back')}
          </button>
          <h2 className="mt-2 font-display text-sm font-bold text-text">{heading}</h2>
          <p className="mt-1 text-xs text-text-muted">{t('editor.form.hint')}</p>
        </div>
        {target === 'contact' ? (
          <ContactFields doc={doc} edit={edit} firstField={firstField} />
        ) : section ? (
          <SectionFields
            section={section}
            sectionIndex={target}
            entryIndex={section.entries.length ? Math.min(entryIndex, section.entries.length - 1) : 0}
            setEntryIndex={setEntryIndex}
            edit={edit}
            firstField={firstField}
          />
        ) : (
          <p className="text-sm text-text-muted">{t('editor.form.missing')}</p>
        )}
      </div>
    </div>
  );
}

function ContactFields({
  doc,
  edit,
  firstField,
}: {
  doc: CVContent;
  edit: (recipe: (draft: CVContent) => void) => void;
  firstField: RefObject<HTMLInputElement>;
}) {
  const { t } = useLanguage();
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-subtle bg-surface p-4">
      <Label label={t('editor.sheet.name')}>
        <input
          ref={firstField}
          value={doc.name}
          autoComplete="off"
          className={fieldClass}
          onChange={(event) => edit((draft) => { draft.name = event.target.value; })}
        />
      </Label>
      {doc.contact.map((item, index) => (
        <div key={`contact-${index}`} className="grid gap-3">
          <Label label={t('editor.sheet.contactLabel')}>
            <input
              value={item.label}
              autoComplete="off"
              className={fieldClass}
              onChange={(event) => edit((draft) => { draft.contact[index].label = event.target.value; })}
            />
          </Label>
          <Label label={t('editor.sheet.contactValue')}>
            <input
              value={item.value}
              autoComplete="off"
              className={fieldClass}
              onChange={(event) => edit((draft) => { draft.contact[index].value = event.target.value; })}
            />
          </Label>
          <button
            type="button"
            className="min-h-11 px-2 text-xs font-semibold text-text-muted hover:text-danger-text"
            onClick={() => edit((draft) => { draft.contact.splice(index, 1); })}
          >
            {t('editor.form.removeContact')}
          </button>
        </div>
      ))}
      <div>
        <Button
          type="button"
          variant="secondary"
          onClick={() => edit((draft) => { draft.contact.push({ label: '', value: '' }); })}
        >
          <Plus className="h-4 w-4 stroke-[1.75]" aria-hidden />
          {t('editor.sheet.addContact')}
        </Button>
      </div>
    </div>
  );
}

function SectionFields({
  section,
  sectionIndex,
  entryIndex,
  setEntryIndex,
  edit,
  firstField,
}: {
  section: Section;
  sectionIndex: number;
  entryIndex: number;
  setEntryIndex: (index: number) => void;
  edit: (recipe: (draft: CVContent) => void) => void;
  firstField: RefObject<HTMLInputElement>;
}) {
  const { t } = useLanguage();
  const skills = isSkillsSection(section.title) || (
    section.entries.length === 0
    && section.bullets.length > 0
    && section.bullets.every((item) => splitSkillItem(item))
  );
  const textOnly = !skills && section.entries.length === 0 && section.bullets.length === 0 && section.paragraphs.length > 0;
  const labels = entryLabels(section.title, t);
  const entry = section.entries[entryIndex];

  const patchSection = (recipe: (draft: Section) => void) => {
    edit((draft) => {
      const current = draft.sections[sectionIndex];
      if (current) recipe(current);
    });
  };

  return (
    <>
      <div className="rounded-xl border border-subtle bg-surface p-4">
        <Label label={t('editor.sheet.section')}>
          <input
            ref={firstField}
            value={section.title}
            autoComplete="off"
            className={fieldClass}
            onChange={(event) => patchSection((draft) => { draft.title = event.target.value; })}
          />
        </Label>
      </div>

      {!skills && section.paragraphs.length > 0 ? (
        <div className="flex flex-col gap-3 rounded-xl border border-subtle bg-surface p-4">
          {section.paragraphs.map((paragraph, index) => (
            <Label key={`section-paragraph-${index}`} label={t('editor.sheet.paragraph')}>
              <textarea
                value={paragraph}
                rows={textOnly ? 8 : 4}
                className={`${fieldClass} py-2`}
                onChange={(event) => {
                  const value = event.target.value;
                  patchSection((draft) => { draft.paragraphs[index] = value; });
                }}
              />
            </Label>
          ))}
        </div>
      ) : null}

      {skills ? (
        <SkillFields section={section} patchSection={patchSection} />
      ) : !textOnly ? (
        <div className="flex flex-col items-stretch gap-4">
          <div className="flex flex-col gap-2 rounded-xl border border-subtle bg-surface p-2">
            <p className="px-2 pt-1 text-xs font-semibold text-text-muted">{t('editor.form.entries')}</p>
            {section.entries.map((item, index) => (
              <button
                key={`entry-${index}`}
                type="button"
                aria-current={index === entryIndex ? 'true' : undefined}
                className={`min-h-11 rounded-[8px] px-3 py-2 text-left ${index === entryIndex ? 'border border-control bg-canvas' : 'hover:bg-surface-muted'}`}
                onClick={() => setEntryIndex(index)}
              >
                <span className="block truncate text-sm font-semibold text-text">{item.heading || t('editor.form.untitled')}</span>
                {item.subheading ? <span className="block truncate text-xs text-text-muted">{item.subheading}</span> : null}
              </button>
            ))}
            {section.entries.length === 0 ? (
              <p className="px-2 py-3 text-sm text-text-muted">{t('editor.form.emptyEntries')}</p>
            ) : null}
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                const index = section.entries.length;
                patchSection((draft) => {
                  draft.entries.push({ heading: '', subheading: '', date: '', paragraphs: [], bullets: [] });
                });
                setEntryIndex(index);
              }}
            >
              <Plus className="h-4 w-4 stroke-[1.75]" aria-hidden />
              {t('editor.sheet.addEntry')}
            </Button>
          </div>
          {entry ? (
            <EntryFields
              entry={entry}
              labels={labels}
              onChange={(recipe) => patchSection((draft) => {
                const current = draft.entries[entryIndex];
                if (current) recipe(current);
              })}
              onRemove={() => {
                patchSection((draft) => { draft.entries.splice(entryIndex, 1); });
                setEntryIndex(Math.max(0, entryIndex - 1));
              }}
            />
          ) : null}
        </div>
      ) : null}

      {!skills && section.bullets.length > 0 ? (
        <BulletList
          items={section.bullets}
          onChange={(index, value) => patchSection((draft) => { draft.bullets[index] = value; })}
          onAdd={() => patchSection((draft) => { draft.bullets.push(''); })}
          onRemove={(index) => patchSection((draft) => { draft.bullets.splice(index, 1); })}
        />
      ) : null}
    </>
  );
}

function SkillFields({
  section,
  patchSection,
}: {
  section: Section;
  patchSection: (recipe: (draft: Section) => void) => void;
}) {
  const { t } = useLanguage();
  const rows = [
    ...section.paragraphs.map((item, index) => ({ kind: 'paragraph' as const, index, item })),
    ...section.bullets.map((item, index) => ({ kind: 'bullet' as const, index, item })),
    ...section.entries.flatMap((entry, entryIndex) => entry.bullets.map((item, index) => ({
      kind: 'entry' as const,
      entryIndex,
      index,
      item,
    }))),
  ];
  const write = (row: (typeof rows)[number], value: string) => {
    patchSection((draft) => {
      if (row.kind === 'entry') draft.entries[row.entryIndex].bullets[row.index] = value;
      else if (row.kind === 'paragraph') draft.paragraphs[row.index] = value;
      else draft.bullets[row.index] = value;
    });
  };
  const remove = (row: (typeof rows)[number]) => {
    patchSection((draft) => {
      if (row.kind === 'entry') draft.entries[row.entryIndex].bullets.splice(row.index, 1);
      else if (row.kind === 'paragraph') draft.paragraphs.splice(row.index, 1);
      else draft.bullets.splice(row.index, 1);
    });
  };
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-subtle bg-surface p-4">
      {rows.map((row) => {
        const parts = splitSkillItem(row.item);
        const key = row.kind === 'entry' ? `entry-${row.entryIndex}-${row.index}` : `${row.kind}-${row.index}`;
        if (!parts) {
          return (
            <Label key={key} label={t('editor.sheet.bullet')}>
              <textarea
                value={row.item}
                rows={2}
                className={`${fieldClass} py-2`}
                onChange={(event) => write(row, event.target.value)}
              />
            </Label>
          );
        }
        return (
          <div key={key} className="grid gap-3">
            <Label label={t('editor.sheet.contactLabel')}>
              <input
                value={parts.label}
                autoComplete="off"
                className={fieldClass}
                onChange={(event) => write(row, joinSkillItem(event.target.value, parts.value))}
              />
            </Label>
            <Label label={t('editor.sheet.contactValue')}>
              <textarea
                value={parts.value}
                rows={2}
                className={`${fieldClass} py-2`}
                onChange={(event) => write(row, joinSkillItem(parts.label, event.target.value))}
              />
            </Label>
            <button
              type="button"
              className="min-h-11 px-2 text-xs font-semibold text-text-muted hover:text-danger-text"
              onClick={() => remove(row)}
            >
              {t('editor.form.removeSkill')}
            </button>
          </div>
        );
      })}
      <div>
        <Button
          type="button"
          variant="secondary"
          onClick={() => patchSection((draft) => {
            const host = draft.entries.find((entry) => (
              !entry.heading.trim()
              && !entry.subheading.trim()
              && !entry.date.trim()
              && entry.paragraphs.every((paragraph) => !paragraph.trim())
            ));
            if (host && draft.bullets.length === 0) host.bullets.push(joinSkillItem('', ''));
            else draft.bullets.push(joinSkillItem('', ''));
          })}
        >
          <Plus className="h-4 w-4 stroke-[1.75]" aria-hidden />
          {t('editor.form.addSkill')}
        </Button>
      </div>
    </div>
  );
}

function EntryFields({
  entry,
  labels,
  onChange,
  onRemove,
}: {
  entry: Entry;
  labels: { heading: string; place: string };
  onChange: (recipe: (draft: Entry) => void) => void;
  onRemove: () => void;
}) {
  const { t } = useLanguage();
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-subtle bg-surface p-4">
      <Label label={labels.heading}>
        <input
          value={entry.heading}
          autoComplete="off"
          className={fieldClass}
          onChange={(event) => onChange((draft) => { draft.heading = event.target.value; })}
        />
      </Label>
      <div className="grid gap-3">
        <Label label={labels.place}>
          <input
            value={entry.subheading}
            autoComplete="off"
            className={fieldClass}
            onChange={(event) => onChange((draft) => { draft.subheading = event.target.value; })}
          />
        </Label>
        <Label label={t('editor.sheet.date')}>
          <input
            value={entry.date}
            autoComplete="off"
            placeholder={t('editor.form.datesPlaceholder')}
            className={fieldClass}
            onChange={(event) => onChange((draft) => { draft.date = event.target.value; })}
          />
        </Label>
      </div>
      {entry.paragraphs.map((paragraph, index) => (
        <Label key={`paragraph-${index}`} label={t('editor.sheet.paragraph')}>
          <textarea
            value={paragraph}
            rows={3}
            className={`${fieldClass} py-2`}
            onChange={(event) => onChange((draft) => { draft.paragraphs[index] = event.target.value; })}
          />
        </Label>
      ))}
      <BulletList
        items={entry.bullets}
        onChange={(index, value) => onChange((draft) => { draft.bullets[index] = value; })}
        onAdd={() => onChange((draft) => { draft.bullets.push(''); })}
        onRemove={(index) => onChange((draft) => { draft.bullets.splice(index, 1); })}
      />
      <div>
        <button
          type="button"
          className="min-h-11 text-xs font-semibold text-text-muted hover:text-danger-text"
          onClick={onRemove}
        >
          {t('editor.form.removeEntry')}
        </button>
      </div>
    </div>
  );
}

function BulletList({
  items,
  onChange,
  onAdd,
  onRemove,
}: {
  items: string[];
  onChange: (index: number, value: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}) {
  const { t } = useLanguage();
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-semibold text-text-muted">{t('editor.form.bullets')}</p>
      {items.map((item, index) => (
        <div key={`bullet-${index}`} className="flex items-start gap-2">
          <textarea
            value={item}
            rows={2}
            aria-label={t('editor.sheet.bullet')}
            placeholder={t('editor.form.bulletPlaceholder')}
            className={`${fieldClass} flex-1 py-2`}
            onChange={(event) => onChange(index, event.target.value)}
          />
          <button
            type="button"
            aria-label={t('editor.form.removeBullet')}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[8px] text-text-muted hover:text-danger-text"
            onClick={() => onRemove(index)}
          >
            <X className="h-4 w-4 stroke-[1.75]" aria-hidden />
          </button>
        </div>
      ))}
      <div>
        <Button type="button" variant="secondary" onClick={onAdd}>
          <Plus className="h-4 w-4 stroke-[1.75]" aria-hidden />
          {t('editor.sheet.addBullet')}
        </Button>
      </div>
    </div>
  );
}
