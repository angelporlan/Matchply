import { Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CompanyIconProps {
  companyId: string;
  iconHash?: string | null;
  name: string;
  size?: 'sm' | 'md';
  className?: string;
}

const SIZE_CLASS = {
  sm: 'h-5 w-5',
  md: 'h-8 w-8',
};

export function companyIconSrc(companyId: string, iconHash: string | null | undefined) {
  if (!iconHash) return null;
  return `/api/companies/${companyId}/icon?v=${encodeURIComponent(iconHash)}`;
}

export default function CompanyIcon({
  companyId,
  iconHash,
  name,
  size = 'sm',
  className,
}: CompanyIconProps) {
  const src = companyIconSrc(companyId, iconHash);
  const dim = SIZE_CLASS[size];

  if (!src) {
    return (
      <Building2
        aria-hidden="true"
        className={cn(dim, 'shrink-0 text-text-muted stroke-[1.75]', className)}
      />
    );
  }

  return (
    // Dynamic company favicons are served from the authenticated API; next/image is not needed.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      title={name}
      width={size === 'md' ? 32 : 20}
      height={size === 'md' ? 32 : 20}
      className={cn(dim, 'shrink-0 rounded-[4px] object-contain bg-surface-muted border border-subtle', className)}
    />
  );
}
