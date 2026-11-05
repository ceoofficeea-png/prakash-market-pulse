import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CalendarClock } from "lucide-react";
import { useMemo, useState } from "react";

import { BarsChart, ChartCard, DonutChart, TrendChart } from "@/components/app/charts";
import { DataTable } from "@/components/app/data-table";
import { KpiCard } from "@/components/app/kpi-card";
import { DemoNote, KpiGrid, PageHeader } from "@/components/app/page";
import { StatusBadge } from "@/components/app/status-badge";
import { SocialAnalytics } from "@/components/app/social-analytics";
import { useLookups, useSocial, useSocialAccounts, useSocialPosts } from "@/lib/api";
import { inRange, useFilters } from "@/lib/filters";
import { fmtCompact, fmtDateTime, fmtNum, fmtPct, grainFor, pctChange, safeDiv, SOCIAL_PLATFORMS, socialColor, socialLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/social/")({
  head: () => ({ meta: [{"title": "Social Media Management \u2014 Prakash Pump"}, {"name": "description", "content": "Social Media Management analytics and records for the Prakash Pump marketing team."}, {"property": "og:title", "content": "Social Media Management \u2014 Prakash Pump"}, {"property": "og:description", "content": "Social Media Management analytics and records for the Prakash Pump marketing team."}, {"property": "og:type", "content": "website"}, {"name": "twitter:card", "content": "summary_large_image"}] }),
  component: SocialPage,
});

