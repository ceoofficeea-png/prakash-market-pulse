import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Bot, CircleDollarSign, Globe2, MousePointerClick, Target, TrendingUp, Users } from "lucide-react";
import { useMemo } from "react";

import { BarList, ChartCard, DonutChart, TrendChart } from "@/components/app/charts";
import { DataTable } from "@/components/app/data-table";
import { KpiCard } from "@/components/app/kpi-card";
import { DemoNote, KpiGrid, PageHeader } from "@/components/app/page";
import { StatusBadge } from "@/components/app/status-badge";
import { totals, useInsights, useLeads, useLookups, useMetrics, useWeb } from "@/lib/api";
import { inRange, useFilters } from "@/lib/filters";
import { fmtCompact, fmtNum, fmtPct, fmtUsd, LEAD_STAGES, pctChange, platformColor, platformLabel, safeDiv } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/overview")({
  head: () => ({ meta: [{ title: "Executive Overview — Prakash Pump" }] }),
  component: Overview,
});

export const grainFor = (days: number) => (days > 92 ? "week" : "date");

function Overview() {
  const f = useFilters();
  const navigate = useNavigate();
  const { country, campaign } = useLookups();
  const grain = grainFor(f.days);

  const trend = useMetrics(grain);
  const prev = useMetrics("all", { from: f.prevFrom, to: f.prevTo });
  const byPlatform = useMetrics("platform");
  const byCountry = useMetrics("country");
  const byCampaign = useMetrics("campaign");
  const web = useWeb("all");
  const webPrev = useWeb("all", { from: f.prevFrom, to: f.prevTo });
  const leads = useLeads();
  const insights = useInsights();

  const cur = totals(trend.data);
  const pre = totals(prev.data);
  const sessions = Number(web.data?.[0]?.sessions ?? 0);
  const sessionsPrev = Number(webPrev.data?.[0]?.sessions ?? 0);

  const crm = useMemo(() => {
    const rows = (leads.data ?? []).filter(
      (l) => inRange(l.created_at, f.from, f.to) && (!f.countries.length || f.countries.includes(l.country_code)) && (!f.campaigns.length || (l.campaign_id != null && f.campaigns.includes(l.campaign_id))),
    );
    const open = rows.filter((l) => !["Won", "Lost"].includes(l.stage));
    const won = rows.filter((l) => l.stage === "Won");
    const byStage = LEAD_STAGES.map((s) => ({ key: s, count: rows.filter((l) => l.stage === s).length, value: rows.filter((l) => l.stage === s).reduce((a, l) => a + Number(l.deal_value), 0) }));
    return {
      pipeline: open.reduce((a, l) => a + Number(l.deal_value), 0),
      wonValue: won.reduce((a, l) => a + Number(l.deal_value), 0),
      count: rows.length,
      won: won.length,
      byStage,
    };
  }, [leads.data, f.from, f.to, f.countries, f.campaigns]);

  const series = (trend.data ?? []).map((r) => ({ key: r.key, spend: Number(r.spend), leads: Number(r.leads), revenue: Number(r.revenue) }));
  const spark = (k: "spend" | "leads" | "revenue") => series.map((s) => s[k]);

  const funnel = [
    { label: "Impressions", value: cur.impressions },
    { label: "Clicks", value: cur.clicks },
    { label: "Conversions", value: cur.conversions },
    { label: "Paid leads", value: cur.leads },
    { label: "CRM leads", value: crm.count },
    { label: "Won deals", value: crm.won },
  ];

  const campaignRows = (byCampaign.data ?? [])
    .map((r) => ({ ...r, c: campaign(Number(r.key)) }))
    .filter((r) => r.c)
    .sort((a, b) => Number(b.leads) - Number(a.leads));

  return (
    <>
      <PageHeader
        eyebrow="01 · Executive Overview"
        title="Marketing performance at a glance"
        description="Cross-channel spend, demand and pipeline for all Prakash Pump markets."
        filters={["date", "country", "platform", "campaign"]}
      />

      <KpiGrid cols={6}>
        <KpiCard label="Media spend" value={fmtUsd(cur.spend, true)} delta={pctChange(cur.spend, pre.spend)} icon={CircleDollarSign} spark={spark("spend")} hint="vs prev." onClick={() => navigate({ to: "/ads" })} />
        <KpiCard label="Paid leads" value={fmtNum(cur.leads)} delta={pctChange(cur.leads, pre.leads)} icon={Target} spark={spark("leads")} color="var(--chart-2)" onClick={() => navigate({ to: "/crm" })} />
        <KpiCard label="Cost per lead" value={fmtUsd(safeDiv(cur.spend, cur.leads))} delta={pctChange(safeDiv(cur.spend, cur.leads), safeDiv(pre.spend, pre.leads))} invert icon={TrendingUp} />
        <KpiCard label="Attributed revenue" value={fmtUsd(cur.revenue, true)} delta={pctChange(cur.revenue, pre.revenue)} icon={CircleDollarSign} spark={spark("revenue")} color="var(--chart-3)" />
        <KpiCard label="ROAS" value={`${safeDiv(cur.revenue, cur.spend).toFixed(1)}×`} delta={pctChange(safeDiv(cur.revenue, cur.spend), safeDiv(pre.revenue, pre.spend))} icon={MousePointerClick} />
        <KpiCard label="Web sessions" value={fmtCompact(sessions)} delta={pctChange(sessions, sessionsPrev)} icon={Globe2} onClick={() => navigate({ to: "/web" })} />
      </KpiGrid>

      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard title="Spend vs leads" subtitle={`${grain === "week" ? "Weekly" : "Daily"} · paid media`} className="xl:col-span-2">
          <TrendChart
            data={series}
            series={[
              { key: "spend", label: "Spend", color: "var(--chart-1)" },
              { key: "leads", label: "Leads", color: "var(--chart-2)", axis: "right" },
            ]}
            fmt={(v) => fmtUsd(v, true)}
            height={280}
          />
        </ChartCard>
        <ChartCard title="Spend by platform" subtitle="Click a platform to open Ads">
          <DonutChart
            data={(byPlatform.data ?? []).map((r) => ({ name: platformLabel(r.key), id: r.key, value: Number(r.spend), color: platformColor(r.key) }))}
            fmt={(v) => fmtUsd(v, true)}
            height={190}
            onSliceClick={(d) => {
              if (d.id) f.setPlatforms([d.id]);
              navigate({ to: "/ads" });
            }}
          />
        </ChartCard>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <ChartCard title="Top markets by leads" subtitle="Click to drill into a market">
          <BarList
            items={(byCountry.data ?? [])
              .sort((a, b) => Number(b.leads) - Number(a.leads))
              .slice(0, 8)
              .map((r) => ({ id: r.key, label: <>{country(r.key)?.flag} {country(r.key)?.name ?? r.key}</>, value: Number(r.leads), sub: fmtUsd(Number(r.spend), true) }))}
            fmt={fmtNum}
            onSelect={(code) => navigate({ to: "/markets/$code", params: { code } })}
          />
        </ChartCard>

        <ChartCard title="Demand funnel" subtitle="Paid media → CRM">
          <div className="space-y-2.5 pt-1">
            {funnel.map((s, i) => {
              const w = Math.max(6, (Math.log10(Math.max(1, s.value)) / Math.log10(Math.max(10, funnel[0].value))) * 100);
              const conv = i > 0 ? safeDiv(s.value, funnel[i - 1].value) : null;
              return (
                <div key={s.label}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-muted-foreground">{s.label}</span>
                    <span className="num">
                      {fmtCompact(s.value)} {conv != null && <span className="text-muted-foreground">· {fmtPct(conv)}</span>}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-surface-2">
                    <div className="bg-signal h-2 rounded-full" style={{ width: `${w}%`, opacity: 1 - i * 0.1 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </ChartCard>

        <ChartCard
          title="CRM pipeline"
          subtitle={`${fmtUsd(crm.pipeline, true)} open · ${fmtUsd(crm.wonValue, true)} won`}
          actions={
            <Link to="/crm" className="text-xs text-primary hover:underline">
              Open CRM
            </Link>
          }
        >
          <BarList items={crm.byStage.map((s) => ({ id: s.key, label: <StatusBadge value={s.key} />, value: s.value, sub: `${s.count}` }))} fmt={(v) => fmtUsd(v, true)} color="var(--chart-2)" onSelect={() => navigate({ to: "/crm" })} />
        </ChartCard>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <DataTable
            rows={campaignRows}
            rowKey={(r) => r.key}
            onRowClick={(r) => navigate({ to: "/campaigns/$id", params: { id: r.key } })}
            exportName="campaign-leaderboard"
            pageSize={8}
            initialSort={{ key: "leads", dir: "desc" }}
            toolbar={<span className="text-sm font-semibold">Campaign leaderboard</span>}
            columns={[
              { key: "name", header: "Campaign", value: (r) => r.c?.name, cell: (r) => <div><div className="font-medium">{r.c?.name}</div><div className="text-xs text-muted-foreground">{r.c?.code} · {r.c?.objective}</div></div> },
              { key: "status", header: "Status", value: (r) => r.c?.status, cell: (r) => <StatusBadge value={r.c?.status} /> },
              { key: "spend", header: "Spend", align: "right", value: (r) => Number(r.spend), cell: (r) => fmtUsd(Number(r.spend), true) },
              { key: "leads", header: "Leads", align: "right", value: (r) => Number(r.leads), cell: (r) => fmtNum(Number(r.leads)) },
              { key: "cpl", header: "CPL", align: "right", value: (r) => safeDiv(Number(r.spend), Number(r.leads)), cell: (r) => fmtUsd(safeDiv(Number(r.spend), Number(r.leads))) },
              { key: "roas", header: "ROAS", align: "right", value: (r) => safeDiv(Number(r.revenue), Number(r.spend)), cell: (r) => `${safeDiv(Number(r.revenue), Number(r.spend)).toFixed(1)}×` },
            ]}
          />
        </div>
        <ChartCard
          title="AI signals"
          subtitle="Highest-priority recommendations"
          actions={
            <Link to="/ai" className="flex items-center gap-1 text-xs text-primary hover:underline">
              All insights <ArrowRight className="size-3" />
            </Link>
          }
        >
          <ul className="space-y-2">
            {(insights.data ?? [])
              .filter((i) => i.status !== "Dismissed")
              .slice(0, 4)
              .map((i) => (
                <li key={i.id}>
                  <Link to="/ai" className="block rounded-lg border border-border bg-surface-2/50 p-3 hover:border-primary/40">
                    <div className="flex items-center gap-2">
                      <Bot className="size-3.5 text-primary" />
                      <StatusBadge value={i.severity} />
                      <span className="eyebrow">{i.module}</span>
                    </div>
                    <div className="mt-1.5 text-sm font-medium leading-snug">{i.title}</div>
                    {i.impact_estimate && <div className="mt-1 text-xs text-success">{i.impact_estimate}</div>}
                  </Link>
                </li>
              ))}
          </ul>
        </ChartCard>
      </div>

      <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
        <Users className="size-3.5" /> Figures respect the filters above · paid leads are platform-reported, CRM leads are sales-qualified records.
      </div>
      <DemoNote />
    </>
  );
}
