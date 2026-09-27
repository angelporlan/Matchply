export const AGENT_SCOPES = [
  'profile:read',
  'profile:write',
  'cv:read',
  'cv:write',
  'applications:read',
  'applications:write',
] as const;

export type AgentScope = (typeof AGENT_SCOPES)[number];

export const API_TOKEN_PREFIX = 'mp_live_';
export const MAX_ACTIVE_API_TOKENS = 10;

export type ApiTokenView = {
  id: string;
  name: string;
  lastChars: string;
  scopes: AgentScope[];
  createdAt: Date | string;
  lastUsedAt: Date | string | null;
  revokedAt: Date | string | null;
  expiresAt: Date | string | null;
};

export function apiTokenHint(lastChars: string) {
  return `${API_TOKEN_PREFIX}…${lastChars}`;
}

export function isAgentScope(value: string): value is AgentScope {
  return (AGENT_SCOPES as readonly string[]).includes(value);
}
