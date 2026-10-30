import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

import { fmtPct } from "@/lib/format";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  label: string;
  value: string;
  delta?: number | null;
  /** When true a decrease is good (e.g. cost per lead) */
  invert?: boolean;
  hint?: string;
  icon?: LucideIcon;
  spark?: number[];
  color?: string;
  onClick?: () => void;
}

export function KpiCard({ label, value, delta, invert, hint, icon: Icon, spark, color = "var(--chart-1)", onClick }: KpiCardProps) {
  const good = delta == null ? null : invert ? delta < 0 : delta > 0;
  const data = spark?.map((v, i) => ({ i, v }));
  return (
    <div
      onClick={onClick}
      className={cn(
        "panel relative overflow-hidden p-4",
        onClick && "cursor-pointer transition-colors hover:border-primary/50",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="eyebrow">{label}</span>
        {Icon && <Icon className="size-4 text-muted-foreground" />}
      </div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <div>
          <div className="num text-2xl font-semibold text-foreground">{value}</div>
          <div className="mt-1 flex items-center gap-2 text-xs">
            {delta != null && Number.isFinite(delta) && (
              <span className={cn("inline-flex items-center gap-0.5 num font-medium", good ? "text-success" : "text-destructive")}>
                {delta >= 0 ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
                {fmtPct(Math.abs(delta))}
              </span>
            )}
            {hint && <span className="text-muted-foreground">{hint}</span>}
          </div>
        </div>
        {data && data.length > 1 && (
          <div className="h-10 w-24 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id={`spark-${label.replace(/\W/g, "")}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.45} />
                    <stop offset="100%" stopColor={color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} fill={`url(#spark-${label.replace(/\W/g, "")})`} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
