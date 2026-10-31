import { Link } from "@tanstack/react-router";
import { ChevronRight, Lock } from "lucide-react";
import type { ReactNode } from "react";

import { FilterBar, type FilterKind } from "@/components/app/filter-bar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  filters,
  crumbs,
}: {
  eyebrow?: string | undefined;
  title: ReactNode;
  description?: string | undefined;
  actions?: ReactNode | undefined;
  filters?: FilterKind[] | undefined;
  crumbs?: { label: string | undefined; to: string }[];
}) {
  return (
    <div className="mb-5 space-y-4">
      {crumbs && (
        <nav className="flex items-center gap-1 text-xs text-muted-foreground">
          {crumbs.map((c) => (
            <span key={c.to} className="flex items-center gap-1">
              <Link to={c.to} className="hover:text-foreground">
                {c.label}
              </Link>
              <ChevronRight className="size-3" />
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && <div className="eyebrow mb-1 text-primary">{eyebrow}</div>}
          <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
          {description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {filters && filters.length > 0 && (
        <div className="rounded-lg border border-border bg-card/60 p-2">
          <FilterBar show={filters} />
        </div>
      )}
    </div>
  );
}

export function KpiGrid({ children, cols = 6 }: { children: ReactNode; cols?: 3 | 4 | 5 | 6 }) {
  const map = { 3: "lg:grid-cols-3", 4: "lg:grid-cols-4", 5: "lg:grid-cols-5", 6: "lg:grid-cols-6" };
  return <div className={cn("mb-4 grid grid-cols-2 gap-3 md:grid-cols-3", map[cols])}>{children}</div>;
}

export function LoadingBlock({ className }: { className?: string }) {
  return <Skeleton className={cn("h-64 w-full rounded-xl bg-surface-2", className)} />;
}

export function NoAccess({ what = "this area" }: { what?: string }) {
  return (
    <div className="panel mx-auto mt-16 max-w-md p-8 text-center">
      <Lock className="mx-auto size-8 text-primary" />
      <h2 className="mt-3 text-lg font-semibold">Restricted</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Your role does not include access to {what}. Ask an administrator to update your role.
      </p>
    </div>
  );
}

export function DetailStat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-surface-2/50 p-3">
      <div className="eyebrow">{label}</div>
      <div className="num mt-1 text-lg font-semibold">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

export function DemoNote() {
  return (
    <p className="mt-6 text-center text-[11px] text-muted-foreground/70">
      Demonstration data · live connections arrive in stage 2
    </p>
  );
}
