import { matchplyFetch, type MatchplyClientOptions, type ToolResult } from './client.js';

type JsonSchema = Record<string, unknown>;
type Args = Record<string, unknown>;
type ToolSpec = {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  readOnly?: boolean;
  destructive?: boolean;
  call: (args: Args, options: MatchplyClientOptions) => Promise<ToolResult>;
};

const objectSchema: JsonSchema = { type: 'object', additionalProperties: true };
const idSchema: JsonSchema = {
  type: 'object',
  properties: { id: { type: 'string' } },
  required: ['id'],
  additionalProperties: false,
};

function asArgs(value: unknown): Args {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Args;
}

function textArg(args: Args, key: string) {
  const value = args[key];
  return typeof value === 'string' ? value : '';
}

const tools: ToolSpec[] = [
  { name: 'matchply_get_profile', description: 'Lee el perfil profesional de la cuenta.', inputSchema: { type: 'object', additionalProperties: false }, readOnly: true, call: (_args, options) => matchplyFetch('GET', '/api/v1/agent/profile', {}, options) },
  { name: 'matchply_update_profile', description: 'Actualiza el nombre o el perfil profesional.', inputSchema: objectSchema, call: (args, options) => matchplyFetch('PATCH', '/api/v1/agent/profile', { body: args }, options) },
  { name: 'matchply_list_cvs', description: 'Lista los currículums de la cuenta.', inputSchema: { type: 'object', additionalProperties: false }, readOnly: true, call: (_args, options) => matchplyFetch('GET', '/api/v1/agent/cvs', {}, options) },
  { name: 'matchply_get_cv', description: 'Lee un currículum por id.', inputSchema: idSchema, readOnly: true, call: (args, options) => matchplyFetch('GET', `/api/v1/agent/cvs/${encodeURIComponent(textArg(args, 'id'))}`, {}, options) },
  { name: 'matchply_create_cv', description: 'Crea un currículum.', inputSchema: objectSchema, call: (args, options) => matchplyFetch('POST', '/api/v1/agent/cvs', { body: args }, options) },
  { name: 'matchply_update_cv', description: 'Actualiza un currículum.', inputSchema: objectSchema, call: (args, options) => matchplyFetch('PUT', `/api/v1/agent/cvs/${encodeURIComponent(textArg(args, 'id'))}`, { body: args }, options) },
  { name: 'matchply_list_applications', description: 'Lista candidaturas. Acepta status, limit y cursor.', inputSchema: objectSchema, readOnly: true, call: (args, options) => matchplyFetch('GET', '/api/v1/agent/applications', { query: { status: textArg(args, 'status'), limit: typeof args.limit === 'number' ? args.limit : undefined, cursor: textArg(args, 'cursor') } }, options) },
  { name: 'matchply_get_application', description: 'Lee una candidatura por id.', inputSchema: idSchema, readOnly: true, call: (args, options) => matchplyFetch('GET', `/api/v1/agent/applications/${encodeURIComponent(textArg(args, 'id'))}`, {}, options) },
  { name: 'matchply_create_application', description: 'Registra una candidatura en el tablero. Puede incluir desglose, explicación y contacto. Si la candidatura ya existe, la respuesta trae created: false y hay que actualizarla.', inputSchema: objectSchema, call: (args, options) => matchplyFetch('POST', '/api/v1/agent/applications', { body: args }, options) },
  { name: 'matchply_update_application', description: 'Actualiza una candidatura. Acepta scoreOverall, scoreBreakdown, matchEvidence, matchDetails, outreachMessage, coverLetter e interviewQuestions.', inputSchema: objectSchema, call: (args, options) => matchplyFetch('PATCH', `/api/v1/agent/applications/${encodeURIComponent(textArg(args, 'id'))}`, { body: args }, options) },
  { name: 'matchply_delete_application', description: 'Borra una candidatura de la cuenta.', inputSchema: idSchema, destructive: true, call: (args, options) => matchplyFetch('DELETE', `/api/v1/agent/applications/${encodeURIComponent(textArg(args, 'id'))}`, {}, options) },
  { name: 'matchply_set_application_status', description: 'Cambia el estado de hasta 200 candidaturas.', inputSchema: objectSchema, call: (args, options) => matchplyFetch('POST', '/api/v1/agent/applications/status', { body: args }, options) },
  { name: 'matchply_set_favorites', description: 'Marca o quita favoritos de candidaturas, empresas o personas.', inputSchema: objectSchema, call: (args, options) => matchplyFetch('POST', '/api/v1/agent/favorites', { body: args }, options) },
  { name: 'matchply_evaluate_applications', description: 'Registra evaluaciones de encaje en lote. Cada item puede traer scoreBreakdown, matchEvidence y matchDetails. Si no hay salario o modalidad en la oferta, hay que estimar salary_fit y work_mode y decirlo en la explicación de esa dimensión. scoreOverall tiene que coincidir con el ponderado.', inputSchema: objectSchema, call: (args, options) => matchplyFetch('POST', '/api/v1/agent/applications/evaluations', { body: args }, options) },
  { name: 'matchply_trigger_research', description: 'Encola la investigación profunda de una candidatura. Si ya hay una ejecución vigente, la devuelve. retry true reintenta un fallo.', inputSchema: { type: 'object', properties: { id: { type: 'string' }, retry: { type: 'boolean' } }, required: ['id'], additionalProperties: false }, call: (args, options) => matchplyFetch('POST', `/api/v1/agent/applications/${encodeURIComponent(textArg(args, 'id'))}/research`, { body: { retry: args.retry === true } }, options) },
  { name: 'matchply_get_research', description: 'Lee el estado y el informe de la investigación profunda de una candidatura.', inputSchema: idSchema, readOnly: true, call: (args, options) => matchplyFetch('GET', `/api/v1/agent/applications/${encodeURIComponent(textArg(args, 'id'))}/research`, {}, options) },
  { name: 'matchply_list_views', description: 'Lista las vistas guardadas y de sistema de una entidad.', inputSchema: objectSchema, readOnly: true, call: (args, options) => matchplyFetch('GET', '/api/v1/agent/views', { query: { entity: textArg(args, 'entity') } }, options) },
  { name: 'matchply_get_view', description: 'Lee una vista guardada por id.', inputSchema: idSchema, readOnly: true, call: (args, options) => matchplyFetch('GET', `/api/v1/agent/views/${encodeURIComponent(textArg(args, 'id'))}`, {}, options) },
  { name: 'matchply_query_view', description: 'Lista las filas de una vista guardada.', inputSchema: objectSchema, readOnly: true, call: (args, options) => matchplyFetch('GET', `/api/v1/agent/views/${encodeURIComponent(textArg(args, 'id'))}/rows`, { query: { page: typeof args.page === 'number' ? args.page : undefined } }, options) },
  { name: 'matchply_query_system_view', description: 'Lista las filas de una vista de sistema.', inputSchema: objectSchema, readOnly: true, call: (args, options) => matchplyFetch('GET', '/api/v1/agent/views/system/rows', { query: { entity: textArg(args, 'entity'), id: textArg(args, 'id'), page: typeof args.page === 'number' ? args.page : undefined } }, options) },
  { name: 'matchply_preview_view', description: 'Previsualiza las filas de una config sin guardarla.', inputSchema: objectSchema, readOnly: true, call: (args, options) => matchplyFetch('POST', '/api/v1/agent/views/query', { body: args }, options) },
  { name: 'matchply_create_view', description: 'Crea una vista CRM. Sirve para guardar Matching Hoy.', inputSchema: objectSchema, call: (args, options) => matchplyFetch('POST', '/api/v1/agent/views', { body: args }, options) },
  { name: 'matchply_update_view', description: 'Actualiza el nombre o la config de una vista guardada.', inputSchema: objectSchema, call: (args, options) => matchplyFetch('PATCH', `/api/v1/agent/views/${encodeURIComponent(textArg(args, 'id'))}`, { body: args }, options) },
  { name: 'matchply_delete_view', description: 'Borra una vista guardada.', inputSchema: idSchema, destructive: true, call: (args, options) => matchplyFetch('DELETE', `/api/v1/agent/views/${encodeURIComponent(textArg(args, 'id'))}`, {}, options) },
  { name: 'matchply_set_default_view', description: 'Marca o quita la vista por defecto.', inputSchema: objectSchema, call: (args, options) => matchplyFetch('POST', `/api/v1/agent/views/${encodeURIComponent(textArg(args, 'id'))}/default`, { body: args }, options) },
  { name: 'matchply_list_companies', description: 'Lista las empresas del CRM.', inputSchema: { type: 'object', additionalProperties: false }, readOnly: true, call: (_args, options) => matchplyFetch('GET', '/api/v1/agent/companies', {}, options) },
  { name: 'matchply_get_company', description: 'Lee una empresa del CRM.', inputSchema: idSchema, readOnly: true, call: (args, options) => matchplyFetch('GET', `/api/v1/agent/companies/${encodeURIComponent(textArg(args, 'id'))}`, {}, options) },
  { name: 'matchply_list_company_notes', description: 'Lista las notas de una empresa.', inputSchema: idSchema, readOnly: true, call: (args, options) => matchplyFetch('GET', `/api/v1/agent/companies/${encodeURIComponent(textArg(args, 'id'))}/notes`, {}, options) },
  { name: 'matchply_create_company', description: 'Crea una empresa en el CRM.', inputSchema: objectSchema, call: (args, options) => matchplyFetch('POST', '/api/v1/agent/companies', { body: args }, options) },
  { name: 'matchply_update_company', description: 'Actualiza una empresa del CRM.', inputSchema: objectSchema, call: (args, options) => matchplyFetch('PATCH', `/api/v1/agent/companies/${encodeURIComponent(textArg(args, 'id'))}`, { body: args }, options) },
  { name: 'matchply_delete_company', description: 'Quita una empresa del CRM.', inputSchema: idSchema, destructive: true, call: (args, options) => matchplyFetch('DELETE', `/api/v1/agent/companies/${encodeURIComponent(textArg(args, 'id'))}`, {}, options) },
  { name: 'matchply_create_company_note', description: 'Añade una nota a una empresa.', inputSchema: objectSchema, call: (args, options) => matchplyFetch('POST', `/api/v1/agent/companies/${encodeURIComponent(textArg(args, 'id'))}/notes`, { body: args }, options) },
  { name: 'matchply_delete_company_note', description: 'Borra una nota de empresa.', inputSchema: { type: 'object', properties: { noteId: { type: 'string' } }, required: ['noteId'] }, destructive: true, call: (args, options) => matchplyFetch('DELETE', `/api/v1/agent/companies/notes/${encodeURIComponent(textArg(args, 'noteId'))}`, {}, options) },
  { name: 'matchply_list_people', description: 'Lista personas. Acepta query, status y page.', inputSchema: objectSchema, readOnly: true, call: (args, options) => matchplyFetch('GET', '/api/v1/agent/people', { query: { query: textArg(args, 'query'), status: textArg(args, 'status'), page: typeof args.page === 'number' ? args.page : undefined } }, options) },
  { name: 'matchply_get_person', description: 'Lee una persona por id.', inputSchema: idSchema, readOnly: true, call: (args, options) => matchplyFetch('GET', `/api/v1/agent/people/${encodeURIComponent(textArg(args, 'id'))}`, {}, options) },
  { name: 'matchply_save_person', description: 'Crea una persona o la actualiza si llega id.', inputSchema: objectSchema, call: (args, options) => {
    const id = textArg(args, 'id');
    if (!id) return matchplyFetch('POST', '/api/v1/agent/people', { body: args }, options);
    const body = { ...args };
    delete body.id;
    return matchplyFetch('PATCH', `/api/v1/agent/people/${encodeURIComponent(id)}`, { body }, options);
  } },
  { name: 'matchply_delete_person', description: 'Borra una persona.', inputSchema: idSchema, destructive: true, call: (args, options) => matchplyFetch('DELETE', `/api/v1/agent/people/${encodeURIComponent(textArg(args, 'id'))}`, {}, options) },
  { name: 'matchply_set_people_status', description: 'Cambia el estado de hasta 200 personas.', inputSchema: objectSchema, call: (args, options) => matchplyFetch('POST', '/api/v1/agent/people/status', { body: args }, options) },
  { name: 'matchply_link_person_company', description: 'Vincula una persona con una empresa.', inputSchema: objectSchema, call: (args, options) => matchplyFetch('POST', `/api/v1/agent/people/${encodeURIComponent(textArg(args, 'id'))}/companies`, { body: args }, options) },
  { name: 'matchply_link_person_offer', description: 'Vincula una persona con una candidatura propia.', inputSchema: objectSchema, call: (args, options) => matchplyFetch('POST', `/api/v1/agent/people/${encodeURIComponent(textArg(args, 'id'))}/offers`, { body: args }, options) },
];

export function matchplyToolDefinitions() {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
    annotations: {
      ...(tool.readOnly ? { readOnlyHint: true } : {}),
      ...(tool.destructive ? { destructiveHint: true } : {}),
    },
  }));
}

export async function runMatchplyTool(name: string, args: unknown, options: MatchplyClientOptions = {}): Promise<ToolResult> {
  const tool = tools.find((item) => item.name === name);
  if (!tool) return { isError: true, content: [{ type: 'text', text: JSON.stringify({ code: 'unknown_tool', message: 'La herramienta no existe.' }) }] };
  try {
    return await tool.call(asArgs(args), options);
  } catch (error) {
    const token = options.token ?? process.env.MATCHPLY_API_TOKEN ?? '';
    const message = error instanceof Error ? error.message : 'No se pudo completar la operación.';
    return { isError: true, content: [{ type: 'text', text: JSON.stringify({ code: 'internal', message: token ? message.split(token).join('[redacted]') : message }) }] };
  }
}
