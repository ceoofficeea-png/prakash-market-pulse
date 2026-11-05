import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Download, FileBarChart, Play, Printer } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";

import { BarsChart, ChartCard, TrendChart } from "@/components/app/charts";
import { DataTable } from "@/components/app/data-table";
import { KpiCard } from "@/components/app/kpi-card";
import { DemoNote, KpiGrid, PageHeader } from "@/components/app/page";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { totals, useCompetitors, useCurrentUser, useInsights, useLeads, useLookups, useMetrics, useReports, useWeb } from "@/lib/api";
import { inRange, useFilters } from "@/lib/filters";
import { downloadCsv, fmtCompact, fmtDate, fmtDateTime, fmtNum, fmtPct, fmtUsd, pctChange, safeDiv } from "@/lib/format";
import { can } from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{"title": "CEO Dashboard & Reports \u2014 Prakash Pump"}, {"name": "description", "content": "CEO Dashboard & Reports analytics and records for the Prakash Pump marketing team."}, {"property": "og:title", "content": "CEO Dashboard & Reports \u2014 Prakash Pump"}, {"property": "og:description", "content": "CEO Dashboard & Reports analytics and records for the Prakash Pump marketing team."}, {"property": "og:type", "content": "website"}, {"name": "twitter:card", "content": "summary_large_image"}] }),
  component: ReportsPage,
});

