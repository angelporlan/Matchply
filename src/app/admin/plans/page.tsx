import { loadPlansAdminState } from './actions';
import { requireAdminContext } from '@/lib/request-context';
import { getServerTranslations } from '@/lib/i18n/server';
import { AdminErrorState } from '@/components/admin/AdminStates';
import PlansConfigForm from '@/components/admin/PlansConfigForm';

export const dynamic = 'force-dynamic';

export default async function AdminPlansPage() {
  await requireAdminContext();
  const { t } = getServerTranslations();
  try {
    return <PlansConfigForm initialState={await loadPlansAdminState()} />;
  } catch {
    return <AdminErrorState title={t('plans.adminTitle')} description={t('plans.loadError')} />;
  }
}
