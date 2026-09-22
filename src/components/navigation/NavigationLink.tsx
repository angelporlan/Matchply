'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { hrefMatchesLocation, splitHref } from '@/lib/navigation-pending';
import { useNavigationPending } from '@/components/navigation/NavigationPendingProvider';

type NavigationLinkProps = React.ComponentProps<typeof Link> & {
  activeClassName?: string;
  pendingClassName?: string;
  isCurrent?: boolean;
};

export default function NavigationLink({
  href,
  className,
  activeClassName,
  pendingClassName,
  isCurrent: isCurrentOverride,
  onClick,
  children,
  ...rest
}: NavigationLinkProps) {
  const pathname = usePathname();
  const { pendingHref, beginNavigation } = useNavigationPending();
  const hrefValue = typeof href === 'string' ? href : href.pathname || '/';
  const search = typeof window !== 'undefined' ? window.location.search : '';
  const link = splitHref(hrefValue);
  const isCurrent = isCurrentOverride ?? hrefMatchesLocation(hrefValue, pathname, search);
  const isPending = Boolean(pendingHref && hrefMatchesLocation(pendingHref, link.pathname, link.search));

  return (
    <Link
      {...rest}
      href={href}
      aria-current={isCurrent ? 'page' : undefined}
      aria-busy={isPending || undefined}
      className={[className, isCurrent ? activeClassName : '', isPending ? pendingClassName : '']
        .filter(Boolean)
        .join(' ')}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        beginNavigation(hrefValue, event);
      }}
    >
      {children}
    </Link>
  );
}