function SocialPage() {
  const f = useFilters();
  const navigate = useNavigate();
  const { country, member } = useLookups();
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [account, setAccount] = useState<number | null>(null);
  const grain = grainFor(f.days);
  const opts = { platforms, countries: f.countries };

  const trend = useSocial(grain, opts);
  const previousTrend = useSocial(grain, { ...opts, from: f.prevFrom, to: f.prevTo });
  const all = useSocial("all", opts);
  const prev = useSocial("all", { ...opts, from: f.prevFrom, to: f.prevTo });
  const byPlatform = useSocial("platform", opts);
  const accounts = useSocialAccounts();
  const posts = useSocialPosts();

  const cur = all.data?.[0];
  const pre = prev.data?.[0];
  const followersNow = (byPlatform.data ?? []).reduce((a, r) => a + Number(r.followers ?? 0), 0);

  const filteredPosts = useMemo(
    () =>
      (posts.data ?? []).filter(
        (p) =>
          (!platforms.length || platforms.includes(p.platform)) &&
          (!f.countries.length || (p.country_code && f.countries.includes(p.country_code))) &&
          (account == null || p.account_id === account),
      ),
    [posts.data, platforms, f.countries, account],
  );
  const published = filteredPosts.filter((p) => p.status === "Published" && inRange(p.published_at, f.from, f.to));
  const scheduled = filteredPosts.filter((p) => p.status === "Scheduled").sort((a, b) => a.published_at.localeCompare(b.published_at));

  const formats = Array.from(new Set(published.map((p) => p.format)));
  const byFormat = formats
    .map((fm) => {
      const ps = published.filter((p) => p.format === fm);
      return { key: fm, rate: Number((safeDiv(ps.reduce((a, p) => a + p.engagements, 0), ps.reduce((a, p) => a + p.impressions, 0)) * 100).toFixed(2)) };
    })
    .sort((a, b) => b.rate - a.rate);
  const sentiment = ["Positive", "Neutral", "Negative"].map((s, i) => ({
    name: s,
    value: published.filter((p) => p.sentiment === s).length,
    color: ["var(--chart-3)", "var(--chart-6)", "var(--chart-5)"][i],
  }));

  const accountRows = (accounts.data ?? []).filter((a) => (!platforms.length || platforms.includes(a.platform)) && (!f.countries.length || (a.country_code && f.countries.includes(a.country_code))));

  return (
    <>
      <PageHeader
        eyebrow="02 · Social Media Management"
        title="Social media"
        description="Audience, engagement and publishing across Facebook, Instagram, Snapchat, X, LinkedIn, YouTube and WhatsApp Business."
        filters={["date", "country"]}
      />

      <SocialAnalytics />
      <h2 className="mb-3 text-sm font-semibold">Publishing & shared account records</h2>
      <div className="mb-4 flex flex-wrap gap-2">
        {SOCIAL_PLATFORMS.map((p) => {
          const on = platforms.includes(p.id);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setPlatforms(on ? platforms.filter((x) => x !== p.id) : [...platforms, p.id])}
              className={cn("flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition-colors", on ? "border-primary bg-primary/15 text-foreground" : "border-border text-muted-foreground hover:text-foreground")}
            >
              <span className="size-2 rounded-full" style={{ background: p.color }} /> {p.label}
            </button>
          );
        })}
        {(platforms.length > 0 || account != null) && (
          <button type="button" className="text-xs text-primary" onClick={() => { setPlatforms([]); setAccount(null); }}>
            Clear
          </button>
        )}
      </div>

      <KpiGrid cols={6}>
        <KpiCard label="Followers" value={fmtCompact(followersNow)} />
        <KpiCard label="New followers" value={fmtCompact(Number(cur?.new_followers ?? 0))} delta={pctChange(Number(cur?.new_followers ?? 0), Number(pre?.new_followers ?? 0))} />
        <KpiCard label="Impressions" value={fmtCompact(Number(cur?.impressions ?? 0))} delta={pctChange(Number(cur?.impressions ?? 0), Number(pre?.impressions ?? 0))} spark={(trend.data ?? []).map((r) => Number(r.impressions))} />
        <KpiCard label="Engagements" value={fmtCompact(Number(cur?.engagements ?? 0))} delta={pctChange(Number(cur?.engagements ?? 0), Number(pre?.engagements ?? 0))} color="var(--chart-2)" spark={(trend.data ?? []).map((r) => Number(r.engagements))} />
        <KpiCard label="Engagement rate" value={fmtPct(safeDiv(Number(cur?.engagements ?? 0), Number(cur?.impressions ?? 0)), 2)} delta={pctChange(safeDiv(Number(cur?.engagements ?? 0), Number(cur?.impressions ?? 0)), safeDiv(Number(pre?.engagements ?? 0), Number(pre?.impressions ?? 0)))} />
        <KpiCard label="Posts published" value={fmtNum(published.length)} hint={`${scheduled.length} scheduled`} />
      </KpiGrid>

      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard title="Reach & engagement" subtitle={grain === "week" ? "Weekly" : "Daily"} className="xl:col-span-2">
          <TrendChart previousData={(previousTrend.data ?? []).map((r) => ({ key: r.key, impressions: Number(r.impressions), engagements: Number(r.engagements) }))} data={(trend.data ?? []).map((r) => ({ key: r.key, impressions: Number(r.impressions), engagements: Number(r.engagements) }))} series={[{ key: "impressions", label: "Impressions" }, { key: "engagements", label: "Engagements", axis: "right", color: "var(--chart-2)" }]} height={260} />
        </ChartCard>
        <ChartCard title="Audience by platform">
          <DonutChart data={(byPlatform.data ?? []).map((r) => ({ name: socialLabel(r.key), id: r.key, value: Number(r.followers ?? 0), color: socialColor(r.key) }))} height={170} onSliceClick={(d) => d.id && setPlatforms([d.id])} />
        </ChartCard>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <ChartCard title="Engagement rate by format" subtitle="% of impressions">
          <BarsChart data={byFormat} series={[{ key: "rate", label: "Eng. rate %" }]} fmt={(v) => `${v}%`} height={220} colorByIndex />
        </ChartCard>
        <ChartCard title="Comment sentiment" subtitle="Published posts in range">
          <DonutChart data={sentiment} height={170} fmt={fmtNum} />
        </ChartCard>
        <ChartCard title="Publishing queue" subtitle={`${scheduled.length} scheduled`} actions={<CalendarClock className="size-4 text-muted-foreground" />}>
          <ul className="space-y-1.5">
            {scheduled.slice(0, 6).map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => navigate({ to: "/social/$postId", params: { postId: String(p.id) } })} className="flex w-full items-start gap-2 rounded px-1 py-1 text-left text-xs hover:bg-accent/50">
                  <span className="mt-1 size-2 shrink-0 rounded-full" style={{ background: socialColor(p.platform) }} />
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-1 text-foreground">{p.content}</span>
                    <span className="num text-muted-foreground">{fmtDateTime(p.published_at)} · {p.format}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </ChartCard>
      </div>

      <h2 className="mb-2 mt-6 text-sm font-semibold">Accounts</h2>
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
        {accountRows.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => setAccount(account === a.id ? null : a.id)}
            className={cn("panel p-3 text-left transition-colors hover:border-primary/50", account === a.id && "border-primary")}
          >
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="size-2 rounded-full" style={{ background: socialColor(a.platform) }} />
              {socialLabel(a.platform)} · {a.country_code ? `${country(a.country_code)?.flag} ${country(a.country_code)?.name}` : "Global"}
            </div>
            <div className="mt-1 truncate text-sm font-medium">{a.name}</div>
            <div className="num text-lg font-semibold">{fmtCompact(a.followers)}</div>
            <div className="truncate text-xs text-muted-foreground">{a.handle} · {member(a.manager_id)?.name}</div>
          </button>
        ))}
      </div>

      <h2 className="mb-2 mt-6 text-sm font-semibold">Posts</h2>
      <DataTable
        rows={filteredPosts.filter((p) => p.status !== "Published" || inRange(p.published_at, f.from, f.to))}
        rowKey={(r) => r.id}
        onRowClick={(r) => navigate({ to: "/social/$postId", params: { postId: String(r.id) } })}
        searchKeys={[(r) => r.content, (r) => r.format]}
        searchPlaceholder="Search posts…"
        exportName="social-posts"
        initialSort={{ key: "published_at", dir: "desc" }}
        columns={[
          { key: "content", header: "Post", cell: (r) => <div className="flex max-w-md items-start gap-2"><span className="mt-1.5 size-2 shrink-0 rounded-full" style={{ background: socialColor(r.platform) }} /><span className="line-clamp-2">{r.content}</span></div> },
          { key: "format", header: "Format", cell: (r) => <span className="text-xs">{r.format}</span> },
          { key: "status", header: "Status", cell: (r) => <StatusBadge value={r.status} /> },
          { key: "published_at", header: "Date", cell: (r) => <span className="num text-xs">{fmtDateTime(r.published_at)}</span> },
          { key: "impressions", header: "Impr.", align: "right", cell: (r) => fmtCompact(r.impressions) },
          { key: "engagements", header: "Eng.", align: "right", cell: (r) => fmtCompact(r.engagements) },
          { key: "rate", header: "Rate", align: "right", value: (r) => safeDiv(r.engagements, r.impressions), cell: (r) => fmtPct(safeDiv(r.engagements, r.impressions), 2) },
          { key: "sentiment", header: "Sentiment", cell: (r) => <StatusBadge value={r.sentiment} /> },
        ]}
      />
      <DemoNote />
    </>
  );
}
