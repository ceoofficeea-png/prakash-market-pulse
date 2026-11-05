import { createFileRoute } from "@tanstack/react-router";
import { ExternalLink, ShieldAlert, ThumbsUp } from "lucide-react";

import { ChartCard, LinesChart } from "@/components/app/charts";
import { DemoNote, DetailStat, LoadingBlock, PageHeader } from "@/components/app/page";
import { StatusBadge } from "@/components/app/status-badge";
import { useCompetitorActivities, useCompetitorMonthly, useCompetitors, useLookups } from "@/lib/api";
import { fmtCompact, fmtDate, fmtUsd } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/competitors/$id")({
  head: () => ({ meta: [{"title": "Competitor profile \u2014 Prakash Pump"}, {"name": "description", "content": "Competitor profile analytics and records for the Prakash Pump marketing team."}, {"property": "og:title", "content": "Competitor profile \u2014 Prakash Pump"}, {"property": "og:description", "content": "Competitor profile analytics and records for the Prakash Pump marketing team."}, {"property": "og:type", "content": "website"}, {"name": "twitter:card", "content": "summary_large_image"}] }),
  component: CompetitorDetail,
});

const monthLabel = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { month: "short", year: "2-digit" });

function CompetitorDetail() {
  const { id } = Route.useParams();
  const cid = Number(id);
  const comps = useCompetitors();
  const monthly = useCompetitorMonthly();
  const acts = useCompetitorActivities();
  const { country } = useLookups();

  if (comps.isLoading) return <LoadingBlock />;
  const c = comps.data?.find((x) => x.id === cid);
  if (!c) return <div className="panel p-8 text-center text-muted-foreground">Competitor not found.</div>;
  const self = comps.data?.find((x) => x.is_self);
  const mine = (monthly.data ?? []).filter((m) => m.competitor_id === cid);
  const ours = (monthly.data ?? []).filter((m) => m.competitor_id === self?.id);
  const last = mine[mine.length - 1];

  const series = mine.map((m) => ({
    key: monthLabel(m.month),
    them: Number(m.share_of_voice),
    us: Number(ours.find((o) => o.month === m.month)?.share_of_voice ?? 0),
    themSpend: Number(m.est_ad_spend),
    usSpend: Number(ours.find((o) => o.month === m.month)?.est_ad_spend ?? 0),
  }));

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Competitors", to: "/competitors" }]}
        eyebrow={`${c.hq_country} · ${c.focus_segments.join(" · ")}`}
        title={c.name}
        actions={
          <>
            {!c.is_self && <StatusBadge value={c.threat_level} />}
            <a href={`https://${c.website}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
              {c.website} <ExternalLink className="size-3" />
            </a>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-6">
        <DetailStat label="Market share" value={`${c.market_share}%`} />
        <DetailStat label="Share of voice" value={`${Number(last?.share_of_voice ?? 0).toFixed(1)}%`} />
        <DetailStat label="Est. ad spend / mo" value={fmtUsd(Number(last?.est_ad_spend ?? 0), true)} />
        <DetailStat label="Social followers" value={fmtCompact(last?.social_followers ?? 0)} />
        <DetailStat label="Web visits / mo" value={fmtCompact(last?.web_visits ?? 0)} />
        <DetailStat label="Price index" value={Number(last?.price_index ?? 100).toFixed(0)} sub="100 = Prakash" />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard title="Share of voice: them vs us">
          <LinesChart data={series} series={[{ key: "them", label: c.name, color: "var(--chart-2)" }, { key: "us", label: "Prakash Pump", color: "var(--chart-1)" }]} fmt={(v) => `${v}%`} height={240} />
        </ChartCard>
        <ChartCard title="Estimated ad investment">
          <LinesChart data={series} series={[{ key: "themSpend", label: c.name, color: "var(--chart-2)" }, { key: "usSpend", label: "Prakash Pump", color: "var(--chart-1)" }]} fmt={(v) => fmtUsd(v, true)} height={240} />
        </ChartCard>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <ChartCard title="Assessment">
          <div className="space-y-4 text-sm">
            <div>
              <div className="eyebrow mb-1 flex items-center gap-1 text-success"><ThumbsUp className="size-3" /> Strengths</div>
              <p className="text-muted-foreground">{c.strengths}</p>
            </div>
            <div>
              <div className="eyebrow mb-1 flex items-center gap-1 text-warning"><ShieldAlert className="size-3" /> Weaknesses</div>
              <p className="text-muted-foreground">{c.weaknesses}</p>
            </div>
          </div>
        </ChartCard>
        <ChartCard title="Activity log" subtitle={`${(acts.data ?? []).filter((a) => a.competitor_id === cid).length} tracked moves`} className="xl:col-span-2">
          <ol className="relative space-y-3 border-l border-border pl-5">
            {(acts.data ?? []).filter((a) => a.competitor_id === cid).map((a) => (
              <li key={a.id} className="relative">
                <span className="absolute -left-[25px] top-1.5 size-2.5 rounded-full border-2 border-background bg-primary" />
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="num">{fmtDate(a.date)}</span> · <span>{a.activity_type}</span> · <span>{country(a.country_code)?.flag} {country(a.country_code)?.name}</span> <StatusBadge value={a.impact} />
                </div>
                <div className="mt-0.5 text-sm">{a.title}</div>
              </li>
            ))}
          </ol>
        </ChartCard>
      </div>
      <DemoNote />
    </>
  );
}
