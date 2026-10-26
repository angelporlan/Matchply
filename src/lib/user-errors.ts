export type ErrorAction = 'retry' | 'paste' | 'sign-in' | 'wait' | 'reload' | 'review' | 'contact';
type Language = 'es' | 'en';
type Copy = { codes: string[]; action: ErrorAction; es: string; en: string };

/** Only these messages may reach the UI. Never interpolate an exception or provider body. */
const groups: Copy[] = [
  { codes: ['UNEXPECTED_ERROR'], action: 'retry', es: 'No se pudo completar esta acción. Vuelve a intentarlo. Si el problema continúa, contacta con soporte.', en: 'We could not complete this action. Try again. If the problem continues, contact support.' },
  { codes: ['AUTH_REQUIRED', 'ACCOUNT_REQUIRED', 'GUEST_SESSION_CHANGED'], action: 'sign-in', es: 'Tu sesión ha terminado o esta acción requiere una cuenta. Inicia sesión o regístrate para continuar.', en: 'Your session has ended or this action requires an account. Sign in or register to continue.' },
  { codes: ['GUEST_DOWNLOAD_LIMIT'], action: 'sign-in', es: 'Ya has usado la descarga de esta sesión invitada. Regístrate o inicia sesión para continuar con tu CV.', en: 'You have used this guest session’s download. Register or sign in to continue with your resume.' },
  { codes: ['FORBIDDEN', 'SUPPORT_ACTION_BLOCKED', 'ADMIN_UNAUTHORIZED'], action: 'review', es: 'No tienes permiso para esta acción. Revisa la cuenta y el documento seleccionados.', en: 'You do not have permission for this action. Check the selected account and document.' },
  { codes: ['ACCOUNT_SUSPENDED'], action: 'contact', es: 'Esta cuenta está suspendida. Contacta con soporte para revisarla.', en: 'This account is suspended. Contact support to review it.' },
  { codes: ['RATE_LIMITED', 'TOO_MANY_REQUESTS', 'OFFER_RATE_LIMITED', 'PHOTO_RATE_LIMIT', 'DISCOVERY_RATE_LIMITED'], action: 'wait', es: 'Has realizado varias acciones seguidas. Espera unos minutos y vuelve a intentarlo.', en: 'You have performed several actions in a row. Wait a few minutes and try again.' },
  { codes: ['QUOTA_EXCEEDED', 'QUOTA_EXHAUSTED'], action: 'review', es: 'Has alcanzado el límite de acciones de IA. Revisa tu uso y la fecha de renovación antes de volver a intentarlo.', en: 'You have reached your AI action limit. Check your usage and renewal date before trying again.' },
  { codes: ['PLAN_REQUIRED', 'PRO_REQUIRED', 'API_KEY_LIMIT', 'TOO_MANY_KEYS', 'SUBSCRIPTION_REQUIRED'], action: 'review', es: 'Tu plan no permite esta acción. Revisa las opciones y límites de tu cuenta.', en: 'Your plan does not allow this action. Review your account options and limits.' },
  { codes: ['CV_LIMIT'], action: 'review', es: 'Has alcanzado el límite de CVs. Elige un CV adaptado para reemplazar o revisa tu plan.', en: 'You have reached your resume limit. Choose a tailored resume to replace or review your plan.' },
  { codes: ['CV_READ_ONLY'], action: 'review', es: 'Este CV está en modo lectura. Selecciona un CV activo para editarlo.', en: 'This resume is read-only. Select an active resume to edit it.' },
  { codes: ['BASE_CV_PROTECTED'], action: 'review', es: 'Tu CV base se conserva. Elige un CV adaptado como destino para reemplazarlo.', en: 'Your base resume is preserved. Choose a tailored resume as the replacement destination.' },
  { codes: ['OPERATION_IN_PROGRESS', 'VARIANT_NOT_READY'], action: 'wait', es: 'Esta acción todavía está en curso. Espera a que termine antes de volver a intentarlo.', en: 'This action is still in progress. Wait for it to finish before trying again.' },
  { codes: ['OPERATION_RELEASED'], action: 'retry', es: 'El intento anterior no se completó. Tu contenido se conserva; vuelve a intentarlo.', en: 'The previous attempt did not finish. Your content is preserved; try again.' },
  { codes: ['OPERATION_CONFLICT', 'OPTIMIZE_REQUEST_CONFLICT', 'MATCH_REQUEST_CONFLICT', 'OFFER_REQUEST_CONFLICT', 'COMMAND_CONFLICT'], action: 'review', es: 'Los datos de esta solicitud han cambiado. Revisa el formulario y vuelve a enviarlo.', en: 'The details of this request have changed. Review the form and submit it again.' },
  { codes: ['CV_OVERWRITE_CONFIRM'], action: 'review', es: 'El CV de destino contiene información. Elige el documento y confirma su reemplazo para continuar.', en: 'The destination resume contains information. Choose the document and confirm its replacement to continue.' },
  { codes: ['CV_OPERATION_LOST', 'VARIANT_REVISION_CONFLICT', 'STALE_OPTIMIZATION', 'AI_CONFIG_CONFLICT', 'ACTOR_EPOCH_MISMATCH', 'IMPERSONATION_ENDED', 'FOLLOWUP_CONFLICT'], action: 'reload', es: 'La información cambió en otra sesión. Conserva tu borrador y recarga la página antes de continuar.', en: 'The information changed in another session. Keep your draft and reload the page before continuing.' },
  { codes: ['NOT_FOUND', 'CV_NOT_FOUND', 'OFFER_NOT_FOUND', 'RESULT_NOT_FOUND', 'OPTIMIZATION_NOT_FOUND', 'OPERATION_NOT_FOUND', 'EXPORT_NOT_AVAILABLE'], action: 'reload', es: 'El documento o la oferta ya no están disponibles. Vuelve al listado y selecciona uno disponible.', en: 'The document or job offer is no longer available. Return to the list and select an available one.' },
  { codes: ['INVALID_TITLE', 'TITLE_TOO_LONG'], action: 'review', es: 'Escribe un título para el CV de hasta 120 caracteres y vuelve a guardarlo.', en: 'Enter a resume title up to 120 characters and save it again.' },
  { codes: ['INVALID_NAME'], action: 'review', es: 'Revisa el nombre que deseas mostrar y vuelve a guardarlo.', en: 'Review the name you want to display and save it again.' },
  { codes: ['INVALID_INPUT', 'INVALID_CV_INPUT', 'INVALID_OPERATION', 'INVALID_REQUEST_ID', 'INVALID_OPTIMIZE_INPUT', 'INVALID_CV_TYPE', 'INVALID_CV_PATCH', 'INVALID_CV_SELECTION', 'INVALID_RETRY_MODES', 'UNKNOWN_OPTIMIZE_MODE', 'VARIANT_ALREADY_REQUESTED', 'INVALID_COMMAND', 'INVALID_ID', 'DATE_REQUIRED', 'FOLLOWUP_VERSION_REQUIRED', 'INVALID_EXPORT_ACTION', 'ACTION_CLOSED', 'NO_PENDING_ACTION', 'EMPTY_MATCH_BATCH', 'MATCH_BATCH_TOO_LARGE'], action: 'review', es: 'Revisa los datos y las opciones del formulario antes de volver a enviarlo.', en: 'Review the form details and options before submitting it again.' },
  { codes: ['EMPTY_SOURCE_CV', 'CV_IMPORT_FAILED'], action: 'paste', es: 'Añade el texto de tu currículum o un PDF legible y vuelve a intentarlo.', en: 'Add your resume text or a readable PDF and try again.' },
  { codes: ['PDF_PARSE_FAILED', 'PDF_INVALID'], action: 'paste', es: 'No pudimos leer este PDF. Prueba con otro archivo o pega el texto de tu currículum.', en: 'We could not read this PDF. Try another file or paste your resume text.' },
  { codes: ['OFFER_PORTAL_BLOCKED', 'OFFER_IMPORT_FAILED'], action: 'paste', es: 'No hemos podido leer este enlace. Pega aquí la descripción de la oferta.', en: 'We could not read this link. Paste the job description here.' },
  { codes: ['OFFER_URL_INVALID'], action: 'review', es: 'Introduce un enlace público válido a una oferta o pega su descripción.', en: 'Enter a valid public job offer link or paste its description.' },
  { codes: ['AI_UNAVAILABLE', 'OUTREACH_FAILED', 'OUTREACH_INVALID_RESPONSE', 'DISCOVERY_UNAVAILABLE', 'NETWORKING_UNAVAILABLE'], action: 'retry', es: 'No se pudo completar la acción con IA. Tu contenido se conserva; vuelve a intentarlo.', en: 'The AI action could not finish. Your content is preserved; try again.' },
  { codes: ['NETWORK_ERROR'], action: 'retry', es: 'Se ha interrumpido la conexión. Tu contenido se conserva. Comprueba tu conexión y pulsa Reintentar.', en: 'The connection was interrupted. Your content is preserved. Check your connection and retry.' },
  { codes: ['OPTIMIZATION_FAILED'], action: 'retry', es: 'No se pudo completar la optimización. Tu CV y la oferta se conservan. Puedes reintentar.', en: 'The optimization could not finish. Your resume and job offer are preserved. You can retry.' },
  { codes: ['OPTIMIZATION_CONNECTION_LOST', 'OPTIMIZATION_TEMPORARILY_UNAVAILABLE'], action: 'retry', es: 'Se ha interrumpido la conexión. Tu CV y la oferta se conservan. Pulsa Reintentar para recuperar la optimización.', en: 'The connection was interrupted. Your resume and job offer are preserved. Retry to recover the optimization.' },
  { codes: ['SAVE_FAILED'], action: 'retry', es: 'No se pudo guardar. Conserva tu borrador y vuelve a intentarlo.', en: 'We could not save. Keep your draft and try again.' },
  { codes: ['PDF_DOWNLOAD_FAILED'], action: 'retry', es: 'No se pudo descargar el PDF. Tu CV se conserva; vuelve a pulsar Descargar PDF.', en: 'We could not download the PDF. Your resume is preserved; select Download PDF again.' },
  { codes: ['PHOTO_SIZE', 'PHOTO_FORMAT', 'PHOTO_INVALID', 'PHOTO_DIMENSIONS'], action: 'review', es: 'Elige una imagen JPG, PNG o WebP de hasta 10 MB y vuelve a intentarlo.', en: 'Choose a JPG, PNG or WebP image up to 10 MB and try again.' },
  { codes: ['PHOTO_MISSING'], action: 'review', es: 'Añade una foto a este CV antes de activar su visualización.', en: 'Add a photo to this resume before enabling it.' },
  { codes: ['PHOTO_SAVE_FAILED'], action: 'retry', es: 'No se pudo guardar la foto. Vuelve a intentarlo.', en: 'We could not save the photo. Try again.' },
];

