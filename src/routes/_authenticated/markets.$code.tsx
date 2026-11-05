import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";

import { BarList, ChartCard, DonutChart, TrendChart } from "@/components/app/charts";
import { DataTable } from "@/components/app/data-table";
import { DemoNote, DetailStat, LoadingBlock, PageHeader } from "@/components/app/page";
import { StatusBadge } from "@/components/app/status-badge";
import { totals, useCompetitorActivities, useCompetitors, useKeywords, useLeads, useLookups, useMetrics, useWeb } from "@/lib/api";
import { inRange, useFilters } from "@/lib/filters";
import { fmtCompact, fmtDate, fmtNum, fmtUsd, grainFor, platformColor, platformLabel, safeDiv } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/markets/$code")({
  head: () => ({ meta: [{"title": "Market detail \u2014 Prakash Pump"}, {"name": "description", "content": "Market detail analytics and records for the Prakash Pump marketing team."}, {"property": "og:title", "content": "Market detail \u2014 Prakash Pump"}, {"property": "og:description", "content": "Market detail analytics and records for the Prakash Pump marketing team."}, {"property": "og:type", "content": "website"}, {"name": "twitter:card", "content": "summary_large_image"}] }),
  component: MarketDetail,
});

function MarketDetail() {
  const { code } = Route.useParams();
  const f = useFilters();
  const navigate = useNavigate();
  const { country, campaigns, member, loading } = useLookups();
  const c = country(code);
  const scope = { countries: [code] };
  const grain = grainFor(f.days);

  const trend = useMetrics(grain, scope);
  const byPlatform = useMetrics("platform", scope);
  const byCampaign = useMetrics("campaign", scope);
  const web = useWeb(grain, scope);
  const webSrc = useWeb("source", scope);
  const leads = useLeads();
  const kws = useKeywords();
  const comps = useCompetitors();
  const acts = useCompetitorActivities();

  if (loading) return <LoadingBlock />;
  if (!c) return <div className="panel p-8 text-center text-muted-foreground">Market not found.</div>;

  const t = totals(trend.data);
  const mLeads = (leads.data ?? []).filter((l) => l.country_code === code && inRange(l.created_at, f.from, f.to));
  const sessions = (web.data ?? []).reduce((a, r) => a + Number(r.sessions), 0);
  const mCampaigns = campaigns.filter((x) => x.countries.includes(code));
  const compName = (id: number) => comps.data?.find((x) => x.id === id)?.name ?? "";

  const merged = (trend.data ?? []).map((r) => ({
    key: r.key,
    spend: Number(r.spend),
    sessions: Number(web.data?.find((w) => w.key === r.key)?.sessions ?? 0),
  }));

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Markets", to: "/markets" }]}
        eyebrow={`${c.region} · ${c.currency}`}
        title={<span>{c.flag} {c.name}</span>}
        description={c.notes ?? undefined}
        filters={["date", "platform"]}
        actions={<StatusBadge value={c.priority} />}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        <DetailStat label="Market size" value={`$${fmtNum(Number(c.market_size_musd))}M`} />
        <DetailStat label="Growth" value={`${c.growth_rate}%`} sub="YoY" />
        <DetailStat label="Our share" value={`${c.market_share}%`} />
        <DetailStat label="Distributors" value={fmtNum(c.distributors)} />
        <DetailStat label="Spend" value={fmtUsd(t.spend, true)} />
        <DetailStat label="Paid leads" value={fmtNum(t.leads)} sub={`${fmtUsd(safeDiv(t.spend, t.leads))} CPL`} />
        <DetailStat label="Web sessions" value={fmtCompact(sessions)} />
        <DetailStat label="CRM pipeline" value={fmtUsd(mLeads.filter((l) => !["Won", "Lost"].includes(l.stage)).reduce((a, l) => a + Number(l.deal_value), 0), true)} sub={`${mLeads.length} leads`} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard title="Media spend vs website demand" className="xl:col-span-2">
          <TrendChart data={merged} series={[{ key: "spend", label: "Spend" }, { key: "sessions", label: "Sessions", axis: "right", color: "var(--chart-2)" }]} fmt={(v) => fmtUsd(v, true)} height={260} />
        </ChartCard>
        <ChartCard title="Traffic sources">
          <DonutChart data={(webSrc.data ?? []).map((r) => ({ name: r.key, value: Number(r.sessions) }))} height={170} />
        </ChartCard>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <ChartCard title="Platforms in this market">
          <BarList items={(byPlatform.data ?? []).map((r) => ({ id: r.key, label: <><span className="size-2 rounded-full" style={{ background: platformColor(r.key) }} />{platformLabel(r.key)}</>, value: Number(r.spend), sub: `${fmtNum(Number(r.leads))} leads` }))} fmt={(v) => fmtUsd(v, true)} />
        </ChartCard>
        <ChartCard title="Campaigns" subtitle={`${mCampaigns.length} running or planned here`}>
          <BarList
            items={mCampaigns.map((x) => ({ id: String(x.id), label: <span className="truncate">{x.name}</span>, value: Number(byCampaign.data?.find((r) => Number(r.key) === x.id)?.leads ?? 0), sub: <StatusBadge value={x.status} /> }))}
            fmt={fmtNum}
            onSelect={(id) => navigate({ to: "/campaigns/$id", params: { id } })}
          />
        </ChartCard>
        <ChartCard title="Competitor moves" subtitle="Last 6 months">
          <ul className="space-y-2 text-sm">
            {(acts.data ?? []).filter((a) => a.country_code === code).slice(0, 6).map((a) => (
              <li key={a.id}>
                <Link to="/competitors/$id" params={{ id: String(a.competitor_id) }} className="block rounded px-1 py-1 hover:bg-accent/50">
                  <div className="flex items-center gap-2 text-xs"><StatusBadge value={a.impact} /> <span className="text-muted-foreground">{compName(a.competitor_id)} · {fmtDate(a.date)}</span></div>
                  <div className="mt-0.5 leading-snug">{a.title}</div>
                </Link>
              </li>
            ))}
            {!(acts.data ?? []).some((a) => a.country_code === code) && <li className="text-muted-foreground">No tracked activity.</li>}
          </ul>
        </ChartCard>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <DataTable
          rows={mLeads}
          rowKey={(r) => r.id}
          onRowClick={(r) => navigate({ to: "/crm/$id", params: { id: String(r.id) } })}
          pageSize={8}
          exportName={`${code}-leads`}
          toolbar={<span className="text-sm font-semibold">Leads in {c.name}</span>}
          initialSort={{ key: "deal_value", dir: "desc" }}
          columns={[
            { key: "company", header: "Company", cell: (r) => <div><div className="font-medium">{r.company}</div><div className="text-xs text-muted-foreground">{r.full_name}</div></div> },
            { key: "stage", header: "Stage", cell: (r) => <StatusBadge value={r.stage} /> },
            { key: "owner", header: "Owner", value: (r) => member(r.owner_id)?.name, cell: (r) => <span className="text-xs">{member(r.owner_id)?.name}</span> },
            { key: "deal_value", header: "Value", align: "right", value: (r) => Number(r.deal_value), cell: (r) => fmtUsd(Number(r.deal_value), true) },
          ]}
        />
        <DataTable
          rows={(kws.data ?? []).filter((k) => k.country_code === code)}
          rowKey={(r) => r.id}
          pageSize={8}
          exportName={`${code}-keywords`}
          toolbar={<span className="text-sm font-semibold">Search rankings</span>}
          initialSort={{ key: "search_volume", dir: "desc" }}
          empty="No keywords tracked for this market."
          columns={[
            { key: "keyword", header: "Keyword" },
            { key: "position", header: "Pos.", align: "right", value: (r) => Number(r.position) },
            { key: "change", header: "Δ", align: "right", value: (r) => Number(r.prev_position) - Number(r.position), cell: (r) => { const d = Number(r.prev_position) - Number(r.position); return <span className={d > 0 ? "text-success" : d < 0 ? "text-destructive" : ""}>{d > 0 ? "+" : ""}{d.toFixed(1)}</span>; } },
            { key: "search_volume", header: "Volume", align: "right", cell: (r) => fmtCompact(r.search_volume) },
          ]}
        />
      </div>
      <DemoNote />
    </>
  );
}
