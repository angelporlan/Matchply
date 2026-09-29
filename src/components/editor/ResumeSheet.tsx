"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { saveCvContent } from '@/app/dashboard/actions';
import {
  htmlToInlineMarkdown,
  inlineMarkdownToHtml,
  parseCvDocument,
  serializeCvDocument,
  type CVContent,
} from '@/lib/cv-document';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import type { PdfZoom } from './PdfViewer';

const FONT_CSS: Record<string, string> = {
  helvetica: 'var(--font-sans), Inter, Helvetica, Arial, sans-serif',
  times: 'Georgia, "Times New Roman", Times, serif',
  courier: '"Courier New", ui-monospace, monospace',
};

function Field({
  id,
  value,
  rich = false,
  placeholder,
  className,
  style,
  onCommit,
  onEnter,
  onEmptyBackspace,
}: {
  id?: string;
  value: string;
  rich?: boolean;
  placeholder: string;
  className?: string;
  style?: CSSProperties;
  onCommit: (next: string) => void;
  onEnter?: () => void;
  onEmptyBackspace?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const focused = useRef(false);
  const valueRef = useRef(value);
  valueRef.current = value;

  const paint = (next: string) => {
    const node = ref.current;
    if (!node) return;
    if (rich) node.innerHTML = inlineMarkdownToHtml(next);
    else node.textContent = next;
  };

  useLayoutEffect(() => {
    if (focused.current) return;
    paint(value);
  }, [value, rich]);

  const read = () => {
    const node = ref.current;
    if (!node) return '';
    const raw = rich ? htmlToInlineMarkdown(node.innerHTML) : (node.textContent ?? '');
    return raw.replace(/\u00a0/g, ' ').replace(/\n+/g, ' ').trim();
  };

  return (
    <div
      id={id}
      ref={ref}
      role="textbox"
      aria-label={placeholder}
      contentEditable
      suppressContentEditableWarning
      spellCheck
      data-placeholder={placeholder}
      style={style}
      className={`cv-field outline-none rounded-sm focus:bg-black/[0.04] ${value.trim() ? '' : 'is-empty'} ${className ?? ''}`}
      onFocus={() => { focused.current = true; }}
      onBlur={() => {
        focused.current = false;
        const next = read();
        if (next !== valueRef.current) onCommit(next);
      }}
      onInput={() => {
        const next = read();
        if (next !== valueRef.current) onCommit(next);
      }}
      onPaste={(event) => {
        event.preventDefault();
        const text = event.clipboardData.getData('text/plain').replace(/\n+/g, ' ');
        document.execCommand('insertText', false, text);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          onEnter?.();
        }
        if (event.key === 'Backspace' && onEmptyBackspace && !read()) {
          event.preventDefault();
          onEmptyBackspace();
        }
      }}
    />
  );
}

