import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { BarsChart, ChartCard, LinesChart } from "@/components/app/charts";
import { DataTable } from "@/components/app/data-table";
import { KpiCard } from "@/components/app/kpi-card";
import { DemoNote, KpiGrid, PageHeader } from "@/components/app/page";
import { StatusBadge } from "@/components/app/status-badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { totals, useLookups, useMetrics, type MetricsRow } from "@/lib/api";
import { useFilters } from "@/lib/filters";
import { fmtCompact, fmtNum, fmtPct, fmtUsd, grainFor, pctChange, PLATFORMS, platformColor, platformLabel, safeDiv } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/ads")({
  head: () => ({ meta: [{ title: "Google & Meta Ads — Prakash Pump" }] }),
  component: AdsPage,
});

type Metric = "spend" | "clicks" | "leads" | "impressions";
const METRICS: { id: Metric; label: string }[] = [
  { id: "spend", label: "Spend" },
  { id: "leads", label: "Leads" },
  { id: "clicks", label: "Clicks" },
  { id: "impressions", label: "Impressions" },
];

const derive = (r: Pick<MetricsRow, "impressions" | "clicks" | "spend" | "conversions" | "leads" | "revenue">) => {
  const spend = Number(r.spend);
  const clicks = Number(r.clicks);
  const imp = Number(r.impressions);
  const leads = Number(r.leads);
  return {
    spend,
    clicks,
    impressions: imp,
    leads,
    conversions: Number(r.conversions),
    revenue: Number(r.revenue),
    ctr: safeDiv(clicks, imp),
    cpc: safeDiv(spend, clicks),
    cpl: safeDiv(spend, leads),
    roas: safeDiv(Number(r.revenue), spend),
  };
};

