import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowDown, ArrowUp } from "lucide-react";
import { useState } from "react";

import { BarList, ChartCard, DonutChart, TrendChart } from "@/components/app/charts";
import { DataTable } from "@/components/app/data-table";
import { KpiCard } from "@/components/app/kpi-card";
import { DemoNote, KpiGrid, PageHeader } from "@/components/app/page";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useKeywords, useLookups, useWeb, useWebPages } from "@/lib/api";
import { useFilters } from "@/lib/filters";
import { CHART_COLORS, fmtCompact, fmtDuration, fmtNum, fmtPct, grainFor, pctChange, safeDiv, WEB_SOURCES } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/web")({
  head: () => ({ meta: [{ title: "Website & SEO Analytics — Prakash Pump" }] }),
  component: WebPage,
});

function WebPage() {
  const f = useFilters();
  const navigate = useNavigate();
  const { country, product } = useLookups();
  const [sources, setSources] = useState<string[]>([]);
  const grain = grainFor(f.days);
  const all = useWeb("all", { sources });
  const prev = useWeb("all", { sources, from: f.prevFrom, to: f.prevTo });
  const trend = useWeb(grain, { sources });
  const previousTrend = useWeb(grain, { sources, from: f.prevFrom, to: f.prevTo });
  const bySource = useWeb("source");
  const byCountry = useWeb("country", { sources });
  const pages = useWebPages();
  const kws = useKeywords();

  const c = all.data?.[0];
  const p = prev.data?.[0];
  const n = (v: unknown) => Number(v ?? 0);
  const keywords = (kws.data ?? []).filter((k) => !f.countries.length || (k.country_code && f.countries.includes(k.country_code)));
  const top3 = keywords.filter((k) => Number(k.position) <= 3).length;
  const top10 = keywords.filter((k) => Number(k.position) <= 10).length;

  return (
    <>
      <PageHeader
        eyebrow="04 · Website & SEO"
        title="Website & search performance"
        description="Traffic, engagement and conversions on prakashpump.com, with organic rankings by market."
        filters={["date", "country"]}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {WEB_SOURCES.map((s, i) => {
          const on = sources.includes(s);
          return (
            <button key={s} type="button" onClick={() => setSources(on ? sources.filter((x) => x !== s) : [...sources, s])} className={cn("flex items-center gap-2 rounded-full border px-3 py-1 text-xs", on ? "border-primary bg-primary/15 text-foreground" : "border-border text-muted-foreground hover:text-foreground")}>
              <span className="size-2 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} /> {s}
            </button>
          );
        })}
      </div>

      <KpiGrid cols={6}>
        <KpiCard label="Sessions" value={fmtCompact(n(c?.sessions))} delta={pctChange(n(c?.sessions), n(p?.sessions))} spark={(trend.data ?? []).map((r) => n(r.sessions))} />
        <KpiCard label="Users" value={fmtCompact(n(c?.users))} delta={pctChange(n(c?.users), n(p?.users))} />
        <KpiCard label="New users" value={fmtPct(safeDiv(n(c?.new_users), n(c?.users)))} delta={pctChange(safeDiv(n(c?.new_users), n(c?.users)), safeDiv(n(p?.new_users), n(p?.users)))} hint="of users" />
        <KpiCard label="Bounce rate" value={fmtPct(n(c?.bounce_rate))} delta={pctChange(n(c?.bounce_rate), n(p?.bounce_rate))} invert />
        <KpiCard label="Avg session" value={fmtDuration(n(c?.avg_session_sec))} delta={pctChange(n(c?.avg_session_sec), n(p?.avg_session_sec))} />
        <KpiCard label="Conversions" value={fmtNum(n(c?.conversions))} delta={pctChange(n(c?.conversions), n(p?.conversions))} hint={fmtPct(safeDiv(n(c?.conversions), n(c?.sessions)), 2) + " CVR"} color="var(--chart-3)" spark={(trend.data ?? []).map((r) => n(r.conversions))} />
      </KpiGrid>

      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard title="Sessions & conversions" className="xl:col-span-2">
          <TrendChart previousData={(previousTrend.data ?? []).map((r) => ({ key: r.key, sessions: n(r.sessions), conversions: n(r.conversions) }))} data={(trend.data ?? []).map((r) => ({ key: r.key, sessions: n(r.sessions), conversions: n(r.conversions) }))} series={[{ key: "sessions", label: "Sessions", color: "var(--chart-2)" }, { key: "conversions", label: "Conversions", axis: "right" }]} height={260} />
        </ChartCard>
        <ChartCard title="Traffic sources" subtitle="Click to filter">
          <DonutChart data={(bySource.data ?? []).map((r) => ({ name: r.key, id: r.key, value: n(r.sessions), color: CHART_COLORS[WEB_SOURCES.indexOf(r.key) % CHART_COLORS.length] }))} height={170} onSliceClick={(d) => d.id && setSources([d.id])} />
        </ChartCard>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <ChartCard title="Sessions by market" subtitle="Click to drill in">
          <BarList
            items={[...(byCountry.data ?? [])].sort((a, b) => n(b.sessions) - n(a.sessions)).map((r) => ({ id: r.key, label: <>{country(r.key)?.flag} {country(r.key)?.name}</>, value: n(r.sessions), sub: fmtPct(safeDiv(n(r.conversions), n(r.sessions)), 2) }))}
            color="var(--chart-2)"
            onSelect={(code) => navigate({ to: "/markets/$code", params: { code } })}
          />
        </ChartCard>
        <div className="xl:col-span-2">
          <Tabs defaultValue="pages">
            <TabsList>
              <TabsTrigger value="pages">Top pages</TabsTrigger>
              <TabsTrigger value="keywords">SEO keywords</TabsTrigger>
            </TabsList>
            <TabsContent value="pages">
              <DataTable
                rows={pages.data ?? []}
                rowKey={(r) => r.id}
                searchKeys={[(r) => r.path, (r) => r.title]}
                exportName="top-pages"
                pageSize={10}
                initialSort={{ key: "pageviews", dir: "desc" }}
                columns={[
                  { key: "title", header: "Page", cell: (r) => <div className="max-w-72"><div className="truncate font-medium">{r.title}</div><div className="num truncate text-xs text-muted-foreground">{r.path}</div></div> },
                  { key: "page_type", header: "Type", cell: (r) => <span className="text-xs">{r.page_type}</span> },
                  { key: "pageviews", header: "Views", align: "right", cell: (r) => fmtCompact(r.pageviews) },
                  { key: "avg_time_sec", header: "Avg time", align: "right", cell: (r) => fmtDuration(r.avg_time_sec) },
                  { key: "bounce_rate", header: "Bounce", align: "right", value: (r) => Number(r.bounce_rate), cell: (r) => fmtPct(Number(r.bounce_rate)) },
                  { key: "conversions", header: "Conv.", align: "right", cell: (r) => fmtNum(r.conversions) },
                  { key: "load_time_ms", header: "Load", align: "right", cell: (r) => <span className={r.load_time_ms > 2200 ? "text-warning" : ""}>{(r.load_time_ms / 1000).toFixed(2)}s</span> },
                ]}
              />
            </TabsContent>
            <TabsContent value="keywords">
              <div className="mb-3 grid grid-cols-3 gap-3">
                <KpiCard label="Tracked keywords" value={String(keywords.length)} />
                <KpiCard label="Top 3 positions" value={String(top3)} />
                <KpiCard label="Top 10 positions" value={String(top10)} />
              </div>
              <DataTable
                rows={keywords}
                rowKey={(r) => r.id}
                searchKeys={[(r) => r.keyword]}
                exportName="seo-keywords"
                pageSize={10}
                initialSort={{ key: "search_volume", dir: "desc" }}
                columns={[
                  { key: "keyword", header: "Keyword", cell: (r) => <div><div className="font-medium">{r.keyword}</div><div className="text-xs text-muted-foreground">{product(r.product_id)?.name}</div></div> },
                  { key: "country_code", header: "Market", value: (r) => country(r.country_code)?.name, cell: (r) => <>{country(r.country_code)?.flag} {r.country_code}</> },
                  { key: "position", header: "Position", align: "right", value: (r) => Number(r.position) },
                  {
                    key: "change",
                    header: "Change",
                    align: "right",
                    value: (r) => Number(r.prev_position) - Number(r.position),
                    cell: (r) => {
                      const d = Number(r.prev_position) - Number(r.position);
                      return <span className={cn("inline-flex items-center gap-0.5", d > 0 ? "text-success" : d < 0 ? "text-destructive" : "text-muted-foreground")}>{d > 0 ? <ArrowUp className="size-3" /> : d < 0 ? <ArrowDown className="size-3" /> : null}{Math.abs(d).toFixed(1)}</span>;
                    },
                  },
                  { key: "search_volume", header: "Volume", align: "right", cell: (r) => fmtCompact(r.search_volume) },
                  { key: "difficulty", header: "KD", align: "right" },
                  { key: "clicks", header: "Clicks", align: "right", cell: (r) => fmtCompact(r.clicks) },
                ]}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
      <DemoNote />
    </>
  );
}
