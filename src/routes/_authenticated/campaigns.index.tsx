import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { NewCampaignDialog } from "@/components/app/campaign-form";
import { BarsChart, ChartCard } from "@/components/app/charts";
import { DataTable } from "@/components/app/data-table";
import { KpiCard } from "@/components/app/kpi-card";
import { DemoNote, KpiGrid, PageHeader } from "@/components/app/page";
import { StatusBadge } from "@/components/app/status-badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCurrentUser, useLookups, useMetrics } from "@/lib/api";
import { useFilters } from "@/lib/filters";
import { CAMPAIGN_STATUSES, fmtDate, fmtNum, fmtUsd, platformLabel, safeDiv, toISODate } from "@/lib/format";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/campaigns/")({
  head: () => ({ meta: [{"title": "Campaigns \u2014 Prakash Pump"}, {"name": "description", "content": "Campaigns analytics and records for the Prakash Pump marketing team."}, {"property": "og:title", "content": "Campaigns \u2014 Prakash Pump"}, {"property": "og:description", "content": "Campaigns analytics and records for the Prakash Pump marketing team."}, {"property": "og:type", "content": "website"}, {"name": "twitter:card", "content": "summary_large_image"}] }),
  component: CampaignsPage,
});

const lifetime = () => {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - 179);
  return { from: toISODate(from), to: toISODate(to) };
};

