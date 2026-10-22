export type OutreachResult = { outreachMessage: string; coverLetter: string; interviewQuestions: Array<{ question: string; tip: string }> };
export class InvalidOutreachResponse extends Error { constructor() { super('OUTREACH_INVALID_RESPONSE'); } }
export function parseOutreachResult(raw: string): OutreachResult {
  let value: unknown;
  try { value = JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')); } catch { throw new InvalidOutreachResponse(); }
  const row = value as Partial<OutreachResult> | null;
  const validText = (text: unknown, min: number, max: number): text is string => typeof text === 'string' && text.trim().length >= min && text.length <= max && !/(?:\.{3}|…)\s*$|\[(?:insert|completar|nombre|your name|company)\]|\b(?:TODO|PLACEHOLDER)\b/i.test(text);
  if (!row || !validText(row.outreachMessage, 30, 4000) || !validText(row.coverLetter, 60, 8000) || !Array.isArray(row.interviewQuestions) || row.interviewQuestions.length < 3 || row.interviewQuestions.length > 5 || row.interviewQuestions.some(item => !item || !validText(item.question, 8, 1000) || !validText(item.tip, 10, 2000))) throw new InvalidOutreachResponse();
  return { outreachMessage: row.outreachMessage.trim(), coverLetter: row.coverLetter.trim(), interviewQuestions: row.interviewQuestions.map(item => ({ question: item.question.trim(), tip: item.tip.trim() })) };
}