export default function ResumeSheet({
  cvId,
  content,
  fontFamily,
  pageMargin,
  scale,
  accentColor,
  zoom,
  onContentChange,
  onSave,
  setSaveStatus,
}: {
  cvId: string;
  content: string;
  fontFamily: string;
  pageMargin: number;
  scale: number;
  accentColor: string;
  zoom: PdfZoom;
  onContentChange: (markdown: string) => void;
  onSave?: () => void;
  setSaveStatus: (status: 'saved' | 'saving' | 'error') => void;
}) {
  const { t } = useLanguage();
  const [doc, setDoc] = useState<CVContent>(() => parseCvDocument(content));
  const emitted = useRef(content);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSave = useRef<string | null>(null);
  const focusId = useRef<string | null>(null);
  const onChangeRef = useRef(onContentChange);
  const onSaveRef = useRef(onSave);
  const setSaveStatusRef = useRef(setSaveStatus);
  onChangeRef.current = onContentChange;
  onSaveRef.current = onSave;
  setSaveStatusRef.current = setSaveStatus;

  useEffect(() => {
    if (content === emitted.current) return;
    emitted.current = content;
    setDoc(parseCvDocument(content));
  }, [content]);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      const pending = pendingSave.current;
      if (pending !== null) void saveCvContent(cvId, pending);
    };
  }, [cvId]);

  useEffect(() => {
    if (!focusId.current) return;
    const id = focusId.current;
    focusId.current = null;
    document.getElementById(id)?.focus();
  }, [doc]);

  const publish = (next: CVContent, focus?: string) => {
    if (focus) focusId.current = focus;
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
      if (result.success) {
        setSaveStatusRef.current('saved');
        onSaveRef.current?.();
      } else {
        setSaveStatusRef.current('error');
      }
    }, 1500);
  };

  const edit = (recipe: (draft: CVContent) => void, focus?: string) => {
    const next = structuredClone(doc);
    recipe(next);
    publish(next, focus);
  };

  const fitted = zoom === 'fit';
  const percent = fitted ? 100 : zoom;
  const pt = (size: number) => `${Math.round(size * scale * 10) / 10}pt`;
  const font = FONT_CSS[fontFamily] || FONT_CSS.helvetica;

  return (
    <div className="h-full min-h-0 overflow-auto bg-surface-muted">
      <style>{`
        .cv-field.is-empty:before {
          content: attr(data-placeholder);
          color: #a3a3a3;
          pointer-events: none;
        }
      `}</style>
      <article
        className="mx-auto my-4 sm:my-6 bg-white text-black shadow-md"
        style={{
          width: fitted ? 'min(210mm, calc(100% - 2rem))' : `${(210 * percent) / 100}mm`,
          padding: `${pageMargin}pt`,
          fontFamily: font,
          fontSize: pt(9),
          lineHeight: 1.35,
        }}
        aria-label={t('editor.header.document')}
      >
        <Field
          value={doc.name}
          placeholder={t('editor.sheet.name')}
          onCommit={(name) => edit((draft) => { draft.name = name; })}
          className="text-center font-bold uppercase"
          style={{ fontSize: pt(20), letterSpacing: '0.06em', textAlign: 'center', fontWeight: 700, textTransform: 'uppercase' }}
        />
        <div id="cv-contact" className="group mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center" style={{ fontSize: pt(8.5), color: '#555' }}>
          {doc.contact.map((item, index) => (
            <span key={`contact-${index}`} className="inline-flex items-center gap-1">
              <Field
                id={index === doc.contact.length - 1 ? 'cv-contact-last' : undefined}
                value={item.label}
                placeholder={t('editor.sheet.contactLabel')}
                onCommit={(label) => edit((draft) => { draft.contact[index].label = label; })}
                className="inline-block min-w-[3rem]"
              />
              <span>:</span>
              <Field
                value={item.value}
                placeholder={t('editor.sheet.contactValue')}
                onCommit={(value) => edit((draft) => { draft.contact[index].value = value; })}
                className="inline-block min-w-[4rem]"
              />
              {index < doc.contact.length - 1 && <span aria-hidden className="pl-1">·</span>}
            </span>
          ))}
          <button
            type="button"
            className="min-h-11 px-2 text-[11px] font-semibold text-neutral-500 hover:text-black opacity-100 lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100"
            onClick={() => edit((draft) => { draft.contact.push({ label: '', value: '' }); }, 'cv-contact-last')}
          >
            {t('editor.sheet.addContact')}
          </button>
        </div>
        <div className="mt-3 border-t" style={{ borderColor: accentColor }} />

        {doc.sections.map((section, sectionIndex) => (
          <section key={`section-${sectionIndex}`} id={`cv-section-${sectionIndex}`} className="group mt-4">
            <div className="flex items-end justify-between gap-2 border-b pb-0.5" style={{ borderColor: accentColor }}>
              <Field
                value={section.title}
                placeholder={t('editor.sheet.section')}
                onCommit={(title) => edit((draft) => { draft.sections[sectionIndex].title = title; })}
                className="min-w-0 flex-1 font-bold uppercase tracking-wide"
                style={{ fontSize: pt(11), color: accentColor, fontWeight: 700 }}
              />
              <div className="flex shrink-0 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100">
                <button type="button" className="min-h-11 px-2 text-[11px] font-semibold text-neutral-500 hover:text-black" aria-label={t('editor.sheet.moveUp')} disabled={sectionIndex === 0} onClick={() => edit((draft) => {
                  const [item] = draft.sections.splice(sectionIndex, 1);
                  draft.sections.splice(sectionIndex - 1, 0, item);
                })}>↑</button>
                <button type="button" className="min-h-11 px-2 text-[11px] font-semibold text-neutral-500 hover:text-black" aria-label={t('editor.sheet.moveDown')} disabled={sectionIndex === doc.sections.length - 1} onClick={() => edit((draft) => {
                  const [item] = draft.sections.splice(sectionIndex, 1);
                  draft.sections.splice(sectionIndex + 1, 0, item);
                })}>↓</button>
              </div>
            </div>
            {section.paragraphs.map((paragraph, paragraphIndex) => (
              <Field
                key={`p-${sectionIndex}-${paragraphIndex}`}
                rich
                value={paragraph}
                placeholder={t('editor.sheet.paragraph')}
                onCommit={(next) => edit((draft) => { draft.sections[sectionIndex].paragraphs[paragraphIndex] = next; })}
                className="mt-2"
              />
            ))}
            {section.paragraphs.length === 0 && section.entries.length === 0 && section.bullets.length === 0 && (
              <Field
                rich
                value=""
                placeholder={t('editor.sheet.paragraph')}
                onCommit={(next) => { if (next) edit((draft) => { draft.sections[sectionIndex].paragraphs.push(next); }); }}
                className="mt-2"
              />
            )}

            {section.entries.map((entry, entryIndex) => (
              <div key={`e-${sectionIndex}-${entryIndex}`} className="mt-3">
                <div className="flex items-start justify-between gap-3">
                  <Field
                    id={`cv-entry-${sectionIndex}-${entryIndex}`}
                    value={entry.heading}
                    placeholder={t('editor.sheet.role')}
                    onCommit={(heading) => edit((draft) => { draft.sections[sectionIndex].entries[entryIndex].heading = heading; })}
                    className="font-bold flex-1"
                    style={{ fontSize: pt(10), fontWeight: 700 }}
                  />
                  <Field
                    value={entry.date}
                    placeholder={t('editor.sheet.date')}
                    onCommit={(date) => edit((draft) => { draft.sections[sectionIndex].entries[entryIndex].date = date; })}
                    className="shrink-0 text-right"
                    style={{ fontSize: pt(9), color: '#555' }}
                  />
                </div>
                <Field
                  value={entry.subheading}
                  placeholder={t('editor.sheet.company')}
                  onCommit={(subheading) => edit((draft) => { draft.sections[sectionIndex].entries[entryIndex].subheading = subheading; })}
                  className="italic"
                />
                <ul className="mt-1 space-y-0.5">
                  {entry.bullets.map((bullet, bulletIndex) => (
                    <li key={`b-${sectionIndex}-${entryIndex}-${bulletIndex}`} className="flex gap-2">
                      <span aria-hidden className="mt-1">•</span>
                      <Field
                        id={`cv-bullet-${sectionIndex}-${entryIndex}-${bulletIndex}`}
                        rich
                        value={bullet}
                        placeholder={t('editor.sheet.bullet')}
                        onCommit={(next) => edit((draft) => { draft.sections[sectionIndex].entries[entryIndex].bullets[bulletIndex] = next; })}
                        onEnter={() => {
                          const id = `cv-bullet-${sectionIndex}-${entryIndex}-${bulletIndex + 1}`;
                          edit((draft) => {
                            draft.sections[sectionIndex].entries[entryIndex].bullets.splice(bulletIndex + 1, 0, '');
                          }, id);
                        }}
                        onEmptyBackspace={() => edit((draft) => {
                          draft.sections[sectionIndex].entries[entryIndex].bullets.splice(bulletIndex, 1);
                        }, bulletIndex > 0 ? `cv-bullet-${sectionIndex}-${entryIndex}-${bulletIndex - 1}` : undefined)}
                        className="flex-1"
                      />
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="min-h-11 px-1 text-[11px] font-semibold text-neutral-500 hover:text-black"
                  onClick={() => {
                    const id = `cv-bullet-${sectionIndex}-${entryIndex}-${entry.bullets.length}`;
                    edit((draft) => { draft.sections[sectionIndex].entries[entryIndex].bullets.push(''); }, id);
                  }}
                >
                  {t('editor.sheet.addBullet')}
                </button>
              </div>
            ))}

            {section.bullets.length > 0 && (
              <ul className="mt-2 space-y-0.5">
                {section.bullets.map((bullet, bulletIndex) => (
                  <li key={`sb-${sectionIndex}-${bulletIndex}`} className="flex gap-2">
                    <span aria-hidden>•</span>
                    <Field
                      id={`cv-sbullet-${sectionIndex}-${bulletIndex}`}
                      rich
                      value={bullet}
                      placeholder={t('editor.sheet.bullet')}
                      onCommit={(next) => edit((draft) => { draft.sections[sectionIndex].bullets[bulletIndex] = next; })}
                      onEnter={() => edit((draft) => {
                        draft.sections[sectionIndex].bullets.splice(bulletIndex + 1, 0, '');
                      }, `cv-sbullet-${sectionIndex}-${bulletIndex + 1}`)}
                      onEmptyBackspace={() => edit((draft) => {
                        draft.sections[sectionIndex].bullets.splice(bulletIndex, 1);
                      })}
                      className="flex-1"
                    />
                  </li>
                ))}
              </ul>
            )}

            <div className="flex flex-wrap gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100">
              <button
                type="button"
                className="min-h-11 px-2 text-[11px] font-semibold text-neutral-500 hover:text-black"
                onClick={() => edit((draft) => {
                  draft.sections[sectionIndex].entries.push({ heading: '', subheading: '', date: '', paragraphs: [], bullets: [] });
                }, `cv-entry-${sectionIndex}-${section.entries.length}`)}
              >
                {t('editor.sheet.addEntry')}
              </button>
              {section.entries.length === 0 && (
                <button
                  type="button"
                  className="min-h-11 px-2 text-[11px] font-semibold text-neutral-500 hover:text-black"
                  onClick={() => edit((draft) => { draft.sections[sectionIndex].bullets.push(''); }, `cv-sbullet-${sectionIndex}-${section.bullets.length}`)}
                >
                  {t('editor.sheet.addBullet')}
                </button>
              )}
            </div>
          </section>
        ))}

        <button
          type="button"
          className="mt-4 min-h-11 px-2 text-xs font-semibold text-neutral-500 hover:text-black"
          onClick={() => edit((draft) => {
            draft.sections.push({ title: '', paragraphs: [], entries: [], bullets: [] });
          }, `cv-section-${doc.sections.length}`)}
        >
          {t('editor.sheet.addSection')}
        </button>
      </article>
    </div>
  );
}