function CampaignsPage() {
  const f = useFilters();
  const navigate = useNavigate();
  const me = useCurrentUser();
  const { campaigns, member, product, country } = useLookups();
  const [status, setStatus] = useState<string>("All");
  const range = lifetime();
  const metrics = useMetrics("campaign", { ...range, ignoreFilters: true });

  const rows = useMemo(() => {
    const byId = new Map((metrics.data ?? []).map((r) => [Number(r.key), r]));
    return campaigns
      .filter((c) => status === "All" || c.status === status)
      .filter((c) => !f.countries.length || c.countries.some((x) => f.countries.includes(x)))
      .filter((c) => !f.platforms.length || c.platforms.some((x) => f.platforms.includes(x)))
      .filter((c) => !f.campaigns.length || f.campaigns.includes(c.id))
      .map((c) => {
        const m = byId.get(c.id);
        const spend = Number(m?.spend ?? 0);
        const leads = Number(m?.leads ?? 0);
        const total = new Date(c.end_date).getTime() - new Date(c.start_date).getTime();
        const elapsed = Math.min(1, Math.max(0, (Date.now() - new Date(c.start_date).getTime()) / Math.max(1, total)));
        return { ...c, spend, leads, revenue: Number(m?.revenue ?? 0), pacing: safeDiv(spend, Number(c.budget)), elapsed };
      });
  }, [campaigns, metrics.data, status, f.countries, f.platforms, f.campaigns]);

  const active = rows.filter((r) => r.status === "Active");
  const budget = rows.reduce((a, r) => a + Number(r.budget), 0);
  const spend = rows.reduce((a, r) => a + r.spend, 0);
  const leads = rows.reduce((a, r) => a + r.leads, 0);

  // Timeline bounds
  const minStart = Math.min(...rows.map((r) => new Date(r.start_date).getTime()), Date.now());
  const maxEnd = Math.max(...rows.map((r) => new Date(r.end_date).getTime()), Date.now());
  const span = Math.max(1, maxEnd - minStart);
  const todayPos = ((Date.now() - minStart) / span) * 100;

  return (
    <>
      <PageHeader
        eyebrow="06 · Campaign Management"
        title="Campaigns"
        description="Plan, pace and evaluate every campaign across markets and platforms. Figures show lifetime performance."
        filters={["country", "platform", "campaign"]}
        actions={can(me.data?.roles ?? [], "campaigns.edit") ? <NewCampaignDialog /> : null}
      />

      <KpiGrid cols={5}>
        <KpiCard label="Active campaigns" value={String(active.length)} hint={`of ${rows.length}`} />
        <KpiCard label="Total budget" value={fmtUsd(budget, true)} />
        <KpiCard label="Spent to date" value={fmtUsd(spend, true)} hint={`${((spend / Math.max(1, budget)) * 100).toFixed(0)}% of budget`} />
        <KpiCard label="Leads generated" value={fmtNum(leads)} />
        <KpiCard label="Blended CPL" value={fmtUsd(safeDiv(spend, leads))} />
      </KpiGrid>

      <Tabs value={status} onValueChange={setStatus} className="mb-3">
        <TabsList>
          {["All", ...CAMPAIGN_STATUSES].map((s) => (
            <TabsTrigger key={s} value={s}>
              {s}
              <span className="num ml-1.5 text-[10px] text-muted-foreground">
                {s === "All" ? campaigns.length : campaigns.filter((c) => c.status === s).length}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <ChartCard title="Campaign timeline" subtitle="Flight dates with today marker · click a bar to open" className="mb-4">
        <div className="relative space-y-1.5">
          <div className="pointer-events-none absolute inset-y-0 z-10 w-px bg-primary" style={{ left: `calc(14rem + (100% - 14rem) * ${todayPos / 100})` }} />
          {rows.map((r) => {
            const left = ((new Date(r.start_date).getTime() - minStart) / span) * 100;
            const width = ((new Date(r.end_date).getTime() - new Date(r.start_date).getTime()) / span) * 100;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => navigate({ to: "/campaigns/$id", params: { id: String(r.id) } })}
                className="group flex w-full items-center gap-2 text-left"
              >
                <span className="w-56 shrink-0 truncate text-xs text-muted-foreground group-hover:text-foreground">{r.name}</span>
                <span className="relative h-5 flex-1 rounded bg-surface-2/60">
                  <span
                    className={cn(
                      "absolute inset-y-0.5 rounded-sm",
                      r.status === "Active" ? "bg-signal" : r.status === "Planned" ? "bg-info/70" : r.status === "Paused" ? "bg-warning/70" : "bg-muted-foreground/40",
                    )}
                    style={{ left: `${left}%`, width: `${Math.max(1, width)}%` }}
                  />
                </span>
              </button>
            );
          })}
        </div>
      </ChartCard>

      <DataTable
        rows={rows}
        rowKey={(r) => r.id}
        onRowClick={(r) => navigate({ to: "/campaigns/$id", params: { id: String(r.id) } })}
        searchKeys={[(r) => r.name, (r) => r.code, (r) => r.objective]}
        searchPlaceholder="Search campaigns…"
        exportName="campaigns"
        initialSort={{ key: "start_date", dir: "desc" }}
        columns={[
          { key: "name", header: "Campaign", cell: (r) => <div><div className="font-medium">{r.name}</div><div className="text-xs text-muted-foreground">{r.code} · {r.objective}</div></div> },
          { key: "status", header: "Status", cell: (r) => <StatusBadge value={r.status} /> },
          { key: "product", header: "Product", value: (r) => product(r.product_id)?.name, cell: (r) => <span className="text-xs">{product(r.product_id)?.name}</span> },
          { key: "countries", header: "Markets", value: (r) => r.countries.join(","), cell: (r) => <span title={r.countries.map((c) => country(c)?.name).join(", ")}>{r.countries.map((c) => country(c)?.flag).join(" ")}</span> },
          { key: "platforms", header: "Platforms", value: (r) => r.platforms.map(platformLabel).join(", "), cell: (r) => <span className="text-xs text-muted-foreground">{r.platforms.map(platformLabel).join(", ")}</span> },
          { key: "owner", header: "Owner", value: (r) => member(r.owner_id)?.name, cell: (r) => <span className="text-xs">{member(r.owner_id)?.name}</span> },
          { key: "start_date", header: "Flight", cell: (r) => <span className="num text-xs">{fmtDate(r.start_date)} → {fmtDate(r.end_date)}</span> },
          { key: "budget", header: "Budget", align: "right", value: (r) => Number(r.budget), cell: (r) => fmtUsd(Number(r.budget), true) },
          {
            key: "pacing",
            header: "Pacing",
            cell: (r) => (
              <div className="w-28">
                <Progress value={Math.min(100, r.pacing * 100)} className="h-1.5" />
                <div className="num mt-1 text-[10px] text-muted-foreground">
                  {(r.pacing * 100).toFixed(0)}% spent · {(r.elapsed * 100).toFixed(0)}% time
                </div>
              </div>
            ),
          },
          { key: "leads", header: "Leads / target", align: "right", cell: (r) => <span>{fmtNum(r.leads)} <span className="text-muted-foreground">/ {fmtNum(r.target_leads)}</span></span> },
        ]}
      />

      <ChartCard title="Budget vs spend" subtitle="Lifetime, by campaign" className="mt-4">
        <BarsChart
          data={rows.map((r) => ({ key: r.code, budget: Number(r.budget), spend: Math.round(r.spend) }))}
          series={[
            { key: "budget", label: "Budget", color: "var(--chart-6)" },
            { key: "spend", label: "Spend", color: "var(--chart-1)" },
          ]}
          fmt={(v) => fmtUsd(v, true)}
          height={260}
        />
      </ChartCard>
      <DemoNote />
    </>
  );
}
