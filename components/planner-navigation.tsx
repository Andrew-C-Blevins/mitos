'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createContext, useContext, type ComponentProps } from 'react';

export const PlannerNavigation = createContext<(href: string, replace?: boolean) => void>(() => {});
export function usePlannerNavigation() {
  return useContext(PlannerNavigation);
}

// Item data already lives in the browser. A local history transition avoids
// waiting for a second server navigation merely to open that same data.
export function PlannerLink({
  href,
  ...props
}: Omit<ComponentProps<typeof Link>, 'href'> & { href: string }) {
  const navigate = usePlannerNavigation();
  const pathname = usePathname();
  return (
    <Link
      {...props}
      href={href}
      prefetch={false}
      scroll={false}
      onNavigate={(event) => {
        if (pathname === '/' || pathname.startsWith('/items/')) {
          event.preventDefault();
          navigate(href);
        }
      }}
    />
  );
}
