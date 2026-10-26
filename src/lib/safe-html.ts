/** Escape untrusted content before inserting it into an HTML text or attribute context. */
export function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** The input has already been HTML-escaped. Only explicit HTTP(S) links are rendered. */
export function renderSafeMarkdownLink(label: string, href: string): string {
  if (!/^https?:\/\//i.test(href) || /[\s"'<>`]/.test(href)) return label;
  try {
    const url = new URL(href.replace(/&amp;/g, '&'));
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return label;
  } catch { return label; }
  return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="underline decoration-subtle hover:text-ai">${label}</a>`;
}