function AdsPage() {
  const f = useFilters();
  const navigate = useNavigate();
  const { country, campaign } = useLookups();
  const [metric, setMetric] = useState<Metric>("spend");
  const grain = grainFor(f.days);

  const all = useMetrics("all");
  const prev = useMetrics("all", { from: f.prevFrom, to: f.prevTo });
  const byPlatform = useMetrics("platform");
  const byCountry = useMetrics("country");
  const byCampaign = useMetrics("campaign");
  const g = useMetrics(grain, { platforms: ["google_ads"] });
  const m = useMetrics(grain, { platforms: ["meta_ads"] });
  const l = useMetrics(grain, { platforms: ["linkedin_ads"] });
  const y = useMetrics(grain, { platforms: ["youtube_ads"] });

  const cur = totals(all.data);
  const pre = totals(prev.data);
  const c = derive(cur);
  const p = derive(pre);

  const visiblePlatforms = PLATFORMS.filter((pl) => !f.platforms.length || f.platforms.includes(pl.id));
  const trend = useMemo(() => {
    const map = new Map<string, Record<string, number | string>>();
    const add = (rows: MetricsRow[] | undefined, id: string) => {
      for (const r of rows ?? []) {
        const row = map.get(r.key) ?? { key: r.key };
        row[id] = Number(r[metric]);
        map.set(r.key, row);
      }
    };
    add(g.data, "google_ads");
    add(m.data, "meta_ads");
    add(l.data, "linkedin_ads");
    add(y.data, "youtube_ads");
    return [...map.values()].sort((a, b) => String(a["key"]).localeCompare(String(b["key"])));
  }, [g.data, m.data, l.data, y.data, metric]);

  const platformRows = (byPlatform.data ?? []).map((r) => ({ key: r.key, ...derive(r) }));
  const countryRows = (byCountry.data ?? []).map((r) => ({ key: r.key, ...derive(r) }));
  const campaignRows = (byCampaign.data ?? []).map((r) => ({ key: r.key, c: campaign(Number(r.key)), ...derive(r) }));

  return (
    <>
      <PageHeader
        eyebrow="03 · Paid Media"
        title="Google Ads, Meta Ads & paid social"
        description="Platform, country and campaign performance for all paid media, with cost efficiency and return."
        filters={["date", "country", "platform", "campaign"]}
      />

      <KpiGrid cols={6}>
        <KpiCard label="Spend" value={fmtUsd(c.spend, true)} delta={pctChange(c.spend, p.spend)} />
        <KpiCard label="Impressions" value={fmtCompact(c.impressions)} delta={pctChange(c.impressions, p.impressions)} />
        <KpiCard label="CTR" value={fmtPct(c.ctr, 2)} delta={pctChange(c.ctr, p.ctr)} />
        <KpiCard label="Avg CPC" value={fmtUsd(c.cpc)} delta={pctChange(c.cpc, p.cpc)} invert />
        <KpiCard label="Cost per lead" value={fmtUsd(c.cpl)} delta={pctChange(c.cpl, p.cpl)} invert />
        <KpiCard label="ROAS" value={`${c.roas.toFixed(1)}×`} delta={pctChange(c.roas, p.roas)} />
      </KpiGrid>

      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard
          title="Platform trend"
          subtitle={`${grain === "week" ? "Weekly" : "Daily"} ${METRICS.find((x) => x.id === metric)?.label.toLowerCase()} by platform`}
          className="xl:col-span-2"
          actions={
            <Tabs value={metric} onValueChange={(v) => setMetric(v as Metric)}>
              <TabsList className="h-8">
                {METRICS.map((x) => (
                  <TabsTrigger key={x.id} value={x.id} className="text-xs">
                    {x.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          }
        >
          <LinesChart
            data={trend}
            series={visiblePlatforms.map((pl) => ({ key: pl.id, label: pl.label, color: pl.color }))}
            fmt={metric === "spend" ? (v) => fmtUsd(v, true) : fmtCompact}
            height={290}
          />
        </ChartCard>
        <ChartCard title="Cost per lead by platform" subtitle="Lower is better">
          <BarsChart
            data={platformRows.map((r) => ({ key: platformLabel(r.key), cpl: Number(r.cpl.toFixed(2)), id: r.key }))}
            series={[{ key: "cpl", label: "CPL" }]}
            fmt={(v) => fmtUsd(v)}
            colorByIndex
            height={290}
            onBarClick={(row) => f.setPlatforms([String(row["id"])])}
          />
        </ChartCard>
      </div>

      <h2 className="mb-2 mt-6 text-sm font-semibold">Platform comparison</h2>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {platformRows.map((r) => (
          <button
            key={r.key}
            type="button"
            onClick={() => f.setPlatforms(f.platforms.length === 1 && f.platforms[0] === r.key ? [] : [r.key])}
            className={cn("panel p-4 text-left transition-colors hover:border-primary/50", f.platforms.includes(r.key) && "border-primary/60")}
          >
            <div className="flex items-center gap-2">
              <span className="size-2.5 rounded-full" style={{ background: platformColor(r.key) }} />
              <span className="font-semibold">{platformLabel(r.key)}</span>
              <span className="num ml-auto text-xs text-muted-foreground">{fmtPct(safeDiv(r.spend, c.spend))} of spend</span>
            </div>
            <dl className="mt-3 grid grid-cols-3 gap-y-2 text-xs">
              {[
                ["Spend", fmtUsd(r.spend, true)],
                ["Leads", fmtNum(r.leads)],
                ["CPL", fmtUsd(r.cpl)],
                ["CTR", fmtPct(r.ctr, 2)],
                ["CPC", fmtUsd(r.cpc)],
                ["ROAS", `${r.roas.toFixed(1)}×`],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="eyebrow">{k}</dt>
                  <dd className="num mt-0.5 text-sm text-foreground">{v}</dd>
                </div>
              ))}
            </dl>
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <DataTable
          rows={countryRows}
          rowKey={(r) => r.key}
          onRowClick={(r) => navigate({ to: "/markets/$code", params: { code: r.key } })}
          exportName="paid-media-by-country"
          pageSize={8}
          initialSort={{ key: "spend", dir: "desc" }}
          toolbar={<span className="text-sm font-semibold">Country breakdown</span>}
          columns={[
            { key: "country", header: "Country", value: (r) => country(r.key)?.name, cell: (r) => <span>{country(r.key)?.flag} {country(r.key)?.name}</span> },
            { key: "spend", header: "Spend", align: "right", cell: (r) => fmtUsd(r.spend, true) },
            { key: "clicks", header: "Clicks", align: "right", cell: (r) => fmtCompact(r.clicks) },
            { key: "cpc", header: "CPC", align: "right", cell: (r) => fmtUsd(r.cpc) },
            { key: "leads", header: "Leads", align: "right", cell: (r) => fmtNum(r.leads) },
            { key: "cpl", header: "CPL", align: "right", cell: (r) => fmtUsd(r.cpl) },
          ]}
        />
        <DataTable
          rows={campaignRows}
          rowKey={(r) => r.key}
          onRowClick={(r) => navigate({ to: "/campaigns/$id", params: { id: r.key } })}
          exportName="paid-media-by-campaign"
          pageSize={8}
          initialSort={{ key: "spend", dir: "desc" }}
          toolbar={<span className="text-sm font-semibold">Campaign breakdown</span>}
          columns={[
            { key: "name", header: "Campaign", value: (r) => r.c?.name, cell: (r) => <div className="max-w-64 truncate font-medium">{r.c?.name}</div> },
            { key: "status", header: "Status", value: (r) => r.c?.status, cell: (r) => <StatusBadge value={r.c?.status} /> },
            { key: "spend", header: "Spend", align: "right", cell: (r) => fmtUsd(r.spend, true) },
            { key: "ctr", header: "CTR", align: "right", cell: (r) => fmtPct(r.ctr, 2) },
            { key: "cpl", header: "CPL", align: "right", cell: (r) => fmtUsd(r.cpl) },
            { key: "roas", header: "ROAS", align: "right", cell: (r) => `${r.roas.toFixed(1)}×` },
          ]}
        />
      </div>
      <DemoNote />
    </>
  );
}
