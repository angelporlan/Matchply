import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { jobOffers, users, profileEvidence } from '@/db/schema';
import { commandHash } from '@/lib/application-continuity';
import { currentMatchEvidence } from '@/lib/match-display';
export type EvidenceInput = { offerId: string; requirementId: string; inputHash: string; example: string; commandId: string };
export async function persistRequirementEvidence(userId: string, input: EvidenceInput) {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(input.offerId) || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(input.commandId) || typeof input.example !== 'string' || input.example.trim().length < 20 || input.example.length > 4000) throw new Error('INVALID_EVIDENCE');
  return db.transaction(async tx => {
      // Lock the user before the offer: matches the profile invalidation trigger order.
      const [user] = await tx.select({ careerProfile: users.careerProfile }).from(users).where(eq(users.id, userId)).for('update');
      if (!user) throw new Error('NOT_FOUND');
      const hash = commandHash(input);
      const [replay] = await tx.select({ inputHash: profileEvidence.inputHash }).from(profileEvidence).where(and(eq(profileEvidence.userId, userId), eq(profileEvidence.commandId, input.commandId)));
      if (replay) { if (hash !== replay.inputHash) throw new Error('COMMAND_CONFLICT'); return; }
      const [offer] = await tx.select({ matchInputHash: jobOffers.matchInputHash, matchEvidence: jobOffers.matchEvidence, scoreOverall: jobOffers.scoreOverall }).from(jobOffers).where(and(eq(jobOffers.id, input.offerId), eq(jobOffers.userId, userId))).for('update');
      const evidence = offer && currentMatchEvidence(offer);
      const requirement = evidence?.requirements.find(item => item.id === input.requirementId);
      if (!requirement || evidence?.inputHash !== input.inputHash) throw new Error('STALE_REQUIREMENT');
      const profile = (user.careerProfile || {}) as Record<string, unknown>;
      const example = input.example.trim();
      const addition = `${requirement.name}\n${example}`;
      const master = typeof profile.masterDocument === 'string' ? profile.masterDocument : '';
      await tx.insert(profileEvidence).values({ userId, commandId: input.commandId, inputHash: hash, requirement: requirement.name, example });
      await tx.update(users).set({ careerProfile: { ...profile, masterDocument: `${master}${master ? '\n\n' : ''}${addition}`, updatedAt: new Date().toISOString() } }).where(eq(users.id, userId));
    });
}