const aliases: Record<string, string> = { Unauthorized: 'AUTH_REQUIRED', UNAUTHORIZED: 'AUTH_REQUIRED', Forbidden: 'FORBIDDEN', 'Forbidden or CV not found': 'CV_NOT_FOUND', 'Authentication required': 'AUTH_REQUIRED', 'User not found': 'NOT_FOUND', 'Job offer not found': 'OFFER_NOT_FOUND', 'Resume not found': 'CV_NOT_FOUND' };
const catalog = new Map(groups.flatMap(group => group.codes.map(code => [code, group] as const)));
const knownText = new Map(groups.flatMap(group => [group.es, group.en].map(message => [message, group.codes[0]] as const)));

export function publicErrorCode(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const code = aliases[value] || knownText.get(value) || value;
  return catalog.has(code) ? code : null;
}

export function userError(value: unknown, language: Language = 'es', fallback = 'UNEXPECTED_ERROR') {
  const candidate = value && typeof value === 'object' ? value as { code?: unknown; error?: unknown; message?: unknown; name?: unknown } : null;
  const code = publicErrorCode(candidate?.code) || publicErrorCode(candidate?.error) || publicErrorCode(candidate?.message) || publicErrorCode(value)
    || (candidate?.name === 'AbortError' || candidate?.name === 'TimeoutError' || (value instanceof TypeError && /fetch|network/i.test(value.message)) ? 'NETWORK_ERROR' : publicErrorCode(fallback)) || 'UNEXPECTED_ERROR';
  const copy = catalog.get(code)!;
  return { code, error: copy[language], action: copy.action };
}

