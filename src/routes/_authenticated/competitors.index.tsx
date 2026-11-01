import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { BarsChart, ChartCard, LinesChart } from "@/components/app/charts";
import { DataTable } from "@/components/app/data-table";
import { KpiCard } from "@/components/app/kpi-card";
import { DemoNote, KpiGrid, PageHeader } from "@/components/app/page";
import { StatusBadge } from "@/components/app/status-badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCompetitorActivities, useCompetitorMonthly, useCompetitors, useLookups } from "@/lib/api";
import { useFilters } from "@/lib/filters";
import { CHART_COLORS, fmtCompact, fmtDate, fmtUsd } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/competitors/")({
  head: () => ({ meta: [{ title: "Competitor Intelligence — Prakash Pump" }] }),
  component: CompetitorsPage,
});

const monthLabel = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { month: "short", year: "2-digit" });

function CompetitorsPage() {
  const f = useFilters();
  const navigate = useNavigate();
  const comps = useCompetitors();
  const monthly = useCompetitorMonthly();
  const acts = useCompetitorActivities();
  const { country } = useLookups();
  const [type, setType] = useState("all");

  const list = comps.data ?? [];
  const self = list.find((c) => c.is_self);
  const months = Array.from(new Set((monthly.data ?? []).map((m) => m.month))).sort();
  const latest = months[months.length - 1];

  const sov = useMemo(
    () =>
      months.map((m) => {
        const row: Record<string, string | number> = { key: monthLabel(m) };
        for (const c of list) row[`c${c.id}`] = Number((monthly.data ?? []).find((x) => x.month === m && x.competitor_id === c.id)?.share_of_voice ?? 0);
        return row;
      }),
    [months, list, monthly.data],
  );

  const latestRows = list.map((c) => {
    const m = (monthly.data ?? []).find((x) => x.month === latest && x.competitor_id === c.id);
    return { ...c, sov: Number(m?.share_of_voice ?? 0), spend: Number(m?.est_ad_spend ?? 0), followers: m?.social_followers ?? 0, visits: m?.web_visits ?? 0, price: Number(m?.price_index ?? 100) };
  });

  const activities = (acts.data ?? []).filter(
    (a) => (!f.countries.length || (a.country_code && f.countries.includes(a.country_code))) && (type === "all" || a.activity_type === type) && a.date >= f.from && a.date <= f.to,
  );
  const types = Array.from(new Set((acts.data ?? []).map((a) => a.activity_type))).sort();
  const name = (id: number) => list.find((c) => c.id === id)?.name ?? "";

  return (
    <>
      <PageHeader
        eyebrow="09 · Competitor Intelligence"
        title="Competitive landscape"
        description="Share of voice, pricing, investment and market moves of the competitors we track. Figures are estimates."
        filters={["date", "country"]}
      />

      <KpiGrid cols={5}>
        <KpiCard label="Tracked competitors" value={String(list.filter((c) => !c.is_self).length)} />
        <KpiCard label="Our market share" value={`${self?.market_share ?? 0}%`} />
        <KpiCard label="Our share of voice" value={`${latestRows.find((r) => r.is_self)?.sov.toFixed(1) ?? 0}%`} />
        <KpiCard label="High-threat players" value={String(list.filter((c) => c.threat_level === "High").length)} />
        <KpiCard label="Moves in period" value={String(activities.length)} />
      </KpiGrid>

      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard title="Share of voice trend" subtitle="Monthly, estimated" className="xl:col-span-2">
          <LinesChart data={sov} series={list.map((c, i) => ({ key: `c${c.id}`, label: c.name, color: c.is_self ? "var(--chart-1)" : CHART_COLORS[(i % 5) + 1] }))} fmt={(v) => `${v}%`} height={280} />
        </ChartCard>
        <ChartCard title="Price index" subtitle="100 = Prakash Pump list price">
          <BarsChart
            data={[...latestRows].sort((a, b) => b.price - a.price).map((r) => ({ key: r.name, price: r.price, id: r.id }))}
            series={[{ key: "price", label: "Price index" }]}
            horizontal
            height={280}
            fmt={(v) => String(v)}
            onBarClick={(row) => navigate({ to: "/competitors/$id", params: { id: String(row["id"]) } })}
          />
        </ChartCard>
      </div>

      <div className="mt-4">
        <DataTable
          rows={latestRows}
          rowKey={(r) => r.id}
          onRowClick={(r) => navigate({ to: "/competitors/$id", params: { id: String(r.id) } })}
          exportName="competitors"
          initialSort={{ key: "market_share", dir: "desc" }}
          toolbar={<span className="text-sm font-semibold">Benchmark · {latest ? monthLabel(latest) : ""}</span>}
          columns={[
            { key: "name", header: "Company", cell: (r) => <div><div className="font-medium">{r.name} {r.is_self && <span className="eyebrow ml-1 text-primary">You</span>}</div><div className="text-xs text-muted-foreground">{r.hq_country} · {r.website}</div></div> },
            { key: "threat_level", header: "Threat", cell: (r) => (r.is_self ? "—" : <StatusBadge value={r.threat_level} />) },
            { key: "market_share", header: "Share", align: "right", value: (r) => Number(r.market_share), cell: (r) => `${r.market_share}%` },
            { key: "sov", header: "SoV", align: "right", cell: (r) => `${r.sov.toFixed(1)}%` },
            { key: "spend", header: "Est. ad spend", align: "right", cell: (r) => fmtUsd(r.spend, true) },
            { key: "followers", header: "Social", align: "right", cell: (r) => fmtCompact(r.followers) },
            { key: "visits", header: "Web visits", align: "right", cell: (r) => fmtCompact(r.visits) },
            { key: "price", header: "Price idx", align: "right" },
            { key: "focus", header: "Focus", value: (r) => r.focus_segments.join(", "), cell: (r) => <span className="text-xs text-muted-foreground">{r.focus_segments.join(", ")}</span> },
          ]}
        />
      </div>

      <div className="mb-2 mt-6 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Market moves</h2>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All activity types</SelectItem>
            {types.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <DataTable
        rows={activities}
        rowKey={(r) => r.id}
        onRowClick={(r) => navigate({ to: "/competitors/$id", params: { id: String(r.competitor_id) } })}
        searchKeys={[(r) => r.title, (r) => name(r.competitor_id)]}
        exportName="competitor-activity"
        pageSize={10}
        initialSort={{ key: "date", dir: "desc" }}
        columns={[
          { key: "date", header: "Date", cell: (r) => <span className="num text-xs">{fmtDate(r.date)}</span> },
          { key: "competitor", header: "Competitor", value: (r) => name(r.competitor_id), cell: (r) => <span className="font-medium">{name(r.competitor_id)}</span> },
          { key: "activity_type", header: "Type", cell: (r) => <span className="text-xs">{r.activity_type}</span> },
          { key: "title", header: "Activity" },
          { key: "country_code", header: "Market", value: (r) => country(r.country_code)?.name, cell: (r) => <>{country(r.country_code)?.flag} {country(r.country_code)?.name}</> },
          { key: "impact", header: "Impact", cell: (r) => <StatusBadge value={r.impact} /> },
        ]}
      />
      <DemoNote />
    </>
  );
}
