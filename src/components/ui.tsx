import Link from "next/link";
import type { ReactNode } from "react";
import { SITE_STATUS_LABEL, type SiteStatus } from "@/lib/domain/site";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="flex items-start justify-between gap-4 px-5 pt-8 pb-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle ? (
          <p className="mt-1 text-sm text-muted">{subtitle}</p>
        ) : null}
      </div>
      {action}
    </header>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-line bg-surface p-5 ${className}`}
    >
      {children}
    </div>
  );
}

export function EmptyState({
  message,
  actionHref,
  actionLabel,
}: {
  message: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <Card className="text-center">
      <p className="text-sm text-muted">{message}</p>
      {actionHref && actionLabel ? (
        <Link
          href={actionHref}
          className="mt-4 inline-block rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white"
        >
          {actionLabel}
        </Link>
      ) : null}
    </Card>
  );
}

const STATUS_STYLE: Record<SiteStatus, string> = {
  inquiry: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  quoted: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  confirmed: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  in_progress:
    "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
  done: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
};

export function StatusBadge({ status }: { status: SiteStatus }) {
  return (
    <span
      className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[status]}`}
    >
      {SITE_STATUS_LABEL[status]}
    </span>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      {hint ? <span className="ml-2 text-xs text-muted">{hint}</span> : null}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

export const inputClass =
  "w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-base outline-none focus:border-brand";
