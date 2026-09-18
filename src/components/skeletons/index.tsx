import { Bone, ScreenBusy, times } from '@/components/ui/Skeleton';
import { cn } from '@/lib/utils';

export { Bone, ScreenBusy, times };

export function PageGlow() {
  return (
    <>
      <div className="absolute top-[-10%] right-[-10%] w-[45%] h-[45%] rounded-full bg-ai/3 dark:bg-ai/5 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-ai/3 dark:bg-ai/5 blur-[120px] pointer-events-none" />
    </>
  );
}

/** Mini Harvard A4: name, contact, rule, sections and body lines. */
export function A4DocumentSkeleton({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <div
      className={cn(
        'bg-white flex flex-col overflow-hidden',
        compact ? 'gap-1 p-2.5' : 'gap-2 px-[9%] py-[8%]',
        className,
      )}
    >
      <Bone className={cn('mx-auto bg-slate-200', compact ? 'h-1.5 w-2/5' : 'h-3.5 w-1/2')} />
      <Bone className={cn('mx-auto bg-slate-100', compact ? 'h-1 w-3/5' : 'h-2 w-3/5')} />
      <Bone className={cn('w-full bg-slate-200', compact ? 'h-px mt-1' : 'h-px mt-3')} />
      <Bone className={cn('bg-slate-300', compact ? 'h-1 w-1/3 mt-1.5' : 'h-2 w-1/4 mt-3')} />
      <Bone className={cn('w-full bg-slate-100', compact ? 'h-1' : 'h-2')} />
      <Bone className={cn('bg-slate-100', compact ? 'h-1 w-11/12' : 'h-2 w-11/12')} />
      <Bone className={cn('bg-slate-100', compact ? 'h-1 w-4/5' : 'h-2 w-4/5')} />
      {!compact && (
        <>
          <Bone className="h-2 w-full bg-slate-100" />
          <Bone className="h-2 w-1/4 bg-slate-300 mt-3" />
          <Bone className="h-2 w-full bg-slate-100" />
          <Bone className="h-2 w-10/12 bg-slate-100" />
          <Bone className="h-2 w-3/4 bg-slate-100" />
          <Bone className="h-2 w-1/4 bg-slate-300 mt-3" />
          <Bone className="h-2 w-full bg-slate-100" />
          <Bone className="h-2 w-5/6 bg-slate-100" />
        </>
      )}
      {compact && (
        <>
          <Bone className="mt-2 h-1 w-1/3 bg-slate-300" />
          <Bone className="h-1 w-full bg-slate-100" />
          <Bone className="h-1 w-10/12 bg-slate-100" />
        </>
      )}
    </div>
  );
}

export function A4PageSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'aspect-[210/297] w-full max-w-[min(100%,42rem)] max-h-full rounded-[4px] border border-subtle shadow-lg overflow-hidden',
        className,
      )}
    >
      <A4DocumentSkeleton className="w-full h-full" />
    </div>
  );
}

export function CvCardSkeleton() {
  return (
    <div className="relative z-0 flex flex-col min-w-0 bg-surface rounded-[12px] border border-subtle shadow-card overflow-hidden">
      <span aria-hidden className="absolute top-0 left-0 z-10 w-1 h-full rounded-l-[12px] bg-surface-muted" />
      <div className="relative mt-3 mr-3 ml-4 h-[9.5rem] sm:h-[12rem] rounded-[8px] bg-surface-muted overflow-hidden">
        <div className="absolute left-1/2 top-2.5 -translate-x-1/2 w-[78%] max-w-[17rem] aspect-[210/297] rounded-[4px] bg-white border border-subtle shadow-card overflow-hidden">
          <A4DocumentSkeleton compact className="h-full" />
        </div>
      </div>
      <div className="flex flex-col flex-1 min-w-0 gap-2 px-4 pl-5 py-3">
        <Bone className="h-4 w-3/4" />
        <div className="flex items-center gap-1.5">
          <Bone className="h-5 w-14 rounded-full" />
          <Bone className="h-5 w-16 rounded-full" />
        </div>
        <Bone className="h-3 w-1/2 mt-1" />
      </div>
    </div>
  );
}

