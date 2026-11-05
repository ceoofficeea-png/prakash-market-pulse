import { createFileRoute, Link } from "@tanstack/react-router";

import { BarsChart, ChartCard } from "@/components/app/charts";
import { DemoNote, DetailStat, LoadingBlock, PageHeader } from "@/components/app/page";
import { StatusBadge } from "@/components/app/status-badge";
import { useLookups, useSocialAccounts, useSocialPosts } from "@/lib/api";
import { fmtCompact, fmtDateTime, fmtNum, fmtPct, safeDiv, socialColor, socialLabel } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/social/$postId")({
  head: () => ({ meta: [{"title": "Social post \u2014 Prakash Pump"}, {"name": "description", "content": "Social post analytics and records for the Prakash Pump marketing team."}, {"property": "og:title", "content": "Social post \u2014 Prakash Pump"}, {"property": "og:description", "content": "Social post analytics and records for the Prakash Pump marketing team."}, {"property": "og:type", "content": "website"}, {"name": "twitter:card", "content": "summary_large_image"}] }),
  component: PostDetail,
});

function PostDetail() {
  const { postId } = Route.useParams();
  const pid = Number(postId);
  const posts = useSocialPosts();
  const accounts = useSocialAccounts();
  const { country, campaign, member } = useLookups();
  const p = posts.data?.find((x) => x.id === pid);

  if (posts.isLoading) return <LoadingBlock />;
  if (!p) return <div className="panel p-8 text-center text-muted-foreground">Post not found.</div>;
  const acc = accounts.data?.find((a) => a.id === p.account_id);
  const peers = (posts.data ?? []).filter((x) => x.account_id === p.account_id && x.status === "Published");
  const avg = (k: "impressions" | "engagements" | "clicks") => safeDiv(peers.reduce((a, x) => a + x[k], 0), peers.length);
  const cmp = campaign(p.campaign_id);

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Social Media", to: "/social" }]}
        eyebrow={`${socialLabel(p.platform)} · ${p.format}`}
        title={acc?.name ?? "Post"}
        description={`${acc?.handle ?? ""} · ${fmtDateTime(p.published_at)}`}
        actions={<><StatusBadge value={p.status} /><StatusBadge value={p.sentiment} /></>}
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="panel p-5 xl:col-span-2">
          <div className="flex items-center gap-3">
            <span className="size-10 rounded-full" style={{ background: socialColor(p.platform) }} />
            <div>
              <div className="font-medium">{acc?.name}</div>
              <div className="text-xs text-muted-foreground">{acc?.handle}</div>
            </div>
          </div>
          <p className="mt-4 text-base leading-relaxed">{p.content}</p>
          <div className="grid-bg mt-4 flex h-48 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
            {p.format} asset preview
          </div>
        </div>
        <ChartCard title="Context">
          <dl className="space-y-2 text-sm">
            {[
              ["Market", p.country_code ? `${country(p.country_code)?.flag} ${country(p.country_code)?.name}` : "Global"],
              ["Campaign", cmp ? <Link to="/campaigns/$id" params={{ id: String(cmp.id) }} className="text-primary hover:underline">{cmp.name}</Link> : "—"],
              ["Author", member(p.author_id)?.name ?? "—"],
              ["Account followers", fmtCompact(acc?.followers ?? 0)],
            ].map(([k, v]) => (
              <div key={String(k)} className="flex justify-between gap-3 border-b border-border/50 pb-2 last:border-0">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="text-right">{v}</dd>
              </div>
            ))}
          </dl>
        </ChartCard>
      </div>

      <div className="my-4 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        <DetailStat label="Impressions" value={fmtCompact(p.impressions)} />
        <DetailStat label="Reach" value={fmtCompact(p.reach)} />
        <DetailStat label="Engagements" value={fmtNum(p.engagements)} />
        <DetailStat label="Eng. rate" value={fmtPct(safeDiv(p.engagements, p.impressions), 2)} />
        <DetailStat label="Likes" value={fmtNum(p.likes)} />
        <DetailStat label="Comments" value={fmtNum(p.comments)} />
        <DetailStat label="Shares" value={fmtNum(p.shares)} />
        <DetailStat label="Link clicks" value={fmtNum(p.clicks)} sub={p.video_views ? `${fmtCompact(p.video_views)} video views` : undefined} />
      </div>

      <ChartCard title="Versus account average" subtitle={`${peers.length} published posts on this account`}>
        <BarsChart
          data={[
            { key: "Impressions", post: p.impressions, avg: Math.round(avg("impressions")) },
            { key: "Engagements", post: p.engagements, avg: Math.round(avg("engagements")) },
            { key: "Clicks", post: p.clicks, avg: Math.round(avg("clicks")) },
          ]}
          series={[{ key: "post", label: "This post" }, { key: "avg", label: "Account avg", color: "var(--chart-6)" }]}
          height={220}
        />
      </ChartCard>
      <DemoNote />
    </>
  );
}
