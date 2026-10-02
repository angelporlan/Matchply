export type AiPromptDebugAction =
  | 'curate_offers'
  | 'optimize_cv'
  | 'outreach'
  | 'import_cv'
  | 'profile_extract'
  | 'start_interview'
  | 'synthesize_profile'
  | 'polish_section';

export interface AiPromptDebugRequest {
  action: AiPromptDebugAction;
  title?: string;
  data: Record<string, any>;
}

export interface AiPromptDebugResponse {
  success: boolean;
  error?: string;
  action: string;
  actionTitle: string;
  provider: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  fullPromptText: string;
}

const DEBUG_PROMPT_FALLBACK = 'Error al obtener el prompt de depuración.';

/** Reads a debug-prompt body. A 401 from this route used to be the plain text "Unauthorized". */
export function parseDebugPromptBody(raw: string):
  | { ok: true; data: AiPromptDebugResponse }
  | { ok: false; error: string } {
  const text = raw.trim();
  if (!text) return { ok: false, error: DEBUG_PROMPT_FALLBACK };

  try {
    const data = JSON.parse(text) as Partial<AiPromptDebugResponse>;
    if (
      data.success === true
      && typeof data.action === 'string'
      && typeof data.systemPrompt === 'string'
      && typeof data.userPrompt === 'string'
      && typeof data.fullPromptText === 'string'
    ) {
      return { ok: true, data: data as AiPromptDebugResponse };
    }
    const message = typeof data.error === 'string' ? data.error.trim() : '';
    return { ok: false, error: message || DEBUG_PROMPT_FALLBACK };
  } catch {
    return { ok: false, error: text };
  }
}

export function isAiPromptsDebugEnabled(): boolean {
  return (
    process.env.AI_PROMPT_DEBUG === 'true' ||
    process.env.AI_PROMPTS_DEBUG === 'true' ||
    process.env.NEXT_PUBLIC_AI_PROMPT_DEBUG === 'true' ||
    process.env.NEXT_PUBLIC_AI_PROMPTS_DEBUG === 'true'
  );
}

export function formatPromptForClipboard(params: {
  actionTitle: string;
  provider: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
}): string {
  return [
    `# ⚡ PROMPT DE IA [${params.actionTitle}]`,
    `**Proveedor:** ${params.provider}`,
    `**Modelo:** ${params.model}`,
    '',
    '---',
    '## SYSTEM PROMPT',
    params.systemPrompt.trim(),
    '',
    '---',
    '## USER PROMPT',
    params.userPrompt.trim(),
    '',
    '---',
  ].join('\n');
}
