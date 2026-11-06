import { Bot, MessageCircle, Star, ThumbsUp, UserCheck, Users } from "lucide-react";

import { BarList, ChartCard, DonutChart } from "@/components/app/charts";
import { KpiCard } from "@/components/app/kpi-card";
import { KpiGrid } from "@/components/app/page";
import { StatusBadge } from "@/components/app/status-badge";
import {
  AVATAR_FEEDBACK_TAGS,
  AVATAR_FUNNEL,
  AVATAR_HANDOVER_CHANNELS,
  AVATAR_KPIS,
  AVATAR_SEGMENT_SPLIT,
  AVATAR_TOP_MODELS,
} from "@/lib/avatar-demo";
import { fmtCompact, fmtNum, fmtPct, safeDiv } from "@/lib/format";
import { cn } from "@/lib/utils";

function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={cn("size-3.5", i <= Math.round(value) ? "fill-primary text-primary" : "text-muted-foreground/40")} />
      ))}
    </span>
  );
}

export function AvatarAnalytics() {
  const k = AVATAR_KPIS;
  const maxTag = Math.max(...AVATAR_FEEDBACK_TAGS.map((t) => t.count));

  return (
    <div className="space-y-4">
      <KpiGrid cols={4}>
        <KpiCard label="Customer consultations" value={fmtNum(k.consultations)} delta={k.consultationsDelta} icon={Users} hint="vs prev." />
        <KpiCard label="Recommendation accuracy" value={fmtPct(k.recommendationAccuracy)} delta={k.accuracyDelta} icon={ThumbsUp} hint="correct pump & motor sizing" />
        <KpiCard label="Avg feedback" value={`${k.avgFeedback.toFixed(1)} / 5`} delta={k.feedbackDelta} icon={Star} hint={`CSAT ${fmtPct(k.csat)}`} />
        <KpiCard label="Leads handed to sales" value={fmtNum(k.leadsHandedToSales)} delta={k.leadsDelta} icon={UserCheck} hint="WhatsApp + form" />
      </KpiGrid>

      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard title="Avatar conversion funnel" subtitle="Visit → sales qualified lead" className="xl:col-span-2">
          <div className="space-y-2.5 pt-1">
            {AVATAR_FUNNEL.map((s, i) => {
              const first = AVATAR_FUNNEL[0]?.value ?? 1;
              const w = Math.max(6, (Math.log10(Math.max(1, s.value)) / Math.log10(Math.max(10, first))) * 100);
              const prev = i > 0 ? AVATAR_FUNNEL[i - 1]?.value ?? 0 : null;
              const conv = prev != null ? safeDiv(s.value, prev) : null;
              return (
                <div key={s.label}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-muted-foreground">{s.label}</span>
                    <span className="num">
                      {fmtCompact(s.value)} {conv != null && <span className="text-muted-foreground">· {fmtPct(conv)}</span>}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-surface-2">
                    <div className="bg-signal h-2 rounded-full" style={{ width: `${w}%`, opacity: 1 - i * 0.12 }} />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Overall visit-to-SQL rate <span className="num text-foreground">{fmtPct(safeDiv(AVATAR_FUNNEL[4]?.value ?? 0, AVATAR_FUNNEL[0]?.value ?? 1))}</span>
          </p>
        </ChartCard>

        <div className="space-y-4">
          <ChartCard title="Recommendations by segment">
            <DonutChart data={AVATAR_SEGMENT_SPLIT} height={160} fmt={fmtNum} />
          </ChartCard>
          <ChartCard title="Lead handover channel">
            <DonutChart data={AVATAR_HANDOVER_CHANNELS} height={150} fmt={fmtNum} />
          </ChartCard>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard title="Top recommended pumps & motors" subtitle="Acceptance = customer confirmed the sizing" className="xl:col-span-2">
          <BarList
            items={AVATAR_TOP_MODELS.map((m) => ({
              id: m.model,
              label: (
                <span className="flex items-center gap-2">
                  {m.model} <StatusBadge value={m.segment} />
                </span>
              ),
              value: m.recommendations,
              sub: `${fmtPct(m.acceptanceRate)} accepted`,
            }))}
            fmt={fmtNum}
          />
        </ChartCard>

        <ChartCard title="Feedback & sizing issues" subtitle="Most-mentioned themes">
          <ul className="flex flex-wrap gap-2 pt-1">
            {AVATAR_FEEDBACK_TAGS.map((t) => {
              const scale = 0.75 + (t.count / maxTag) * 0.5;
              return (
                <li
                  key={t.label}
                  className={cn(
                    "rounded-full border px-2.5 py-1",
                    t.tone === "praise" ? "border-success/30 bg-success/10 text-success" : "border-warning/30 bg-warning/10 text-warning",
                  )}
                  style={{ fontSize: `${scale}rem` }}
                >
                  {t.label} <span className="num opacity-70">{t.count}</span>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
            <MessageCircle className="size-3.5" /> Collected from post-consultation star ratings and chat transcripts.
          </p>
        </ChartCard>
      </div>

      <div className="panel flex items-start gap-3 p-4 text-sm">
        <Bot className="mt-0.5 size-4 shrink-0 text-primary" />
        <p className="text-muted-foreground">
          Stage 1 shows curated demonstration figures for the Prakash AI Avatar. In stage 2 the avatar connects live: every website and WhatsApp
          consultation is logged, sized recommendations are verified against orders, and leads flow into the CRM with the full conversation summary
          attached.
        </p>
      </div>
    </div>
  );
}
