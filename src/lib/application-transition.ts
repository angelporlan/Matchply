import { decideApplicationSent } from '@/lib/application-sent';
export const applicationStatuses = ['interested', 'applied', 'interview', 'offer', 'rejected', 'archived'] as const;
export function transitionFields(current: { status: string; nextFollowupDate: Date | null; nextAction: string | null; followupVersion: number }, input: { status?: string; nextFollowupDate?: Date | null; nextAction?: string | null }, now = new Date()) {
  const status = input.status ?? current.status;
  if (!applicationStatuses.includes(status as typeof applicationStatuses[number]) && !/^archived:(interested|applied|interview|offer|rejected)$/.test(status)) throw new Error('INVALID_STATUS');
  let date = input.nextFollowupDate === undefined ? current.nextFollowupDate : input.nextFollowupDate;
  let action = input.nextAction === undefined ? current.nextAction : input.nextAction;
  if (status === 'applied' && current.status !== 'applied' && input.nextFollowupDate === undefined && !date) date = decideApplicationSent('yes', now).nextFollowupDate;
  if (status === 'rejected' || status.startsWith('archived')) { date = null; action = null; }
  if (date && !Number.isFinite(date.getTime())) throw new Error('INVALID_DATE');
  if (action && action.length > 1000) throw new Error('INVALID_ACTION');
  if (!date) action = null;
  const changed = date?.getTime() !== current.nextFollowupDate?.getTime() || action !== current.nextAction;
  return { status, nextFollowupDate: date, nextAction: action, followupVersion: current.followupVersion + (changed ? 1 : 0), updatedAt: now };
}
