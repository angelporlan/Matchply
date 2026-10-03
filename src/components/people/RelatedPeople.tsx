import { listPeople } from '@/lib/people/service';
import RelatedPeopleClient from './RelatedPeopleClient';
export default async function RelatedPeople({ userId, companyId, offerId }: { userId: string; companyId?: string; offerId?: string }) {
  const data = await listPeople(userId, { companyId, offerId });
  return <RelatedPeopleClient people={data.items.slice(0, 5).map(p => ({ id: p.id, name: p.name, avatarHash: p.avatarHash, role: p.role || p.headline }))} total={data.total} companyId={companyId} offerId={offerId} />;
}
