"use server";
import { revalidatePath } from 'next/cache';
import { requireProductContext } from '@/lib/request-context';
import { persistRequirementEvidence, type EvidenceInput } from '@/lib/profile-evidence';
import { log } from '@/lib/logger';
export async function addRequirementEvidence(input: EvidenceInput) {
  try {
    const ctx = await requireProductContext();
    await persistRequirementEvidence(ctx.effectiveUser!.id, input);
    revalidatePath('/dashboard/profile'); revalidatePath('/dashboard/applications'); revalidatePath(`/dashboard/applications/offer/${input.offerId}`);
    return { success: true as const };
  } catch (error) { log({ event: 'profile_evidence_failed', level: 'warn', error }); return { error: 'EVIDENCE_NOT_SAVED' }; }
}
