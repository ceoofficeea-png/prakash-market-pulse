import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CalendarClock, KanbanSquare, Table2 } from "lucide-react";
import { useMemo, useState } from "react";

import { BarsChart, ChartCard, DonutChart } from "@/components/app/charts";
import { DataTable } from "@/components/app/data-table";
import { KpiCard } from "@/components/app/kpi-card";
import { DemoNote, KpiGrid, PageHeader } from "@/components/app/page";
import { StatusBadge } from "@/components/app/status-badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useContent, useLookups } from "@/lib/api";
import { useFilters } from "@/lib/filters";
import { CONTENT_STAGES, fmtCompact, fmtDate, fmtNum, fmtPct } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/content/")({
  head: () => ({ meta: [{ title: "Content Management — Prakash Pump" }] }),
  component: ContentPage,
});

function ContentPage() {
  const f = useFilters();
  const navigate = useNavigate();
  const content = useContent();
  const { country, member, product } = useLookups();
  const [view, setView] = useState<"board" | "table">("board");
  const [type, setType] = useState("all");

  const items = useMemo(
    () =>
      (content.data ?? []).filter(
        (c) =>
          (!f.countries.length || (c.country_code && f.countries.includes(c.country_code))) &&
          (!f.campaigns.length || (c.campaign_id != null && f.campaigns.includes(c.campaign_id))) &&
          (type === "all" || c.content_type === type),
      ),
    [content.data, f.countries, f.campaigns, type],
  );
  const types = Array.from(new Set((content.data ?? []).map((c) => c.content_type))).sort();
  const published = items.filter((c) => c.status === "Published");
  const inFlight = items.filter((c) => ["Brief", "In Production", "In Review", "Approved"].includes(c.status));
  const overdue = inFlight.filter((c) => c.due_date && c.due_date < new Date().toISOString().slice(0, 10));
  const upcoming = inFlight.filter((c) => c.due_date).sort((a, b) => String(a.due_date).localeCompare(String(b.due_date))).slice(0, 8);

  const byType = types.map((t) => {
    const rows = items.filter((c) => c.content_type === t && ["Published", "Archived"].includes(c.status));
    return { key: t, views: rows.reduce((a, c) => a + c.views, 0), leads: rows.reduce((a, c) => a + c.leads_generated, 0) };
  });
  const byLang = Object.entries(items.reduce<Record<string, number>>((a, c) => ({ ...a, [c.language]: (a[c.language] ?? 0) + 1 }), {})).map(([name, value]) => ({ name, value }));

  return (
    <>
      <PageHeader
        eyebrow="05 · Content Management"
        title="Content pipeline"
        description="Brochures, datasheets, case studies, videos and campaigns assets — from brief to published."
        filters={["country", "campaign"]}
        actions={
          <ToggleGroup type="single" value={view} onValueChange={(v) => v && setView(v as "board" | "table")} variant="outline" size="sm">
            <ToggleGroupItem value="board" aria-label="Board view"><KanbanSquare className="size-4" /></ToggleGroupItem>
            <ToggleGroupItem value="table" aria-label="Table view"><Table2 className="size-4" /></ToggleGroupItem>
          </ToggleGroup>
        }
      />

      <KpiGrid cols={6}>
        <KpiCard label="Assets" value={fmtNum(items.length)} />
        <KpiCard label="Published" value={fmtNum(published.length)} />
        <KpiCard label="In production" value={fmtNum(inFlight.length)} />
        <KpiCard label="Overdue" value={fmtNum(overdue.length)} />
        <KpiCard label="Total views" value={fmtCompact(items.reduce((a, c) => a + c.views, 0))} />
        <KpiCard label="Leads from content" value={fmtNum(items.reduce((a, c) => a + c.leads_generated, 0))} />
      </KpiGrid>

      <div className="mb-3 flex items-center gap-2">
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="h-8 w-52"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All content types</SelectItem>
            {types.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {view === "board" ? (
        <div className="grid gap-3 overflow-x-auto pb-2" style={{ gridTemplateColumns: `repeat(${CONTENT_STAGES.length}, minmax(210px, 1fr))` }}>
          {CONTENT_STAGES.map((s) => {
            const col = items.filter((c) => c.status === s);
            return (
              <div key={s} className="panel flex max-h-[560px] flex-col p-2">
                <div className="mb-2 flex items-center justify-between px-1">
                  <StatusBadge value={s} />
                  <span className="num text-xs text-muted-foreground">{col.length}</span>
                </div>
                <div className="space-y-2 overflow-y-auto">
                  {col.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => navigate({ to: "/content/$id", params: { id: String(c.id) } })}
                      className="w-full rounded-md border border-border bg-surface-2/60 p-2 text-left text-xs hover:border-primary/50"
                    >
                      <div className="eyebrow text-[10px] text-primary">{c.content_type}</div>
                      <div className="mt-0.5 line-clamp-2 font-medium text-foreground">{c.title}</div>
                      <div className="mt-1.5 flex items-center justify-between text-muted-foreground">
                        <span>{country(c.country_code)?.flag} {c.language}</span>
                        <span className="num">{c.due_date ? fmtDate(c.due_date) : ""}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <DataTable
          rows={items}
          rowKey={(r) => r.id}
          onRowClick={(r) => navigate({ to: "/content/$id", params: { id: String(r.id) } })}
          searchKeys={[(r) => r.title, (r) => r.content_type, (r) => r.language]}
          exportName="content"
          initialSort={{ key: "due_date", dir: "desc" }}
          columns={[
            { key: "title", header: "Title", cell: (r) => <div className="max-w-80"><div className="truncate font-medium">{r.title}</div><div className="text-xs text-muted-foreground">{r.content_type} · {r.channel}</div></div> },
            { key: "status", header: "Status", cell: (r) => <StatusBadge value={r.status} /> },
            { key: "product", header: "Product", value: (r) => product(r.product_id)?.name, cell: (r) => <span className="text-xs">{product(r.product_id)?.name}</span> },
            { key: "country_code", header: "Market", value: (r) => country(r.country_code)?.name, cell: (r) => <>{country(r.country_code)?.flag} {r.language}</> },
            { key: "author", header: "Author", value: (r) => member(r.author_id)?.name, cell: (r) => <span className="text-xs">{member(r.author_id)?.name}</span> },
            { key: "due_date", header: "Due", cell: (r) => <span className="num text-xs">{fmtDate(r.due_date)}</span> },
            { key: "views", header: "Views", align: "right", cell: (r) => fmtCompact(r.views) },
            { key: "engagement_rate", header: "Eng.", align: "right", value: (r) => Number(r.engagement_rate), cell: (r) => fmtPct(Number(r.engagement_rate)) },
            { key: "leads_generated", header: "Leads", align: "right" },
          ]}
        />
      )}

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <ChartCard title="Performance by content type" subtitle="Published assets" className="xl:col-span-2">
          <BarsChart data={byType} series={[{ key: "views", label: "Views" }, { key: "leads", label: "Leads", color: "var(--chart-2)" }]} height={260} />
        </ChartCard>
        <ChartCard title="Upcoming deadlines" subtitle={`${overdue.length} overdue`} actions={<CalendarClock className="size-4 text-muted-foreground" />}>
          <ul className="space-y-1.5">
            {upcoming.map((c) => (
              <li key={c.id}>
                <button type="button" onClick={() => navigate({ to: "/content/$id", params: { id: String(c.id) } })} className="flex w-full items-center justify-between gap-2 rounded px-1 py-1 text-left text-sm hover:bg-accent/50">
                  <span className="truncate">{c.title}</span>
                  <span className={`num shrink-0 text-xs ${c.due_date && c.due_date < new Date().toISOString().slice(0, 10) ? "text-destructive" : "text-muted-foreground"}`}>{fmtDate(c.due_date)}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-4 border-t border-border pt-3">
            <div className="eyebrow mb-2">Languages</div>
            <DonutChart data={byLang} height={120} fmt={fmtNum} />
          </div>
        </ChartCard>
      </div>
      <DemoNote />
    </>
  );
}
