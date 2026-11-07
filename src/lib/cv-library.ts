import type { CvListItem, CvTargetSummary } from './job-offer-queries';

export type CvLibraryFilters = { search: string; type: 'all' | 'base' | 'optimized'; company: string; role: string };
const searchable = (text: string) => text.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export function filterCvLibrary(cvs: CvListItem[], targets: Map<string, CvTargetSummary>, filters: CvLibraryFilters) {
  const query = searchable(filters.search.trim());
  return cvs.filter(cv => {
    const target = targets.get(cv.id);
    if (filters.type === 'base' && !cv.isBase) return false;
    if (filters.type === 'optimized' && cv.isBase) return false;
    if (filters.company && target?.company !== filters.company) return false;
    if (filters.role && target?.title !== filters.role) return false;
    return !query || [cv.title, target?.title, target?.company].some(value => value && searchable(value).includes(query));
  });
}
