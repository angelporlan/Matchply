import { cookies } from 'next/headers';
import { ApplicationsPageSkeleton } from '@/components/skeletons';

export default function ApplicationsLoading() {
  const layout = cookies().get('applications_layout')?.value === 'board' ? 'board' : 'table';
  return <ApplicationsPageSkeleton layout={layout} />;
}
