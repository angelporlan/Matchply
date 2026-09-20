import Link from 'next/link';

export function AdminEmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-[12px] border border-subtle bg-surface p-8 text-center">
      <h2 className="font-display font-semibold text-text">{title}</h2>
      <p className="mt-2 text-sm text-text-muted">{description}</p>
    </div>
  );
}

export function AdminErrorState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-[12px] border border-subtle bg-danger-surface p-6" role="alert">
      <h2 className="font-display font-semibold text-danger-text">{title}</h2>
      <p className="mt-2 text-sm text-danger-text">{description}</p>
    </div>
  );
}

export function AdminPagination({
  page,
  pageCount,
  hrefFor,
}: {
  page: number;
  pageCount: number;
  hrefFor: (page: number) => string;
}) {
  if (pageCount <= 1) return null;
  return (
    <nav aria-label="Paginación" className="flex items-center justify-between gap-3 pt-4">
      <Link
        href={hrefFor(Math.max(1, page - 1))}
        aria-disabled={page <= 1}
        className="min-h-[44px] inline-flex items-center rounded-[8px] border border-control px-4 text-sm font-semibold"
      >
        Anterior
      </Link>
      <p className="text-sm text-text-muted">Página {page} de {pageCount}</p>
      <Link
        href={hrefFor(Math.min(pageCount, page + 1))}
        aria-disabled={page >= pageCount}
        className="min-h-[44px] inline-flex items-center rounded-[8px] border border-control px-4 text-sm font-semibold"
      >
        Siguiente
      </Link>
    </nav>
  );
}
