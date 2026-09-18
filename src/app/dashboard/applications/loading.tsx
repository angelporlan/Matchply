export default function ApplicationsLoading() {
  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-pulse">
      <div className="h-8 w-52 rounded-[8px] bg-surface-muted mb-6" />
      <div className="grid min-w-0 grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-[520px] rounded-[12px] border border-subtle bg-surface" />
        ))}
      </div>
    </div>
  );
}
