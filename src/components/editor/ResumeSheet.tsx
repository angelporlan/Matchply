"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { saveCvContent } from '@/app/dashboard/actions';
import {
  htmlToInlineMarkdown,
  inlineMarkdownToHtml,
  parseCvDocument,
  serializeCvDocument,
  type ContactInfo,
  type CVContent,
} from '@/lib/cv-document';
import {
  A4_HEIGHT_PT,
  CSS_PX_PER_PT,
  CV_FONT_FACE,
  CV_FONT_STACK,
  CV_METRICS,
  PDF_COLORS,
  SVG_ICONS,
  contentWidthPt,
  cvFontFamily,
  fontLine,
  fontLineRatio,
  getIconType,
  isSkillsSection,
  joinSkillItem,
  layoutForScale,
  sanitizePdfText,
  splitSkillItem,
  wrapContactItems,
} from '@/lib/cv-layout';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import type { PdfZoom } from './PdfViewer';
import './cv-fonts.css';

function pt(value: number): string {
  return `${value}pt`;
}

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
    const visible = sanitizePdfText(next);
    if (rich) node.innerHTML = inlineMarkdownToHtml(visible);
    else node.textContent = visible;
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

  const commitIfChanged = (next: string) => {
    if (sanitizePdfText(next) === sanitizePdfText(valueRef.current)) return;
    onCommit(next);
  };

  return (
    <div
      id={id}
      ref={ref}
      role="textbox"
      aria-label={placeholder}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      data-placeholder={placeholder}
      style={style}
      className={`cv-field ${value.trim() ? '' : 'is-empty'} ${className ?? ''}`}
      onFocus={() => { focused.current = true; }}
      onBlur={() => {
        focused.current = false;
        commitIfChanged(read());
      }}
      onInput={() => commitIfChanged(read())}
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

function CvIcon({ type, sizePt }: { type: string; sizePt: number }) {
  const d = SVG_ICONS[type];
  if (!d) return null;
  const length = pt(sizePt);
  return (
    <svg
      viewBox="0 0 24 24"
      width={length}
      height={length}
      aria-hidden
      focusable="false"
      style={{ display: 'block', flexShrink: 0, marginTop: pt(-CV_METRICS.iconLift), marginRight: pt(CV_METRICS.iconGap) }}
    >
      <path d={d} fill={PDF_COLORS.muted} />
    </svg>
  );
}

function Rule({ color, thickness, before, after }: { color: string; thickness: number; before: number; after: number }) {
  const half = thickness / 2;
  return (
    <div
      aria-hidden
      style={{
        height: pt(thickness),
        background: color,
        marginTop: pt(before - half),
        marginBottom: pt(after - half),
      }}
    />
  );
}

function measureContactLines(contact: ContactInfo[], face: string, contactSize: number, pageMargin: number): number[][] {
  if (!contact.length) return [];
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) return [contact.map((_, index) => index)];
  context.font = `${contactSize}pt "${face}"`;
  const separatorWidth = context.measureText(CV_METRICS.contactSeparator).width;
  const iconWidth = (contactSize * CV_METRICS.contactIconScale + CV_METRICS.iconGap) * CSS_PX_PER_PT;
  const items = contact.map((item) => ({
    textWidth: context.measureText(`${sanitizePdfText(item.label)}: `).width + context.measureText(sanitizePdfText(item.value)).width,
    iconWidth: getIconType(item.label, item.value) ? iconWidth : 0,
  }));
  return wrapContactItems(items, separatorWidth, contentWidthPt(pageMargin) * CSS_PX_PER_PT);
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
  const contactRef = useRef(doc.contact);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLElement>(null);
  const [fitScale, setFitScale] = useState(1);
  const [pageHeight, setPageHeight] = useState(0);
  const [ready, setReady] = useState(false);
  const [contactLines, setContactLines] = useState<number[][]>(() => (
    doc.contact.length ? [doc.contact.map((_, index) => index)] : []
  ));
  onChangeRef.current = onContentChange;
  onSaveRef.current = onSave;
  setSaveStatusRef.current = setSaveStatus;
  contactRef.current = doc.contact;

  const layout = layoutForScale(scale);
  const family = cvFontFamily(fontFamily);
  const face = CV_FONT_FACE[family];
  const em = fontLineRatio(family);
  const bodyLine = fontLine(layout.bodySize, family);
  const textAdvance = bodyLine + layout.lineGap;
  const sectionGapPt = layout.sectionGap * bodyLine;
  const firstSectionGapPt = layout.sectionGap * fontLine(
    doc.contact.length ? layout.contactSize : layout.nameSize,
    family,
  );
  const paragraphGapPt = layout.paragraphGap * bodyLine;
  const bulletGapPt = layout.bulletGap * bodyLine;
  const entryGapPt = layout.entryGap * bodyLine;
  const contactKey = doc.contact.map((item) => `${item.label}\0${item.value}`).join('\n');
  const measuredCovers = contactLines.flat().length === doc.contact.length
    && contactLines.every((line) => line.every((index) => doc.contact[index]));
  const visibleContactLines = measuredCovers
    ? contactLines
    : [doc.contact.map((_, index) => index)].filter((line) => line.length);

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

  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const measure = () => {
      const styles = getComputedStyle(scroller);
      const pad = (parseFloat(styles.paddingLeft) || 0) + (parseFloat(styles.paddingRight) || 0);
      const pagePx = (210 / 25.4) * 96;
      const available = Math.max(160, scroller.clientWidth - pad);
      setFitScale(available / pagePx);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(scroller);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const page = pageRef.current;
    if (!page) return;
    const measure = () => setPageHeight(page.offsetHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(page);
    return () => observer.disconnect();
  }, [doc, ready, contactLines, fontFamily, pageMargin, scale, accentColor]);

  useLayoutEffect(() => {
    let cancelled = false;
    const specs = [
      `400 ${layout.contactSize}pt "${face}"`,
      `700 ${layout.nameSize}pt "${face}"`,
      `400 ${layout.bodySize}pt "${face}"`,
      `700 ${layout.bodySize}pt "${face}"`,
      `italic 400 ${layout.metaSize}pt "${face}"`,
      `700 ${layout.headingSize}pt "${face}"`,
      `700 ${layout.sectionSize}pt "${face}"`,
    ];
    if (document.fonts.check(`${layout.contactSize}pt "${face}"`)) {
      setContactLines(measureContactLines(contactRef.current, face, layout.contactSize, pageMargin));
    }
    const run = async () => {
      await Promise.race([
        Promise.all(specs.map((spec) => document.fonts.load(spec))),
        new Promise((resolve) => setTimeout(resolve, 2500)),
      ]);
      if (cancelled) return;
      setContactLines(measureContactLines(contactRef.current, face, layout.contactSize, pageMargin));
      setReady(true);
    };
    void run();
    return () => { cancelled = true; };
  }, [contactKey, face, layout.contactSize, layout.nameSize, layout.bodySize, layout.metaSize, layout.headingSize, layout.sectionSize, pageMargin]);

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

  const factor = zoom === 'fit' ? fitScale : zoom / 100;
  const fallbackHeight = A4_HEIGHT_PT * CSS_PX_PER_PT;
  const iconSize = layout.contactSize * CV_METRICS.contactIconScale;

  const bodyStyle: CSSProperties = {
    fontSize: pt(layout.bodySize),
    lineHeight: pt(textAdvance),
    fontWeight: 400,
    color: PDF_COLORS.text,
  };
  const paragraphStyle: CSSProperties = { ...bodyStyle, marginBottom: pt(paragraphGapPt) };

  const renderBullet = (
    bullet: string,
    bulletId: string,
    onCommit: (next: string) => void,
    onEnter?: () => void,
    onEmptyBackspace?: () => void,
  ) => (
    <div key={bulletId} style={{ position: 'relative', paddingLeft: pt(CV_METRICS.bulletText), marginBottom: pt(bulletGapPt), ...bodyStyle }}>
      <span aria-hidden style={{ position: 'absolute', left: pt(CV_METRICS.bulletMark), top: 0 }}>{'\u2022'}</span>
      <Field
        id={bulletId}
        rich
        value={bullet}
        placeholder={t('editor.sheet.bullet')}
        onCommit={onCommit}
        onEnter={onEnter}
        onEmptyBackspace={onEmptyBackspace}
      />
    </div>
  );

  const renderSkill = (item: string, itemId: string, onCommit: (next: string) => void) => {
    const parts = splitSkillItem(item);
    const rowStyle: CSSProperties = {
      display: 'flow-root',
      paddingLeft: pt(CV_METRICS.skillIndent),
      marginBottom: pt(CV_METRICS.skillMoveDown * bodyLine),
      ...bodyStyle,
    };
    if (!parts) {
      return (
        <div key={itemId} style={rowStyle}>
          <Field id={itemId} rich value={item} placeholder={t('editor.sheet.bullet')} onCommit={onCommit} />
        </div>
      );
    }
    const labelStyle: CSSProperties = { display: 'inline' };
    return (
      <div key={itemId} style={rowStyle}>
        {[
          <div key={`${itemId}-label`} style={{ float: 'left', whiteSpace: 'pre', fontWeight: 700, color: accentColor }}>
            <Field
              id={itemId}
              value={parts.label}
              placeholder={t('editor.sheet.contactLabel')}
              onCommit={(label) => onCommit(joinSkillItem(label, parts.value))}
              style={labelStyle}
            />{': '}
          </div>,
          <Field
            key={`${itemId}-value`}
            rich
            value={parts.value}
            placeholder={t('editor.sheet.contactValue')}
            onCommit={(value) => onCommit(joinSkillItem(parts.label, value))}
          />,
        ]}
      </div>
    );
  };

  return (
    <div ref={scrollerRef} className="cv-sheet-scroll h-full min-h-0 overflow-auto bg-surface-muted">
      <div style={{ width: `calc(210mm * ${factor})`, height: (pageHeight || fallbackHeight) * factor, margin: '0 auto', position: 'relative' }}>
        <article
          ref={pageRef}
          className="cv-sheet"
          data-cv-ready={ready ? 'true' : 'false'}
          aria-label={t('editor.header.document')}
          style={{
            width: '210mm',
            minHeight: '297mm',
            boxSizing: 'border-box',
            padding: `${pt(pageMargin)} ${pt(pageMargin)} 0`,
            background: '#ffffff',
            color: PDF_COLORS.text,
            fontFamily: CV_FONT_STACK[family],
            fontWeight: 400,
            fontSynthesis: 'none',
            transform: `scale(${factor})`,
            transformOrigin: 'top left',
            position: 'absolute',
            left: 0,
            top: 0,
            visibility: ready ? 'visible' : 'hidden',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.12)',
          }}
        >
          <Field
            value={doc.name}
            placeholder={t('editor.sheet.name')}
            onCommit={(name) => edit((draft) => { draft.name = name; })}
            style={{
              fontSize: pt(layout.nameSize),
              lineHeight: em,
              fontWeight: 700,
              textAlign: 'center',
              textTransform: 'uppercase',
              letterSpacing: pt(CV_METRICS.nameCharacterSpacing),
              color: PDF_COLORS.text,
              paddingBottom: pt(CV_METRICS.nameMoveDown * fontLine(layout.nameSize, family)),
            }}
          />

          <div id="cv-contact" className="cv-group" style={{ position: 'relative' }}>
            <div style={{ display: 'flex', flexDirection: 'column', rowGap: pt(CV_METRICS.contactLineExtra) }}>
              {visibleContactLines.map((line) => (
                <div
                  key={`contact-line-${line.join('-')}`}
                  style={{
                    height: pt(layout.contactSize),
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'flex-start',
                    flexWrap: 'nowrap',
                    columnGap: 0,
                    fontSize: pt(layout.contactSize),
                    lineHeight: 1,
                    fontWeight: 400,
                    color: PDF_COLORS.muted,
                  }}
                >
                  {line.flatMap((index, position) => {
                    const item = doc.contact[index];
                    if (!item) return [];
                    const icon = getIconType(item.label, item.value);
                    const nodes: ReactNode[] = [];
                    if (position > 0) {
                      nodes.push(
                        <span key={`sep-${index}`} style={{ whiteSpace: 'pre', flexShrink: 0, lineHeight: 1 }}>
                          {CV_METRICS.contactSeparator}
                        </span>,
                      );
                    }
                    nodes.push(
                      <span key={`contact-${index}`} style={{ display: 'inline-flex', alignItems: 'flex-start', flexShrink: 0, fontSize: 0, lineHeight: 1 }}>
                        {icon ? <CvIcon type={icon} sizePt={iconSize} /> : null}
                        <Field
                          id={index === doc.contact.length - 1 ? 'cv-contact-last' : undefined}
                          value={item.label}
                          placeholder={t('editor.sheet.contactLabel')}
                          onCommit={(label) => edit((draft) => { draft.contact[index].label = label; })}
                          style={{ display: 'inline-block', whiteSpace: 'nowrap', lineHeight: 1, fontWeight: 400, fontSize: pt(layout.contactSize), color: PDF_COLORS.muted }}
                        />
                        <span style={{ whiteSpace: 'pre', lineHeight: 1, fontSize: pt(layout.contactSize), color: PDF_COLORS.muted }}>{': '}</span>
                        <Field
                          value={item.value}
                          placeholder={t('editor.sheet.contactValue')}
                          onCommit={(value) => edit((draft) => { draft.contact[index].value = value; })}
                          style={{ display: 'inline-block', whiteSpace: 'nowrap', lineHeight: 1, fontWeight: 400, fontSize: pt(layout.contactSize), color: PDF_COLORS.muted }}
                        />
                      </span>,
                    );
                    return nodes;
                  })}
                </div>
              ))}
            </div>
            <div className="cv-chrome" style={{ left: '100%', top: 0, paddingLeft: 6 }}>
              <button
                type="button"
                onClick={() => edit((draft) => { draft.contact.push({ label: '', value: '' }); }, 'cv-contact-last')}
              >
                {t('editor.sheet.addContact')}
              </button>
            </div>
          </div>

          <Rule color={accentColor} thickness={CV_METRICS.headerRuleWidth} before={CV_METRICS.headerRuleGap} after={CV_METRICS.afterHeaderRule} />

          {doc.sections.map((section, sectionIndex) => {
            const skills = isSkillsSection(section.title);
            return (
              <section
                key={`section-${sectionIndex}`}
                id={`cv-section-${sectionIndex}`}
                className="cv-group"
                style={{ position: 'relative', paddingTop: pt(sectionIndex === 0 ? firstSectionGapPt : sectionGapPt), paddingBottom: pt(sectionGapPt) }}
              >
                <div className="cv-chrome" style={{ left: '100%', top: 0, paddingLeft: 6, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button type="button" aria-label={t('editor.sheet.moveUp')} disabled={sectionIndex === 0} onClick={() => edit((draft) => {
                      const [item] = draft.sections.splice(sectionIndex, 1);
                      draft.sections.splice(sectionIndex - 1, 0, item);
                    })}>↑</button>
                    <button type="button" aria-label={t('editor.sheet.moveDown')} disabled={sectionIndex === doc.sections.length - 1} onClick={() => edit((draft) => {
                      const [item] = draft.sections.splice(sectionIndex, 1);
                      draft.sections.splice(sectionIndex + 1, 0, item);
                    })}>↓</button>
                  </div>
                  <button
                    type="button"
                    onClick={() => edit((draft) => {
                      draft.sections[sectionIndex].entries.push({ heading: '', subheading: '', date: '', paragraphs: [], bullets: [] });
                    }, `cv-entry-${sectionIndex}-${section.entries.length}`)}
                  >
                    {t('editor.sheet.addEntry')}
                  </button>
                  <button
                    type="button"
                    onClick={() => edit((draft) => {
                      draft.sections[sectionIndex].bullets.push('');
                    }, `cv-sbullet-${sectionIndex}-${section.bullets.length}`)}
                  >
                    {t('editor.sheet.addBullet')}
                  </button>
                </div>

                <Field
                  value={section.title}
                  placeholder={t('editor.sheet.section')}
                  onCommit={(title) => edit((draft) => { draft.sections[sectionIndex].title = title; })}
                  style={{
                    fontSize: pt(layout.sectionSize),
                    lineHeight: (layout.sectionSize + CV_METRICS.sectionTitleExtra) / layout.sectionSize,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0pt',
                    color: accentColor,
                  }}
                />
                <Rule
                  color={accentColor}
                  thickness={CV_METRICS.sectionRuleWidth}
                  before={CV_METRICS.sectionRuleGap}
                  after={CV_METRICS.afterSectionRule}
                />

                {skills ? (
                  <>
                    {section.paragraphs.map((paragraph, paragraphIndex) => renderSkill(
                      paragraph,
                      `cv-skill-p-${sectionIndex}-${paragraphIndex}`,
                      (next) => edit((draft) => { draft.sections[sectionIndex].paragraphs[paragraphIndex] = next; }),
                    ))}
                    {section.bullets.map((bullet, bulletIndex) => renderSkill(
                      bullet,
                      `cv-skill-b-${sectionIndex}-${bulletIndex}`,
                      (next) => edit((draft) => { draft.sections[sectionIndex].bullets[bulletIndex] = next; }),
                    ))}
                  </>
                ) : (
                  <>
                    {section.paragraphs.map((paragraph, paragraphIndex) => (
                      <Field
                        key={`p-${sectionIndex}-${paragraphIndex}`}
                        rich
                        value={paragraph}
                        placeholder={t('editor.sheet.paragraph')}
                        onCommit={(next) => edit((draft) => { draft.sections[sectionIndex].paragraphs[paragraphIndex] = next; })}
                        style={paragraphStyle}
                      />
                    ))}
                  </>
                )}

                {section.paragraphs.length === 0 && section.entries.length === 0 && section.bullets.length === 0 && (
                  <Field
                    rich
                    value=""
                    placeholder={t('editor.sheet.paragraph')}
                    className="cv-collapse"
                    onCommit={(next) => { if (next) edit((draft) => { draft.sections[sectionIndex].paragraphs.push(next); }); }}
                    style={paragraphStyle}
                  />
                )}

                {section.entries.map((entry, entryIndex) => {
                  const hasDate = entry.date.trim().length > 0;
                  const hasCompany = entry.subheading.trim().length > 0;
                  const preSize = hasCompany || hasDate ? layout.metaSize : layout.headingSize;
                  const preBullet = CV_METRICS.entryPreBullet * fontLine(preSize, family);
                  const headHeight = hasDate ? fontLine(layout.metaSize, family) + CV_METRICS.entryDateNudge : undefined;
                  return (
                    <div key={`e-${sectionIndex}-${entryIndex}`} className="cv-group" style={{ position: 'relative', paddingBottom: pt(entryGapPt) }}>
                      <div className="cv-chrome" style={{ left: '100%', bottom: 0, paddingLeft: 6 }}>
                        <button
                          type="button"
                          onClick={() => {
                            const id = `cv-bullet-${sectionIndex}-${entryIndex}-${entry.bullets.length}`;
                            edit((draft) => { draft.sections[sectionIndex].entries[entryIndex].bullets.push(''); }, id);
                          }}
                        >
                          {t('editor.sheet.addBullet')}
                        </button>
                      </div>
                      <div className="cv-head" style={{ position: 'relative', height: headHeight !== undefined ? pt(headHeight) : undefined }}>
                        <Field
                          id={`cv-entry-${sectionIndex}-${entryIndex}`}
                          value={entry.heading}
                          placeholder={t('editor.sheet.role')}
                          onCommit={(heading) => edit((draft) => { draft.sections[sectionIndex].entries[entryIndex].heading = heading; })}
                          style={{
                            width: `${CV_METRICS.entryHeadingRatio * 100}%`,
                            fontSize: pt(layout.headingSize),
                            lineHeight: em,
                            fontWeight: 700,
                            color: PDF_COLORS.text,
                          }}
                        />
                        <Field
                          value={entry.date}
                          placeholder={t('editor.sheet.date')}
                          className={hasDate ? undefined : 'cv-date-empty'}
                          onCommit={(date) => edit((draft) => { draft.sections[sectionIndex].entries[entryIndex].date = date; })}
                          style={{
                            position: 'absolute',
                            top: 0,
                            right: 0,
                            width: 'max-content',
                            fontSize: pt(layout.metaSize),
                            lineHeight: em,
                            fontWeight: 400,
                            color: PDF_COLORS.muted,
                            textAlign: 'right',
                            whiteSpace: 'nowrap',
                          }}
                        />
                      </div>
                      {hasCompany ? (
                        <Field
                          value={entry.subheading}
                          placeholder={t('editor.sheet.company')}
                          onCommit={(subheading) => edit((draft) => { draft.sections[sectionIndex].entries[entryIndex].subheading = subheading; })}
                          style={{
                            fontSize: pt(layout.metaSize),
                            lineHeight: em,
                            fontStyle: 'italic',
                            fontWeight: 400,
                            color: PDF_COLORS.text,
                            marginBottom: pt(preBullet),
                          }}
                        />
                      ) : (
                        <>
                          <Field
                            value={entry.subheading}
                            placeholder={t('editor.sheet.company')}
                            className="cv-collapse"
                            onCommit={(subheading) => edit((draft) => { draft.sections[sectionIndex].entries[entryIndex].subheading = subheading; })}
                            style={{
                              fontSize: pt(layout.metaSize),
                              lineHeight: em,
                              fontStyle: 'italic',
                              fontWeight: 400,
                              color: PDF_COLORS.text,
                            }}
                          />
                          <div aria-hidden style={{ height: pt(preBullet) }} />
                        </>
                      )}
                      {entry.paragraphs.map((paragraph, paragraphIndex) => (
                        <Field
                          key={`ep-${sectionIndex}-${entryIndex}-${paragraphIndex}`}
                          rich
                          value={paragraph}
                          placeholder={t('editor.sheet.paragraph')}
                          onCommit={(next) => edit((draft) => { draft.sections[sectionIndex].entries[entryIndex].paragraphs[paragraphIndex] = next; })}
                          style={paragraphStyle}
                        />
                      ))}
                      {entry.bullets.map((bullet, bulletIndex) => renderBullet(
                        bullet,
                        `cv-bullet-${sectionIndex}-${entryIndex}-${bulletIndex}`,
                        (next) => edit((draft) => { draft.sections[sectionIndex].entries[entryIndex].bullets[bulletIndex] = next; }),
                        () => {
                          const id = `cv-bullet-${sectionIndex}-${entryIndex}-${bulletIndex + 1}`;
                          edit((draft) => {
                            draft.sections[sectionIndex].entries[entryIndex].bullets.splice(bulletIndex + 1, 0, '');
                          }, id);
                        },
                        () => edit((draft) => {
                          draft.sections[sectionIndex].entries[entryIndex].bullets.splice(bulletIndex, 1);
                        }, bulletIndex > 0 ? `cv-bullet-${sectionIndex}-${entryIndex}-${bulletIndex - 1}` : undefined),
                      ))}
                    </div>
                  );
                })}

                {!skills && section.bullets.map((bullet, bulletIndex) => renderBullet(
                  bullet,
                  `cv-sbullet-${sectionIndex}-${bulletIndex}`,
                  (next) => edit((draft) => { draft.sections[sectionIndex].bullets[bulletIndex] = next; }),
                  () => edit((draft) => {
                    draft.sections[sectionIndex].bullets.splice(bulletIndex + 1, 0, '');
                  }, `cv-sbullet-${sectionIndex}-${bulletIndex + 1}`),
                  () => edit((draft) => {
                    draft.sections[sectionIndex].bullets.splice(bulletIndex, 1);
                  }),
                ))}
              </section>
            );
          })}
        </article>
      </div>
      <div className="flex justify-center pt-4 pb-6">
        <button
          type="button"
          className="min-h-11 px-3 text-xs font-semibold text-text-muted hover:text-text"
          onClick={() => edit((draft) => {
            draft.sections.push({ title: '', paragraphs: [], entries: [], bullets: [] });
          }, `cv-section-${doc.sections.length}`)}
        >
          {t('editor.sheet.addSection')}
        </button>
      </div>
    </div>
  );
}
