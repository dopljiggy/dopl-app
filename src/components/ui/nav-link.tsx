"use client";

import Link, { useLinkStatus } from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Props = Omit<ComponentProps<typeof Link>, "children" | "className"> & {
  children: ReactNode;
  className?: string;
  pendingClassName?: string;
};

/**
 * <Link> wrapper that applies `pendingClassName` while navigation is in
 * flight. Leans on Next.js 16's `useLinkStatus` hook. Pending state is
 * skipped when the destination was already prefetched, so this is
 * primarily a slow-network safety net rather than every-click feedback.
 */
export function NavLink({
  children,
  className,
  pendingClassName = "opacity-60",
  ...rest
}: Props) {
  return (
    <Link {...rest}>
      <NavLinkInner className={className} pendingClassName={pendingClassName}>
        {children}
      </NavLinkInner>
    </Link>
  );
}

function NavLinkInner({
  children,
  className,
  pendingClassName,
}: {
  children: ReactNode;
  className?: string;
  pendingClassName: string;
}) {
  const { pending } = useLinkStatus();
  return (
    <NavLinkView
      pending={pending}
      className={className}
      pendingClassName={pendingClassName}
    >
      {children}
    </NavLinkView>
  );
}

/**
 * Pure presentational wrapper. Split out so the pending logic is
 * testable without a <Link> context.
 */
export function NavLinkView({
  pending,
  children,
  className,
  pendingClassName,
}: {
  pending: boolean;
  children: ReactNode;
  className?: string;
  pendingClassName: string;
}) {
  const cls = `${className ?? ""} ${pending ? pendingClassName : ""}`.trim();
  return <span className={cls}>{children}</span>;
}