function TitleBlock({ wide = false }: { wide?: boolean }) {
  return (
    <div className="space-y-2">
      <Bone className={wide ? 'h-8 w-52' : 'h-7 w-44'} />
      <Bone className="h-3.5 w-72 max-w-full" />
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="relative overflow-x-hidden min-h-screen" aria-busy="true">
      <PageGlow />
      <ScreenBusy />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 relative z-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <TitleBlock />
          <div className="flex items-center gap-3">
            <Bone className="h-11 w-28" />
            <Bone className="h-11 w-36" />
          </div>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <Bone className="h-9 w-full sm:w-64" />
          <div className="flex items-center gap-1.5">
            <Bone className="h-8 w-16 rounded-full" />
            <Bone className="h-8 w-16 rounded-full" />
            <Bone className="h-8 w-24 rounded-full" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {times(6).map((index) => (
            <CvCardSkeleton key={index} />
          ))}
        </div>
      </main>
    </div>
  );
}

function ApplicationsChrome() {
  return (
    <>
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-5">
        <TitleBlock wide />
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-1 rounded-[8px] border border-subtle bg-surface p-1 shadow-sm">
            <Bone className="h-9 w-20" />
            <Bone className="h-9 w-24" />
          </div>
          <Bone className="h-11 w-40" />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <Bone className="h-9 w-full sm:w-64" />
        <Bone className="h-9 w-32" />
        <Bone className="h-9 w-28" />
        <Bone className="h-9 w-24" />
      </div>
    </>
  );
}

const TABLE_CELL_WIDTHS = ['w-4', 'w-40', 'w-28', 'w-20', 'w-12', 'w-24', 'w-16', 'w-10'];

