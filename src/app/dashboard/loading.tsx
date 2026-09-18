export default function DashboardLoading() {
  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-pulse">
      <div className="h-8 w-64 rounded-[8px] bg-surface-muted mb-3" />
      <div className="h-4 w-96 max-w-full rounded-[8px] bg-surface-muted mb-8" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-56 rounded-[12px] border border-subtle bg-surface" />
        ))}
      </div>
    </div>
  );
}
