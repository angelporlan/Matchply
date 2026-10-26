/** Bounds untrusted input before multipart or JSON parsing and validates PDF bytes. */
export const MAX_PDF_BYTES = 10 * 1024 * 1024;
export const MAX_INPUT_TEXT = 120_000;
const MAX_FORM_BYTES = MAX_PDF_BYTES + 256 * 1024;

export class InputSafetyError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function readBoundedBody(request: Request, maxBytes: number): Promise<Uint8Array> {
  const length = Number(request.headers.get('content-length'));
  if (Number.isFinite(length) && length > maxBytes) throw new InputSafetyError(413, 'El contenido es demasiado grande.');
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const parts: Uint8Array[] = []; let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) { void reader.cancel().catch(() => {}); throw new InputSafetyError(413, 'El contenido es demasiado grande.'); }
      parts.push(value);
    }
  } finally { reader.releaseLock(); }
  const result = new Uint8Array(total); let offset = 0;
  for (const part of parts) { result.set(part, offset); offset += part.length; }
  return result;
}

export async function readSafeForm(request: Request): Promise<FormData> {
  const contentType = request.headers.get('content-type') || '';
  if (!/^multipart\/form-data\s*;/i.test(contentType)) throw new InputSafetyError(400, 'Selecciona un PDF o pega el texto.');
  const bytes = await readBoundedBody(request, MAX_FORM_BYTES);
  try { return await new Response(bytes as BodyInit, { headers: { 'content-type': contentType } }).formData(); }
  catch { throw new InputSafetyError(400, 'No se pudo leer el formulario.'); }
}

export async function readSafeJson(request: Request): Promise<any> {
  const bytes = await readBoundedBody(request, 512 * 1024);
  try {
    const value: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid JSON object');
    return value as Record<string, any>;
  } catch { throw new InputSafetyError(400, 'No se pudo leer la petición.'); }
}

export async function readPdfFile(value: FormDataEntryValue): Promise<Uint8Array> {
  if (typeof value === 'string' || typeof value.arrayBuffer !== 'function') throw new InputSafetyError(400, 'Selecciona un archivo PDF válido.');
  if (!value.size || value.size > MAX_PDF_BYTES) throw new InputSafetyError(413, 'El PDF debe ocupar como máximo 10 MB.');
  if (value.type && !['application/pdf', 'application/octet-stream'].includes(value.type.toLowerCase())) throw new InputSafetyError(400, 'Selecciona un archivo PDF válido.');
  const bytes = new Uint8Array(await value.arrayBuffer());
  if (new TextDecoder().decode(bytes.subarray(0, 5)) !== '%PDF-') throw new InputSafetyError(400, 'Selecciona un archivo PDF válido.');
  return bytes;
}

/** Keep normal whitespace and Unicode while removing control characters rejected by PostgreSQL. */
export function cleanInputText(value: unknown): string {
  if (typeof value !== 'string') throw new InputSafetyError(400, 'El texto no es válido.');
  if (value.length > MAX_INPUT_TEXT) throw new InputSafetyError(413, 'El texto es demasiado largo.');
  return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim();
}

export function inputSafetyResponse(error: unknown): Response | null {
  return error instanceof InputSafetyError ? Response.json({ error: error.message }, { status: error.status }) : null;
}
