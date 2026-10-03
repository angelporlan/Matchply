export const PERSON_KINDS = ['recruiter', 'hiring_manager', 'employee', 'executive', 'other'] as const;
export const PERSON_STATUSES = ['pending', 'contacted', 'conversation', 'keep_in_touch', 'closed'] as const;
export const COMPANY_RELATIONS = ['works_at', 'recruits_for', 'unconfirmed'] as const;
export const CONVERSATION_CHANNELS = ['linkedin', 'email', 'other'] as const;
export const NETWORKING_ACTIONS = ['parse_conversation', 'first_contact', 'reply', 'conversation_prep', 'next_step'] as const;
export type NetworkingAction = typeof NETWORKING_ACTIONS[number];
export type MessageAuthor = 'self' | 'contact' | 'unknown';
export type MessageInput = { author: MessageAuthor; content: string; sentAt: string | null };
export type ProposedMessage = MessageInput & { uncertain: boolean; overlap?: boolean };
export type NetworkingAdvice = {
  facts: string[];
  hypotheses: string[];
  recommendations: string[];
  drafts: Array<{ title: string; text: string }>;
  hooks: string[];
  questions: string[];
  nextAction: string | null;
  followupDate: string | null;
};
export type NetworkingPayload = {
  personId: string; action: NetworkingAction; requestId: string;
  threadId?: string; importId?: string; offerId?: string; includeCandidate?: boolean;
};
export type PersonInput = {
  name: string; linkedinUrl?: string | null; email?: string | null; role?: string | null;
  headline?: string | null; location?: string | null; kind?: string; status?: string;
  origin?: string | null; objective?: string | null; topics?: string | null; notes?: string | null;
  nextAction?: string | null; nextFollowupAt?: string | null; language?: string; tone?: string;
  connectionDegree?: string | null;
};
export type LinkedInPersonCapture = {
  name: string; profileUrl: string; headline?: string | null; connectionDegree?: string | null;
  source: 'hiring_team' | 'network';
};
export const CONVERSATION_MAX = 120_000;
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export class PeopleError extends Error {
  constructor(code: string, public readonly status = 400) { super(code); }
}
