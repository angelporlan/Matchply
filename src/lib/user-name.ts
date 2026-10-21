const MIN_NAME_LENGTH = 2;
const MAX_NAME_LENGTH = 60;

/**
 * Normaliza el nombre visible del usuario eliminando caracteres de control,
 * colapsando espacios y validando una longitud razonable.
 */
export function sanitizeDisplayName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;

  const name = raw
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (name.length < MIN_NAME_LENGTH || name.length > MAX_NAME_LENGTH) {
    return null;
  }

  return name;
}

const PDF_FILENAME_UNSAFE = /[/\\?%*:|"<>]/g;

/** Nombre de descarga del PDF: «CV» seguido del nombre visible, o CV.pdf si no hay uno válido. */
export function pdfDownloadFilename(raw: unknown): string {
  const visible = sanitizeDisplayName(raw);
  const safe = (visible ?? '').replace(PDF_FILENAME_UNSAFE, '').replace(/\s+/g, ' ').trim();
  return safe ? `CV ${safe}.pdf` : 'CV.pdf';
}
