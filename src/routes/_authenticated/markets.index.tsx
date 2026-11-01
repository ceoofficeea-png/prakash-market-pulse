import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { BarsChart, ChartCard } from "@/components/app/charts";
import { DataTable } from "@/components/app/data-table";
import { KpiCard } from "@/components/app/kpi-card";
import { DemoNote, KpiGrid, PageHeader } from "@/components/app/page";
import { StatusBadge } from "@/components/app/status-badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCountries, useLeads, useMetrics, useWeb } from "@/lib/api";
import { inRange, useFilters } from "@/lib/filters";
import { fmtCompact, fmtNum, fmtPct, fmtUsd, safeDiv } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/markets/")({
  head: () => ({ meta: [{ title: "Geography & Market Intelligence — Prakash Pump" }] }),
  component: MarketsPage,
});

type Lens = "leads" | "spend" | "share" | "growth";

function MarketsPage() {
  const f = useFilters();
  const navigate = useNavigate();
  const countries = useCountries();
  const metrics = useMetrics("country", { countries: [] });
  const web = useWeb("country", { countries: [] });
  const leads = useLeads();
  const [lens, setLens] = useState<Lens>("leads");

  const rows = useMemo(() => {
    const m = new Map((metrics.data ?? []).map((r) => [r.key, r]));
    const w = new Map((web.data ?? []).map((r) => [r.key, r]));
    return (countries.data ?? [])
      .filter((c) => !f.countries.length || f.countries.includes(c.code))
      .map((c) => {
        const mm = m.get(c.code);
        const crm = (leads.data ?? []).filter((l) => l.country_code === c.code && inRange(l.created_at, f.from, f.to));
        return {
          ...c,
          spend: Number(mm?.spend ?? 0),
          leads: Number(mm?.leads ?? 0),
          revenue: Number(mm?.revenue ?? 0),
          sessions: Number(w.get(c.code)?.sessions ?? 0),
          crmLeads: crm.length,
          pipeline: crm.filter((l) => !["Won", "Lost"].includes(l.stage)).reduce((a, l) => a + Number(l.deal_value), 0),
          won: crm.filter((l) => l.stage === "Won").reduce((a, l) => a + Number(l.deal_value), 0),
        };
      });
  }, [countries.data, metrics.data, web.data, leads.data, f.countries, f.from, f.to]);

  const regions = Array.from(new Set(rows.map((r) => r.region)));
  const lensVal = (r: (typeof rows)[number]) =>
    lens === "leads" ? r.leads : lens === "spend" ? r.spend : lens === "share" ? Number(r.market_share) : Number(r.growth_rate);
  const max = Math.max(1, ...rows.map(lensVal));
  const fmtLens = (v: number) => (lens === "spend" ? fmtUsd(v, true) : lens === "leads" ? fmtNum(v) : `${v.toFixed(1)}%`);

  const tam = rows.reduce((a, r) => a + Number(r.market_size_musd), 0);
  const weightedShare = safeDiv(rows.reduce((a, r) => a + Number(r.market_size_musd) * Number(r.market_share), 0), tam);

  return (
    <>
      <PageHeader
        eyebrow="08 · Geography & Market Intelligence"
        title="Markets"
        description="Country-wise demand, investment and opportunity across 14 markets and 6 regions."
        filters={["date", "country"]}
      />

      <KpiGrid cols={5}>
        <KpiCard label="Markets" value={String(rows.length)} hint={`${regions.length} regions`} />
        <KpiCard label="Addressable market" value={`$${fmtCompact(tam * 1e6)}`} />
        <KpiCard label="Weighted share" value={`${weightedShare.toFixed(1)}%`} />
        <KpiCard label="Distributors" value={fmtNum(rows.reduce((a, r) => a + r.distributors, 0))} />
        <KpiCard label="Open pipeline" value={fmtUsd(rows.reduce((a, r) => a + r.pipeline, 0), true)} />
      </KpiGrid>

      <ChartCard
        title="Market heatmap"
        subtitle="Tile intensity reflects the selected lens · click a market to drill in"
        actions={
          <Tabs value={lens} onValueChange={(v) => setLens(v as Lens)}>
            <TabsList className="h-8">
              <TabsTrigger value="leads" className="text-xs">Leads</TabsTrigger>
              <TabsTrigger value="spend" className="text-xs">Spend</TabsTrigger>
              <TabsTrigger value="share" className="text-xs">Share</TabsTrigger>
              <TabsTrigger value="growth" className="text-xs">Growth</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {regions.map((region) => (
            <div key={region}>
              <div className="eyebrow mb-2">{region}</div>
              <div className="grid grid-cols-2 gap-2">
                {rows
                  .filter((r) => r.region === region)
                  .map((r) => {
                    const v = lensVal(r);
                    const intensity = 0.08 + (v / max) * 0.62;
                    return (
                      <button
                        key={r.code}
                        type="button"
                        onClick={() => navigate({ to: "/markets/$code", params: { code: r.code } })}
                        className="relative overflow-hidden rounded-lg border border-border p-3 text-left transition-colors hover:border-primary"
                      >
                        <span className="absolute inset-0 bg-primary" style={{ opacity: intensity }} />
                        <span className="relative block">
                          <span className="flex items-center justify-between">
                            <span className="text-lg">{r.flag}</span>
                            <StatusBadge value={r.priority} />
                          </span>
                          <span className="mt-1 block text-sm font-medium text-foreground">{r.name}</span>
                          <span className="num block text-lg font-semibold text-foreground">{fmtLens(v)}</span>
                        </span>
                      </button>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>
      </ChartCard>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <ChartCard title="Opportunity matrix" subtitle="Market growth vs Prakash share — bubble = market size">
          <div className="relative h-72 rounded-lg border border-border bg-surface-2/30">
            <span className="eyebrow absolute bottom-1 right-2">Share →</span>
            <span className="eyebrow absolute left-2 top-1">↑ Growth</span>
            <span className="absolute inset-y-0 left-1/2 w-px bg-border" />
            <span className="absolute inset-x-0 top-1/2 h-px bg-border" />
            <span className="eyebrow absolute left-2 top-1/2 mt-1 text-success">Invest</span>
            <span className="eyebrow absolute right-2 top-6 text-primary">Defend & grow</span>
            {rows.map((r) => {
              const x = (Number(r.market_share) / 20) * 100;
              const y = 100 - ((Number(r.growth_rate) - 2) / 9) * 100;
              const size = 14 + Math.sqrt(Number(r.market_size_musd)) / 3;
              return (
                <button
                  key={r.code}
                  type="button"
                  title={`${r.name}: ${r.growth_rate}% growth · ${r.market_share}% share · $${r.market_size_musd}M`}
                  onClick={() => navigate({ to: "/markets/$code", params: { code: r.code } })}
                  className={cn("absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border text-[10px] font-semibold", r.priority === "Core" ? "border-primary bg-primary/30" : "border-info bg-info/25")}
                  style={{ left: `${Math.min(95, Math.max(5, x))}%`, top: `${Math.min(92, Math.max(8, y))}%`, width: size, height: size }}
                >
                  {r.code}
                </button>
              );
            })}
          </div>
        </ChartCard>
        <ChartCard title="Investment vs return" subtitle="Spend and attributed revenue by market">
          <BarsChart
            data={[...rows].sort((a, b) => b.spend - a.spend).map((r) => ({ key: r.code, spend: Math.round(r.spend), revenue: Math.round(r.revenue) }))}
            series={[{ key: "spend", label: "Spend" }, { key: "revenue", label: "Revenue", color: "var(--chart-3)" }]}
            fmt={(v) => fmtUsd(v, true)}
            height={288}
            onBarClick={(row) => navigate({ to: "/markets/$code", params: { code: String(row["key"]) } })}
          />
        </ChartCard>
      </div>

      <div className="mt-4">
        <DataTable
          rows={rows}
          rowKey={(r) => r.code}
          onRowClick={(r) => navigate({ to: "/markets/$code", params: { code: r.code } })}
          searchKeys={[(r) => r.name, (r) => r.region]}
          exportName="markets"
          initialSort={{ key: "leads", dir: "desc" }}
          columns={[
            { key: "name", header: "Market", cell: (r) => <div><div className="font-medium">{r.flag} {r.name}</div><div className="text-xs text-muted-foreground">{r.region}</div></div> },
            { key: "priority", header: "Tier", cell: (r) => <StatusBadge value={r.priority} /> },
            { key: "market_size_musd", header: "Market size", align: "right", value: (r) => Number(r.market_size_musd), cell: (r) => `$${fmtNum(Number(r.market_size_musd))}M` },
            { key: "growth_rate", header: "Growth", align: "right", value: (r) => Number(r.growth_rate), cell: (r) => `${r.growth_rate}%` },
            { key: "market_share", header: "Our share", align: "right", value: (r) => Number(r.market_share), cell: (r) => `${r.market_share}%` },
            { key: "spend", header: "Spend", align: "right", cell: (r) => fmtUsd(r.spend, true) },
            { key: "leads", header: "Paid leads", align: "right", cell: (r) => fmtNum(r.leads) },
            { key: "cpl", header: "CPL", align: "right", value: (r) => safeDiv(r.spend, r.leads), cell: (r) => fmtUsd(safeDiv(r.spend, r.leads)) },
            { key: "sessions", header: "Sessions", align: "right", cell: (r) => fmtCompact(r.sessions) },
            { key: "pipeline", header: "Pipeline", align: "right", cell: (r) => fmtUsd(r.pipeline, true) },
            { key: "conv", header: "Web CVR", align: "right", value: (r) => safeDiv(r.leads, r.sessions), cell: (r) => fmtPct(safeDiv(r.crmLeads, r.sessions), 2) },
          ]}
        />
      </div>
      <DemoNote />
    </>
  );
}
