import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { KanbanSquare, Table2 } from "lucide-react";
import { useMemo, useState } from "react";

import { BarList, ChartCard, DonutChart, TrendChart } from "@/components/app/charts";
import { DataTable } from "@/components/app/data-table";
import { KpiCard } from "@/components/app/kpi-card";
import { DemoNote, KpiGrid, PageHeader } from "@/components/app/page";
import { StatusBadge } from "@/components/app/status-badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useLeads, useLookups, type Lead } from "@/lib/api";
import { inRange, useFilters } from "@/lib/filters";
import { fmtDate, fmtNum, fmtPct, fmtUsd, LEAD_STAGES, pctChange, safeDiv } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/crm/")({
  head: () => ({ meta: [{"title": "CRM & Leads \u2014 Prakash Pump"}, {"name": "description", "content": "CRM & Leads analytics and records for the Prakash Pump marketing team."}, {"property": "og:title", "content": "CRM & Leads \u2014 Prakash Pump"}, {"property": "og:description", "content": "CRM & Leads analytics and records for the Prakash Pump marketing team."}, {"property": "og:type", "content": "website"}, {"name": "twitter:card", "content": "summary_large_image"}] }),
  component: CrmPage,
});

function weekKey(iso: string) {
  const d = new Date(iso);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return d.toISOString().slice(0, 10);
}

