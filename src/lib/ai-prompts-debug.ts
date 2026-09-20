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

export function isAiPromptsDebugEnabled(): boolean {
  return (
    process.env.AI_PROMPTS_DEBUG === 'true' ||
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
