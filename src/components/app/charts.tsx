import type { ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from "recharts";

import { CHART_COLORS, fmtCompact, fmtShortDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export function ChartCard({
  title,
  subtitle,
  actions,
  children,
  className,
}: {
  title: string;
  subtitle?: string | undefined;
  actions?: ReactNode | undefined;
  children: ReactNode;
  className?: string | undefined;
}) {
  return (
    <section className={cn("panel flex flex-col p-4", className)}>
      <header className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {actions}
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}

type Fmt = (v: number) => string;

function ThemedTooltip({ active, payload, label, fmt, labelFmt }: TooltipProps<number, string> & { fmt?: Fmt | undefined; labelFmt?: ((l: string) => string) | undefined }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 font-medium text-foreground">{labelFmt ? labelFmt(String(label)) : label}</div>
      {payload.map((p) => (
        <div key={String(p.dataKey)} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="size-2 rounded-full" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="num text-foreground">{fmt ? fmt(Number(p.value)) : fmtCompact(Number(p.value))}</span>
        </div>
      ))}
    </div>
  );
}

export interface Series {
  key: string;
  label: string;
  color?: string | undefined;
  axis?: "left" | "right" | undefined;
  type?: "area" | "line" | "bar" | undefined;
}

const isDateKey = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v);

export function TrendChart({
  data,
  xKey = "key",
  series,
  height = 260,
  fmt,
  rightFmt,
  stacked,
}: {
  data: Record<string, unknown>[];
  xKey?: string | undefined;
  series: Series[];
  height?: number | undefined;
  fmt?: Fmt | undefined;
  rightFmt?: Fmt | undefined;
  stacked?: boolean | undefined;
}) {
  const hasRight = series.some((s) => s.axis === "right");
  const tickFmt = (v: string) => (isDateKey(v) ? fmtShortDate(v) : v);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 4, right: hasRight ? 0 : 8, left: -8, bottom: 0 }}>
        <defs>
          {series.map((s, i) => (
            <linearGradient key={s.key} id={`g-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color ?? CHART_COLORS[i]} stopOpacity={0.35} />
              <stop offset="100%" stopColor={s.color ?? CHART_COLORS[i]} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey={xKey} tickFormatter={tickFmt} tickLine={false} axisLine={false} minTickGap={24} />
        <YAxis yAxisId="left" tickFormatter={(v) => (fmt ? fmt(v) : fmtCompact(v))} tickLine={false} axisLine={false} width={56} />
        {hasRight && (
          <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => (rightFmt ? rightFmt(v) : fmtCompact(v))} tickLine={false} axisLine={false} width={52} />
        )}
        <Tooltip content={<ThemedTooltip fmt={fmt} labelFmt={(l) => (isDateKey(l) ? fmtShortDate(l) : l)} />} />
        {series.length > 1 && <Legend iconType="circle" iconSize={8} />}
        {series.map((s, i) => (
          <Area
            key={s.key}
            yAxisId={s.axis ?? "left"}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            {...(stacked ? { stackId: "1" } : {})}
            stroke={s.color ?? CHART_COLORS[i]}
            strokeWidth={2}
            fill={`url(#g-${s.key})`}
            isAnimationActive={false}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function LinesChart({ data, xKey = "key", series, height = 260, fmt }: { data: Record<string, unknown>[]; xKey?: string | undefined; series: Series[]; height?: number | undefined; fmt?: Fmt | undefined }) {
  const tickFmt = (v: string) => (isDateKey(v) ? fmtShortDate(v) : v);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey={xKey} tickFormatter={tickFmt} tickLine={false} axisLine={false} minTickGap={24} />
        <YAxis tickFormatter={(v) => (fmt ? fmt(v) : fmtCompact(v))} tickLine={false} axisLine={false} width={56} />
        <Tooltip content={<ThemedTooltip fmt={fmt} labelFmt={(l) => (isDateKey(l) ? fmtShortDate(l) : l)} />} />
        <Legend iconType="circle" iconSize={8} />
        {series.map((s, i) => (
          <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color ?? CHART_COLORS[i]} strokeWidth={2} dot={false} isAnimationActive={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function BarsChart({
  data,
  xKey = "key",
  series,
  height = 260,
  fmt,
  horizontal,
  stacked,
  onBarClick,
  colorByIndex,
}: {
  data: Record<string, unknown>[];
  xKey?: string | undefined;
  series: Series[];
  height?: number | undefined;
  fmt?: Fmt | undefined;
  horizontal?: boolean | undefined;
  stacked?: boolean | undefined;
  onBarClick?: ((row: Record<string, unknown>) => void) | undefined;
  colorByIndex?: boolean | undefined;
}) {
  const tickFmt = (v: string) => (isDateKey(v) ? fmtShortDate(v) : v);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout={horizontal ? "vertical" : "horizontal"} margin={{ top: 4, right: 8, left: horizontal ? 8 : -8, bottom: 0 }}>
        <CartesianGrid vertical={!!horizontal} horizontal={!horizontal} strokeDasharray="3 3" />
        {horizontal ? (
          <>
            <XAxis type="number" tickFormatter={(v) => (fmt ? fmt(v) : fmtCompact(v))} tickLine={false} axisLine={false} />
            <YAxis type="category" dataKey={xKey} tickLine={false} axisLine={false} width={120} />
          </>
        ) : (
          <>
            <XAxis dataKey={xKey} tickFormatter={tickFmt} tickLine={false} axisLine={false} minTickGap={8} />
            <YAxis tickFormatter={(v) => (fmt ? fmt(v) : fmtCompact(v))} tickLine={false} axisLine={false} width={56} />
          </>
        )}
        <Tooltip cursor={{ fill: "var(--accent)", opacity: 0.4 }} content={<ThemedTooltip fmt={fmt} labelFmt={(l) => (isDateKey(l) ? fmtShortDate(l) : l)} />} />
        {series.length > 1 && <Legend iconType="circle" iconSize={8} />}
        {series.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.label}
            {...(stacked ? { stackId: "1" } : {})}
            fill={s.color ?? CHART_COLORS[i]}
            radius={stacked ? 0 : horizontal ? [0, 3, 3, 0] : [3, 3, 0, 0]}
            maxBarSize={36}
            isAnimationActive={false}
            {...(onBarClick
              ? { onClick: (d: unknown) => onBarClick((d as { payload: Record<string, unknown> }).payload), className: "cursor-pointer" }
              : {})}
          >
            {colorByIndex && data.map((_, idx) => <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />)}
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DonutChart({
  data,
  height = 220,
  fmt,
  onSliceClick,
}: {
  data: { name: string; value: number; color?: string | undefined; id?: string | undefined }[];
  height?: number | undefined;
  fmt?: Fmt | undefined;
  onSliceClick?: ((d: { name: string; id?: string | undefined }) => void) | undefined;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="flex items-center gap-4">
      <div className="relative shrink-0" style={{ width: height, height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="62%"
              outerRadius="92%"
              paddingAngle={2}
              stroke="none"
              isAnimationActive={false}
              {...(onSliceClick
                ? { onClick: (d: unknown) => onSliceClick(d as { name: string; id?: string }), className: "cursor-pointer" }
                : {})}
            >
              {data.map((d, i) => (
                <Cell key={d.name} fill={d.color ?? CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<ThemedTooltip fmt={fmt} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="num text-lg font-semibold">{fmt ? fmt(total) : fmtCompact(total)}</span>
          <span className="eyebrow">Total</span>
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-1.5 text-xs">
        {data.map((d, i) => (
          <li
            key={d.name}
            className={cn("flex items-center justify-between gap-2", onSliceClick && "cursor-pointer hover:text-foreground")}
            onClick={onSliceClick ? () => onSliceClick(d) : undefined}
          >
            <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
              <span className="size-2 shrink-0 rounded-full" style={{ background: d.color ?? CHART_COLORS[i % CHART_COLORS.length] }} />
              <span className="truncate">{d.name}</span>
            </span>
            <span className="num text-foreground">{total ? `${((d.value / total) * 100).toFixed(1)}%` : "—"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Ranked horizontal bars as a list — good for drill-down rows. */
export function BarList({
  items,
  fmt = fmtCompact,
  onSelect,
  color = "var(--chart-1)",
}: {
  items: { id: string; label: ReactNode; value: number; sub?: ReactNode | undefined }[];
  fmt?: Fmt | undefined;
  onSelect?: ((id: string) => void) | undefined;
  color?: string | undefined;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="space-y-1">
      {items.map((it) => (
        <li key={it.id}>
          <button
            type="button"
            disabled={!onSelect}
            onClick={() => onSelect?.(it.id)}
            className="group relative flex w-full items-center justify-between gap-3 overflow-hidden rounded-md px-2 py-1.5 text-left text-sm enabled:hover:bg-accent/60"
          >
            <span className="absolute inset-y-1 left-0 rounded-sm opacity-20" style={{ width: `${(it.value / max) * 100}%`, background: color }} />
            <span className="relative flex min-w-0 items-center gap-2 truncate">{it.label}</span>
            <span className="relative flex shrink-0 items-center gap-2">
              {it.sub && <span className="text-xs text-muted-foreground">{it.sub}</span>}
              <span className="num text-foreground">{fmt(it.value)}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