function CrmPage() {
  const f = useFilters();
  const navigate = useNavigate();
  const leads = useLeads();
  const { country, member, campaign, team } = useLookups();
  const [view, setView] = useState<"table" | "board">("table");
  const [stage, setStage] = useState("all");
  const [owner, setOwner] = useState("all");

  const rows = useMemo(
    () =>
      (leads.data ?? []).filter(
        (l) =>
          inRange(l.created_at, f.from, f.to) &&
          (!f.countries.length || f.countries.includes(l.country_code)) &&
          (!f.campaigns.length || (l.campaign_id != null && f.campaigns.includes(l.campaign_id))) &&
          (stage === "all" || l.stage === stage) &&
          (owner === "all" || String(l.owner_id) === owner),
      ),
    [leads.data, f.from, f.to, f.countries, f.campaigns, stage, owner],
  );

  const previousRows = (leads.data ?? []).filter((l) => inRange(l.created_at, f.prevFrom, f.prevTo) && (!f.countries.length || f.countries.includes(l.country_code)) && (!f.campaigns.length || (l.campaign_id != null && f.campaigns.includes(l.campaign_id))) && (stage === "all" || l.stage === stage) && (owner === "all" || String(l.owner_id) === owner));
  const previousOpen = previousRows.filter((l) => !["Won", "Lost"].includes(l.stage));
  const previousWon = previousRows.filter((l) => l.stage === "Won");
  const previousLost = previousRows.filter((l) => l.stage === "Lost");
  const previousQualified = previousRows.filter((l) => ["Qualified", "Proposal", "Negotiation", "Won"].includes(l.stage));
  const open = rows.filter((l) => !["Won", "Lost"].includes(l.stage));
  const won = rows.filter((l) => l.stage === "Won");
  const lost = rows.filter((l) => l.stage === "Lost");
  const qualified = rows.filter((l) => ["Qualified", "Proposal", "Negotiation", "Won"].includes(l.stage));
  const sum = (ls: Lead[]) => ls.reduce((a, l) => a + Number(l.deal_value), 0);
  const stale = open.filter((l) => l.last_activity_at && Date.now() - new Date(l.last_activity_at).getTime() > 14 * 86400000);

  const bySource = Object.entries(rows.reduce<Record<string, number>>((a, l) => ({ ...a, [l.source]: (a[l.source] ?? 0) + 1 }), {})).sort((a, b) => b[1] - a[1]);
  const byCountry = Object.entries(rows.reduce<Record<string, number>>((a, l) => ({ ...a, [l.country_code]: (a[l.country_code] ?? 0) + Number(l.deal_value) }), {})).sort((a, b) => b[1] - a[1]);
  const byWeek = Object.entries(
    rows.reduce<Record<string, { leads: number; value: number }>>((a, l) => {
      const k = weekKey(l.created_at);
      const cur = a[k] ?? { leads: 0, value: 0 };
      a[k] = { leads: cur.leads + 1, value: cur.value + Number(l.deal_value) };
      return a;
    }, {}),
  )
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, v]) => ({ key, ...v }));

  return (
    <>
      <PageHeader
        eyebrow="07 · Marketing CRM"
        title="Leads & pipeline"
        description="Every enquiry from every channel, scored and tracked to revenue."
        filters={["date", "country", "campaign"]}
        actions={
          <ToggleGroup type="single" value={view} onValueChange={(v) => v && setView(v as "table" | "board")} variant="outline" size="sm">
            <ToggleGroupItem value="table" aria-label="Table view"><Table2 className="size-4" /></ToggleGroupItem>
            <ToggleGroupItem value="board" aria-label="Pipeline view"><KanbanSquare className="size-4" /></ToggleGroupItem>
          </ToggleGroup>
        }
      />

      <KpiGrid cols={6}>
        <KpiCard label="Leads" value={fmtNum(rows.length)} delta={pctChange(rows.length, previousRows.length)} />
        <KpiCard label="Qualified rate" value={fmtPct(safeDiv(qualified.length, rows.length))} delta={pctChange(safeDiv(qualified.length, rows.length), safeDiv(previousQualified.length, previousRows.length))} />
        <KpiCard label="Open pipeline" value={fmtUsd(sum(open), true)} delta={pctChange(sum(open), sum(previousOpen))} hint={`${open.length} deals`} />
        <KpiCard label="Won value" value={fmtUsd(sum(won), true)} delta={pctChange(sum(won), sum(previousWon))} hint={`${won.length} deals`} />
        <KpiCard label="Win rate" value={fmtPct(safeDiv(won.length, won.length + lost.length))} delta={pctChange(safeDiv(won.length, won.length + lost.length), safeDiv(previousWon.length, previousWon.length + previousLost.length))} />
        <KpiCard label="Idle > 14 days" value={fmtNum(stale.length)} hint={fmtUsd(sum(stale), true)} />
      </KpiGrid>

      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard title="New leads per week" subtitle="Count and pipeline value" className="xl:col-span-2">
          <TrendChart previousData={[{ leads: previousRows.length, value: sum(previousRows) }]} data={byWeek} series={[{ key: "leads", label: "Leads", color: "var(--chart-2)" }, { key: "value", label: "Value", axis: "right" }]} rightFmt={(v) => fmtUsd(v, true)} height={240} />
        </ChartCard>
        <ChartCard title="Lead sources">
          <DonutChart data={bySource.map(([name, value]) => ({ name, value }))} height={170} fmt={fmtNum} />
        </ChartCard>
      </div>

      <div className="mb-3 mt-6 flex flex-wrap items-center gap-2">
        <Select value={stage} onValueChange={setStage}>
          <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All stages</SelectItem>
            {LEAD_STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={owner} onValueChange={setOwner}>
          <SelectTrigger className="h-8 w-52"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All owners</SelectItem>
            {team.map((m) => <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {view === "table" ? (
        <DataTable
          rows={rows}
          rowKey={(r) => r.id}
          onRowClick={(r) => navigate({ to: "/crm/$id", params: { id: String(r.id) } })}
          searchKeys={[(r) => r.full_name, (r) => r.company, (r) => r.email, (r) => r.industry]}
          searchPlaceholder="Search name, company, email…"
          exportName="leads"
          initialSort={{ key: "created_at", dir: "desc" }}
          columns={[
            { key: "full_name", header: "Lead", cell: (r) => <div><div className="font-medium">{r.full_name}</div><div className="text-xs text-muted-foreground">{r.job_title} · {r.company}</div></div> },
            { key: "country_code", header: "Market", value: (r) => country(r.country_code)?.name, cell: (r) => <span className="whitespace-nowrap">{country(r.country_code)?.flag} {country(r.country_code)?.name}</span> },
            { key: "industry", header: "Industry", cell: (r) => <span className="text-xs">{r.industry}</span> },
            { key: "source", header: "Source", cell: (r) => <div className="text-xs"><div>{r.source}</div><div className="max-w-44 truncate text-muted-foreground">{campaign(r.campaign_id)?.name}</div></div> },
            { key: "stage", header: "Stage", cell: (r) => <StatusBadge value={r.stage} /> },
            { key: "score", header: "Score", align: "right", cell: (r) => <span className={cn(r.score >= 75 ? "text-success" : r.score < 40 ? "text-muted-foreground" : "")}>{r.score}</span> },
            { key: "deal_value", header: "Value", align: "right", value: (r) => Number(r.deal_value), cell: (r) => fmtUsd(Number(r.deal_value)) },
            { key: "owner", header: "Owner", value: (r) => member(r.owner_id)?.name, cell: (r) => <span className="text-xs">{member(r.owner_id)?.name}</span> },
            { key: "created_at", header: "Created", cell: (r) => <span className="num text-xs">{fmtDate(r.created_at)}</span> },
          ]}
        />
      ) : (
        <div className="grid gap-3 overflow-x-auto pb-2" style={{ gridTemplateColumns: `repeat(${LEAD_STAGES.length}, minmax(220px, 1fr))` }}>
          {LEAD_STAGES.map((s) => {
            const col = rows.filter((l) => l.stage === s);
            return (
              <div key={s} className="panel flex max-h-[640px] flex-col p-2">
                <div className="mb-2 flex items-center justify-between px-1">
                  <StatusBadge value={s} />
                  <span className="num text-xs text-muted-foreground">{col.length} · {fmtUsd(sum(col), true)}</span>
                </div>
                <div className="space-y-2 overflow-y-auto">
                  {col.slice(0, 40).map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => navigate({ to: "/crm/$id", params: { id: String(l.id) } })}
                      className="w-full rounded-md border border-border bg-surface-2/60 p-2 text-left text-xs hover:border-primary/50"
                    >
                      <div className="font-medium text-foreground">{l.company}</div>
                      <div className="text-muted-foreground">{l.full_name}</div>
                      <div className="mt-1.5 flex items-center justify-between">
                        <span>{country(l.country_code)?.flag}</span>
                        <span className="num text-foreground">{fmtUsd(Number(l.deal_value), true)}</span>
                      </div>
                    </button>
                  ))}
                  {col.length > 40 && <div className="py-1 text-center text-[11px] text-muted-foreground">+{col.length - 40} more</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ChartCard title="Pipeline value by market" subtitle="Click to open market" className="mt-4">
        <BarList
          items={byCountry.slice(0, 10).map(([code, v]) => ({ id: code, label: <>{country(code)?.flag} {country(code)?.name}</>, value: v }))}
          fmt={(v) => fmtUsd(v, true)}
          color="var(--chart-2)"
          onSelect={(code) => navigate({ to: "/markets/$code", params: { code } })}
        />
      </ChartCard>
      <DemoNote />
    </>
  );
}