export function ApplicationsTableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="bg-surface border border-subtle rounded-[12px] shadow-sm overflow-hidden flex-1 min-h-0">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left">
          <thead>
            <tr className="border-b border-subtle bg-canvas/45">
              {TABLE_CELL_WIDTHS.map((width, index) => (
                <th key={index} className="px-3 py-2.5">
                  <Bone className={`h-3 ${width}`} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {times(rows).map((row) => (
              <tr key={row} className="border-b border-subtle last:border-0">
                {TABLE_CELL_WIDTHS.map((width, cell) => (
                  <td key={cell} className="px-3 py-3">
                    <Bone className={`h-3.5 ${cell === 3 ? 'rounded-full w-16' : width}`} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ApplicationCardSkeleton() {
  return (
    <div className="bg-surface border border-subtle rounded-[12px] p-3 shadow-sm space-y-2">
      <div className="flex items-center justify-between">
        <Bone className="h-4 w-16 rounded-full" />
        <Bone className="h-4 w-10 rounded-full" />
      </div>
      <Bone className="h-3.5 w-11/12" />
      <Bone className="h-3 w-1/2" />
      <div className="flex items-center justify-between pt-1">
        <Bone className="h-3 w-16" />
        <Bone className="h-3 w-8" />
      </div>
    </div>
  );
}

const BOARD_COLUMNS = [
  { key: 'interested', color: 'bg-violet-500/10', border: 'border-violet-500/20', cards: 3 },
  { key: 'applied', color: 'bg-blue-500/10', border: 'border-blue-500/20', cards: 2 },
  { key: 'interview', color: 'bg-amber-500/10', border: 'border-amber-500/20', cards: 2 },
  { key: 'offer', color: 'bg-emerald-500/10', border: 'border-emerald-500/20', cards: 1 },
  { key: 'rejected', color: 'bg-rose-500/10', border: 'border-rose-500/20', cards: 1 },
  { key: 'archived', color: 'bg-slate-500/10', border: 'border-slate-500/20', cards: 1 },
] as const;

export function ApplicationsBoardSkeleton() {
  return (
    <div className="-mx-4 px-4 overflow-x-auto pb-4">
      <div className="grid min-w-[1480px] grid-cols-[1.4fr_1fr_1fr_1fr_1fr_1fr] gap-4 items-start">
        {BOARD_COLUMNS.map((column) => (
          <div
            key={column.key}
            className={`flex h-[calc(100vh-330px)] min-h-[520px] max-h-[760px] flex-col bg-surface rounded-[12px] border ${column.border} shadow-sm overflow-hidden`}
          >
            <div className="shrink-0 p-3.5 pb-3 border-b border-subtle bg-canvas/45">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-2">
                  <Bone className={`h-6 w-24 rounded-full ${column.color}`} />
                  <Bone className="h-3 w-28" />
                </div>
                <Bone className="h-8 w-10" />
              </div>
            </div>
            <div className="flex-1 p-2.5 space-y-2 overflow-hidden">
              {times(column.cards).map((index) => (
                <ApplicationCardSkeleton key={index} />
              ))}
            </div>
            <div className="shrink-0 border-t border-subtle bg-canvas/45 px-3.5 py-2.5 flex items-center justify-between">
              <Bone className="h-3 w-20" />
              <Bone className="h-3 w-8" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ApplicationsSkeleton({ layout = 'table' }: { layout?: 'table' | 'board' }) {
  return (
    <div className="w-full" aria-busy="true">
      <ScreenBusy />
      <ApplicationsChrome />
      {layout === 'board' ? <ApplicationsBoardSkeleton /> : <ApplicationsTableSkeleton />}
    </div>
  );
}

export function ApplicationsPageSkeleton({ layout = 'table' }: { layout?: 'table' | 'board' }) {
  const isTable = layout === 'table';
  return (
    <div
      className={`relative overflow-x-clip min-h-screen ${isTable ? 'md:h-[100dvh] md:overflow-hidden' : ''}`}
      aria-busy="true"
    >
      <PageGlow />
      <main
        className={`max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10 ${
          isTable ? 'md:h-full md:flex md:flex-col md:min-h-0' : ''
        }`}
      >
        <ApplicationsSkeleton layout={layout} />
      </main>
    </div>
  );
}

const COMPANY_CELL_WIDTHS = ['w-4', 'w-36', 'w-24', 'w-20', 'w-28', 'w-10', 'w-10', 'w-16', 'w-8'];

export function CompaniesSkeleton() {
  return (
    <div className="w-full md:flex md:flex-col md:flex-1 md:min-h-0" aria-busy="true">
      <ScreenBusy />
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-5 shrink-0">
        <TitleBlock wide />
        <Bone className="h-11 w-36" />
      </div>
      <Bone className="h-10 w-full max-w-md mb-4" />
      <div className="bg-surface border border-subtle rounded-[12px] shadow-sm overflow-hidden flex-1 min-h-0">
        <table className="w-full min-w-[720px] text-left">
          <thead>
            <tr className="border-b border-subtle bg-canvas/45">
              {COMPANY_CELL_WIDTHS.map((width, index) => (
                <th key={index} className="px-3 py-2.5">
                  <Bone className={`h-3 ${width}`} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {times(8).map((row) => (
              <tr key={row} className="border-b border-subtle last:border-0">
                {COMPANY_CELL_WIDTHS.map((width, cell) => (
                  <td key={cell} className="px-3 py-3">
                    <Bone className={`h-3.5 ${width}`} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function CompaniesPageSkeleton() {
  return (
    <div className="relative overflow-x-clip min-h-screen md:h-[100dvh] md:overflow-hidden" aria-busy="true">
      <PageGlow />
      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10 md:h-full md:flex md:flex-col md:min-h-0">
        <CompaniesSkeleton />
      </main>
    </div>
  );
}

export function CompanyDetailSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <ScreenBusy />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Bone className="h-5 w-32" />
        <Bone className="h-5 w-40" />
      </div>
      <div className="bg-surface p-6 border border-subtle rounded-[12px] shadow-sm space-y-3">
        <Bone className="h-8 w-56" />
        <Bone className="h-4 w-72 max-w-full" />
        <div className="flex gap-2 pt-1">
          <Bone className="h-5 w-24 rounded-full" />
          <Bone className="h-5 w-20 rounded-full" />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-5 bg-surface border border-subtle rounded-[12px] p-6 shadow-sm space-y-4">
          <Bone className="h-4 w-32" />
          {times(4).map((index) => (
            <div key={index} className="space-y-1.5">
              <Bone className="h-3 w-20" />
              <Bone className="h-10 w-full" />
            </div>
          ))}
          <Bone className="h-10 w-28" />
        </section>
        <section className="lg:col-span-7 space-y-4">
          <div className="bg-surface border border-subtle rounded-[12px] p-6 shadow-sm space-y-3">
            <Bone className="h-4 w-28" />
            {times(3).map((index) => (
              <div key={index} className="flex items-center justify-between gap-3 py-2 border-b border-subtle last:border-0">
                <div className="space-y-1.5 flex-1 min-w-0">
                  <Bone className="h-3.5 w-3/4" />
                  <Bone className="h-3 w-1/3" />
                </div>
                <Bone className="h-5 w-16 rounded-full" />
              </div>
            ))}
          </div>
          <div className="bg-surface border border-subtle rounded-[12px] p-6 shadow-sm space-y-3">
            <Bone className="h-4 w-24" />
            <Bone className="h-20 w-full" />
            <Bone className="h-9 w-28" />
          </div>
        </section>
      </div>
    </div>
  );
}

export function CompanyDetailPageSkeleton() {
  return (
    <div className="relative overflow-x-hidden min-h-screen" aria-busy="true">
      <PageGlow />
      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        <CompanyDetailSkeleton />
      </main>
    </div>
  );
}

export function OfferDetailSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <ScreenBusy />
      <div className="flex items-center justify-between gap-4 border-b border-subtle pb-4">
        <Bone className="h-9 w-36" />
        <div className="flex items-center gap-2">
          <Bone className="h-9 w-28" />
          <Bone className="h-9 w-40" />
          <Bone className="h-9 w-24" />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-4 bg-surface p-5 md:p-6 border border-subtle rounded-[12px] shadow-sm space-y-6">
          <div className="flex flex-col items-center bg-canvas/35 border border-subtle p-4 rounded-xl">
            <Bone className="h-3 w-28 mb-3" />
            <Bone className="h-28 w-28 rounded-full" />
            <Bone className="h-3 w-24 mt-3" />
          </div>
          <div className="space-y-3">
            <Bone className="h-3 w-20" />
            <Bone className="h-4 w-full" />
            <Bone className="h-4 w-3/4" />
            <Bone className="h-4 w-5/6" />
          </div>
        </div>
        <div className="lg:col-span-8 space-y-4">
          <div className="bg-surface border border-subtle rounded-[12px] p-6 shadow-sm space-y-3">
            <Bone className="h-6 w-2/3" />
            <Bone className="h-4 w-1/3" />
            <div className="flex gap-2">
              <Bone className="h-5 w-16 rounded-full" />
              <Bone className="h-5 w-20 rounded-full" />
            </div>
          </div>
          <div className="bg-surface border border-subtle rounded-[12px] p-6 shadow-sm space-y-2.5">
            <Bone className="h-4 w-32" />
            {times(8).map((index) => (
              <Bone key={index} className={`h-3 ${index % 3 === 0 ? 'w-full' : index % 3 === 1 ? 'w-11/12' : 'w-4/5'}`} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function OfferDetailPageSkeleton() {
  return (
    <div className="relative overflow-x-hidden min-h-screen" aria-busy="true">
      <PageGlow />
      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        <OfferDetailSkeleton />
      </main>
    </div>
  );
}

export function OfferDetailsModalSkeleton() {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-md"
      aria-busy="true"
    >
      <ScreenBusy />
      <div className="w-full max-w-2xl bg-surface border border-subtle rounded-2xl p-6 md:p-8 shadow-dialog max-h-[90vh] flex flex-col space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2 flex-1">
            <Bone className="h-4 w-20 rounded-full" />
            <Bone className="h-6 w-3/4" />
            <Bone className="h-4 w-1/3" />
          </div>
          <Bone className="h-8 w-8 rounded-[8px]" />
        </div>
        <div className="flex items-center gap-3">
          <Bone className="h-20 w-20 rounded-full" />
          <div className="flex-1 space-y-2">
            <Bone className="h-3 w-full" />
            <Bone className="h-3 w-5/6" />
            <Bone className="h-3 w-2/3" />
          </div>
        </div>
        <div className="space-y-2">
          {times(6).map((index) => (
            <Bone key={index} className={`h-3 ${index % 2 === 0 ? 'w-full' : 'w-11/12'}`} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function ProfileTabsSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <ScreenBusy />
      <div className="flex border-b border-subtle pb-px gap-1">
        <Bone className="h-10 w-28 rounded-none" />
        <Bone className="h-10 w-32 rounded-none" />
        <Bone className="h-10 w-24 rounded-none" />
      </div>
      <Bone className="h-16 w-full rounded-[12px]" />
      <div className="flex flex-wrap gap-3 bg-surface border border-ai/20 p-4 rounded-[12px]">
        <Bone className="h-11 w-44" />
        <Bone className="h-11 w-28" />
        <Bone className="h-11 w-40" />
        <Bone className="h-11 w-24 ml-auto" />
      </div>
      {times(3).map((index) => (
        <div key={index} className="bg-surface border border-subtle rounded-[12px] p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-subtle">
            <Bone className="h-8 w-8 rounded-lg" />
            <div className="space-y-1.5 flex-1">
              <Bone className="h-4 w-40" />
              <Bone className="h-3 w-64 max-w-full" />
            </div>
          </div>
          <Bone className={index === 0 ? 'h-32 w-full' : 'h-10 w-full'} />
          {index > 0 && <Bone className="h-10 w-2/3" />}
        </div>
      ))}
    </div>
  );
}

export function ProfilePageSkeleton() {
  return (
    <div className="relative overflow-x-hidden min-h-screen" aria-busy="true">
      <PageGlow />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-subtle pb-6">
          <div className="space-y-2">
            <Bone className="h-6 w-28 rounded-full" />
            <Bone className="h-8 w-48" />
            <Bone className="h-4 w-80 max-w-full" />
          </div>
        </div>
        <ProfileTabsSkeleton />
      </main>
    </div>
  );
}

export function SubscriptionPageSkeleton() {
  return (
    <div className="relative overflow-x-hidden min-h-screen" aria-busy="true">
      <PageGlow />
      <ScreenBusy />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10">
        <div className="text-center mb-12 space-y-3">
          <Bone className="h-6 w-28 rounded-full mx-auto" />
          <Bone className="h-9 w-64 mx-auto" />
          <Bone className="h-4 w-80 max-w-full mx-auto" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {times(2).map((index) => (
            <div
              key={index}
              className={`bg-surface p-8 rounded-[12px] border shadow-sm space-y-5 ${
                index === 1 ? 'border-ai/30' : 'border-subtle'
              }`}
            >
              <Bone className="h-5 w-24" />
              <Bone className="h-8 w-32" />
              <div className="space-y-3 pt-2">
                {times(4).map((line) => (
                  <div key={line} className="flex items-center gap-2.5">
                    <Bone className="h-4 w-4 rounded-full" />
                    <Bone className="h-3.5 flex-1" />
                  </div>
                ))}
              </div>
              <Bone className="h-11 w-full mt-4" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

function MarkdownPaneSkeleton() {
  return (
    <div className="h-full min-h-[400px] lg:min-h-0 flex flex-col bg-surface border border-subtle rounded-[12px] overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-subtle">
        {times(6).map((index) => (
          <Bone key={index} className="h-7 w-7" />
        ))}
      </div>
      <div className="flex-1 p-4 space-y-2.5">
        <Bone className="h-5 w-1/3" />
        {times(12).map((index) => (
          <Bone
            key={index}
            className={`h-3 ${
              index % 5 === 0 ? 'w-1/4 mt-3' : index % 4 === 0 ? 'w-4/5' : index % 3 === 0 ? 'w-11/12' : 'w-full'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

export function SidebarRailSkeleton() {
  return (
    <aside className="hidden md:flex sticky top-0 h-screen w-64 bg-canvas border-r border-subtle flex-col justify-between p-6">
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <Bone className="h-8 w-28" />
          <Bone className="h-8 w-8 rounded-full" />
        </div>
        <nav className="space-y-2">
          {times(4).map((index) => (
            <Bone key={index} className="h-11 w-full" />
          ))}
        </nav>
      </div>
      <Bone className="h-12 w-full" />
    </aside>
  );
}

export function EditorSkeleton() {
  return (
    <div className="min-h-screen bg-canvas flex flex-col md:flex-row text-text" aria-busy="true">
      <ScreenBusy />
      <div className="md:hidden flex items-center justify-between h-16 px-4 bg-canvas border-b border-subtle">
        <Bone className="h-7 w-24" />
        <Bone className="h-8 w-8" />
      </div>
      <SidebarRailSkeleton />
      <div className="flex-1 h-screen flex flex-col relative z-10 overflow-hidden">
        <header className="bg-white/80 dark:bg-canvas/80 backdrop-blur-md border-b border-subtle px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <Bone className="h-8 w-8" />
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Bone className="h-4 w-40" />
                <Bone className="h-4 w-16 rounded-full" />
              </div>
              <Bone className="h-3 w-48" />
            </div>
          </div>
          <Bone className="h-10 w-36" />
        </header>
        <div className="w-full bg-white/90 dark:bg-canvas/90 border-b border-subtle px-6 py-2 flex flex-wrap items-center gap-6 shrink-0">
          {times(4).map((index) => (
            <div key={index} className="space-y-1">
              <Bone className="h-2.5 w-12" />
              <Bone className="h-7 w-24" />
            </div>
          ))}
        </div>
        <div className="flex-1 flex flex-col md:flex-row gap-0 p-4 min-h-0">
          <div className="flex-1 min-h-[400px] lg:min-h-0">
            <MarkdownPaneSkeleton />
          </div>
          <div className="hidden lg:block w-2 mx-2" />
          <div className="flex-1 min-h-[400px] lg:min-h-0 flex flex-col bg-surface border border-subtle rounded-[12px] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b border-subtle">
              <Bone className="h-4 w-28" />
              <div className="flex items-center gap-2">
                <Bone className="h-7 w-20" />
                <Bone className="h-7 w-28" />
              </div>
            </div>
            <div className="flex-1 bg-canvas/50 flex items-center justify-center p-4">
              <A4PageSkeleton />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function TryPageSkeleton() {
  return (
    <div className="min-h-screen bg-canvas flex flex-col md:flex-row text-text" aria-busy="true">
      <div className="md:hidden flex items-center justify-between h-16 px-4 bg-canvas border-b border-subtle">
        <Bone className="h-7 w-24" />
        <Bone className="h-8 w-8" />
      </div>
      <SidebarRailSkeleton />
      <div className="flex-1 min-h-screen relative z-10">
        <DashboardSkeleton />
      </div>
    </div>
  );
}

export function AdminPageSkeleton() {
  return (
    <div className="relative overflow-x-hidden min-h-screen" aria-busy="true">
      <PageGlow />
      <ScreenBusy />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <TitleBlock wide />
          <Bone className="h-9 w-9" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 mb-8">
          {times(5).map((index) => (
            <Bone key={index} className="h-10 w-full" />
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
          {times(5).map((index) => (
            <div
              key={index}
              className="bg-surface p-6 rounded-[12px] border border-subtle flex items-center justify-between"
            >
              <div className="space-y-2">
                <Bone className="h-3 w-24" />
                <Bone className="h-8 w-16" />
              </div>
              <Bone className="h-12 w-12" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

export function AdminUserDetailsSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6" aria-busy="true">
      <ScreenBusy />
      {times(2).map((column) => (
        <div key={column} className="space-y-3">
          <Bone className="h-4 w-40" />
          <div className="space-y-2.5">
            {times(4).map((index) => (
              <div
                key={index}
                className="p-3 bg-canvas/40 rounded-[8px] border border-subtle flex items-center justify-between"
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <Bone className="h-3.5 w-2/3" />
                  <Bone className="h-3 w-1/2" />
                </div>
                <Bone className="h-5 w-14" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