function ReportsPage() {
  const f = useFilters();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const me = useCurrentUser();
  const { country, member } = useLookups();
  const monthly = useMetrics("month");
  const cur = useMetrics("all");
  const prev = useMetrics("all", { from: f.prevFrom, to: f.prevTo });
  const byRegion = useMetrics("region");
  const web = useWeb("all");
  const previousWeb = useWeb("all", { from: f.prevFrom, to: f.prevTo });
  const leads = useLeads();
  const comps = useCompetitors();
  const insights = useInsights();
  const reports = useReports();

  const c = totals(cur.data);
  const p = totals(prev.data);
  const sessions = Number(web.data?.[0]?.sessions ?? 0);

  const crm = useMemo(() => {
    const inR = (leads.data ?? []).filter((l) => inRange(l.created_at, f.from, f.to) && (!f.countries.length || f.countries.includes(l.country_code)));
    const won = inR.filter((l) => l.stage === "Won");
    const lost = inR.filter((l) => l.stage === "Lost");
    return {
      total: inR.length,
      pipeline: inR.filter((l) => !["Won", "Lost"].includes(l.stage)).reduce((a, l) => a + Number(l.deal_value), 0),
      won: won.reduce((a, l) => a + Number(l.deal_value), 0),
      winRate: safeDiv(won.length, won.length + lost.length),
      byCountry: Object.entries(inR.reduce<Record<string, number>>((a, l) => ({ ...a, [l.country_code]: (a[l.country_code] ?? 0) + (l.stage === "Won" ? Number(l.deal_value) : 0) }), {})).sort((a, b) => b[1] - a[1]),
    };
  }, [leads.data, f.from, f.to, f.countries]);

  const previousLeads = (leads.data ?? []).filter((l) => inRange(l.created_at, f.prevFrom, f.prevTo) && (!f.countries.length || f.countries.includes(l.country_code)));
  const previousPipeline = previousLeads.filter((l) => !["Won", "Lost"].includes(l.stage)).reduce((n, l) => n + Number(l.deal_value), 0);
  const previousWon = previousLeads.filter((l) => l.stage === "Won").reduce((n, l) => n + Number(l.deal_value), 0);
  const self = comps.data?.find((x) => x.is_self);
  const risks = (insights.data ?? []).filter((i) => ["Critical", "High"].includes(i.severity) && i.status !== "Dismissed").slice(0, 4);

  const run = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("reports").update({ last_generated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Report generated");
      qc.invalidateQueries({ queryKey: ["reports"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const exportSummary = () =>
    downloadCsv(`ceo-summary-${f.from}-to-${f.to}.csv`, [
      { metric: "Media spend (USD)", current: c.spend.toFixed(0), previous: p.spend.toFixed(0) },
      { metric: "Paid leads", current: c.leads, previous: p.leads },
      { metric: "Cost per lead (USD)", current: safeDiv(c.spend, c.leads).toFixed(2), previous: safeDiv(p.spend, p.leads).toFixed(2) },
      { metric: "Attributed revenue (USD)", current: c.revenue.toFixed(0), previous: p.revenue.toFixed(0) },
      { metric: "ROAS", current: safeDiv(c.revenue, c.spend).toFixed(2), previous: safeDiv(p.revenue, p.spend).toFixed(2) },
      { metric: "CRM leads", current: crm.total, previous: "" },
      { metric: "Open pipeline (USD)", current: crm.pipeline.toFixed(0), previous: "" },
      { metric: "Won value (USD)", current: crm.won.toFixed(0), previous: "" },
      { metric: "Web sessions", current: sessions, previous: "" },
    ]);

  return (
    <>
      <PageHeader
        eyebrow="12 · CEO Dashboard & Reports"
        title="CEO dashboard"
        description={`Board-level marketing summary · ${fmtDate(f.from)} – ${fmtDate(f.to)}`}
        filters={["date", "country"]}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={exportSummary}><Download /> Export summary</Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}><Printer /> Print</Button>
          </>
        }
      />

      <KpiGrid cols={4}>
        <KpiCard label="Marketing-sourced revenue" value={fmtUsd(c.revenue, true)} delta={pctChange(c.revenue, p.revenue)} />
        <KpiCard label="Marketing investment" value={fmtUsd(c.spend, true)} delta={pctChange(c.spend, p.spend)} />
        <KpiCard label="Return on ad spend" value={`${safeDiv(c.revenue, c.spend).toFixed(1)}×`} delta={pctChange(safeDiv(c.revenue, c.spend), safeDiv(p.revenue, p.spend))} />
        <KpiCard label="Open pipeline" value={fmtUsd(crm.pipeline, true)} delta={pctChange(crm.pipeline, previousPipeline)} hint={`${fmtNum(crm.total)} CRM leads`} />
      </KpiGrid>
      <KpiGrid cols={4}>
        <KpiCard label="Won deals value" value={fmtUsd(crm.won, true)} delta={pctChange(crm.won, previousWon)} hint={`win rate ${fmtPct(crm.winRate)}`} />
        <KpiCard label="Paid leads" value={fmtNum(c.leads)} delta={pctChange(c.leads, p.leads)} />
        <KpiCard label="Website sessions" value={fmtCompact(sessions)} delta={pctChange(sessions, Number(previousWeb.data?.[0]?.sessions ?? 0))} />
        <KpiCard label="Global market share" value={`${self?.market_share ?? 0}%`} hint="estimate" />
      </KpiGrid>

      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard title="Monthly investment & return" className="xl:col-span-2">
          <TrendChart previousData={[{ spend: p.spend, revenue: p.revenue }]} data={(monthly.data ?? []).map((r) => ({ key: r.key, spend: Number(r.spend), revenue: Number(r.revenue) }))} series={[{ key: "spend", label: "Spend" }, { key: "revenue", label: "Revenue", color: "var(--chart-3)" }]} fmt={(v) => fmtUsd(v, true)} height={260} />
        </ChartCard>
        <ChartCard title="Revenue by region">
          <BarsChart data={(byRegion.data ?? []).map((r) => ({ key: r.key, revenue: Math.round(Number(r.revenue)) }))} series={[{ key: "revenue", label: "Revenue" }]} horizontal colorByIndex fmt={(v) => fmtUsd(v, true)} height={260} />
        </ChartCard>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <ChartCard title="Top markets by won value">
          <ul className="divide-y divide-border/60 text-sm">
            {crm.byCountry.slice(0, 6).map(([code, v]) => (
              <li key={code}>
                <button type="button" onClick={() => navigate({ to: "/markets/$code", params: { code } })} className="flex w-full justify-between py-2 hover:text-primary">
                  <span>{country(code)?.flag} {country(code)?.name}</span>
                  <span className="num">{fmtUsd(v, true)}</span>
                </button>
              </li>
            ))}
          </ul>
        </ChartCard>
        <ChartCard title="Key risks & opportunities" subtitle="From AI Intelligence">
          <ul className="space-y-2 text-sm">
            {risks.map((r) => (
              <li key={r.id} className="flex items-start gap-2">
                <StatusBadge value={r.severity} />
                <span>{r.title}{r.impact_estimate && <span className="text-xs text-success"> · {r.impact_estimate}</span>}</span>
              </li>
            ))}
          </ul>
        </ChartCard>
      </div>

      <h2 className="mb-2 mt-6 flex items-center gap-2 text-sm font-semibold"><FileBarChart className="size-4 text-primary" /> Scheduled reports</h2>
      <DataTable
        rows={reports.data ?? []}
        rowKey={(r) => r.id}
        searchKeys={[(r) => r.name, (r) => r.report_type]}
        exportName="report-schedule"
        columns={[
          { key: "name", header: "Report", cell: (r) => <div><div className="font-medium">{r.name}</div><div className="max-w-md truncate text-xs text-muted-foreground">{r.description}</div></div> },
          { key: "report_type", header: "Type", cell: (r) => <span className="text-xs">{r.report_type}</span> },
          { key: "frequency", header: "Frequency", cell: (r) => <span className="text-xs">{r.frequency} · {r.format}</span> },
          { key: "owner", header: "Owner", value: (r) => member(r.owner_id)?.name, cell: (r) => <span className="text-xs">{member(r.owner_id)?.name}</span> },
          { key: "recipients", header: "Recipients", value: (r) => r.recipients.join(", "), cell: (r) => <span className="text-xs text-muted-foreground">{r.recipients.length} recipient{r.recipients.length === 1 ? "" : "s"}</span> },
          { key: "last_generated_at", header: "Last run", cell: (r) => <span className="num text-xs">{fmtDateTime(r.last_generated_at)}</span> },
          { key: "status", header: "Status", cell: (r) => <StatusBadge value={r.status === "Active" ? "Active" : "Paused"} /> },
          {
            key: "run",
            header: "",
            sortable: false,
            cell: (r) =>
              can(me.data?.roles ?? [], "reports.edit") ? (
                <Button size="sm" variant="outline" onClick={() => run.mutate(r.id)}><Play /> Run now</Button>
              ) : null,
          },
        ]}
      />
      <DemoNote />
    </>
  );
}