export const userErrorMessage = (value: unknown, language: Language = 'es', fallback?: string) => userError(value, language, fallback).error;

/** Product limits are useful to the UI; SQL, causes, stack traces and configuration are not. */
export function publicUsageDetails(value: Record<string, unknown>, nested = false): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of ['total', 'limit', 'required', 'used', 'reserved', 'remaining', 'count', 'max', 'maxBytes']) {
    const item = value[key];
    if (item === null || (typeof item === 'number' && Number.isFinite(item) && item >= 0)) result[key] = item;
  }
  if (typeof value.bucket === 'string' && ['general', 'matching', 'discovery'].includes(value.bucket)) result.bucket = value.bucket;
  if (typeof value.category === 'string' && ['base', 'adapted'].includes(value.category)) result.category = value.category;
  for (const key of ['cvId', 'operationId']) if (typeof value[key] === 'string' && /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(value[key] as string)) result[key] = value[key];
  for (const key of ['resetsAt', 'resetAt']) if (value[key] === null || (typeof value[key] === 'string' && /^\d{4}-\d{2}-\d{2}T[\d:.Z+-]+$/.test(value[key] as string))) result[key] = value[key];
  if (typeof value.unlimited === 'boolean') result.unlimited = value.unlimited;
  if (!nested && value.usage && typeof value.usage === 'object' && !Array.isArray(value.usage)) result.usage = publicUsageDetails(value.usage as Record<string, unknown>, true);
  return result;
}
