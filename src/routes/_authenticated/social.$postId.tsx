import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";

import { BarsChart, ChartCard } from "@/components/app/charts";
import { DetailStat, LoadingBlock, PageHeader } from "@/components/app/page";
import { StatusBadge } from "@/components/app/status-badge";
import { Badge } from "@/components/ui/badge";
import { useLookups, useSocialAccounts } from "@/lib/api";
import { fmtCompact, fmtDateTime, fmtNum, fmtPct, safeDiv } from "@/lib/format";
import { useSocialPostDetail } from "@/lib/social-data";
import { PLATFORM_META } from "@/lib/social-platforms";

export const Route = createFileRoute("/_authenticated/social/$postId")({
  head: () => ({
    meta: [
      { title: "Social post \u2014 Prakash Pump" },
      {
        name: "description",
        content: "Social post analytics and records for the Prakash Pump marketing team.",
      },
      { property: "og:title", content: "Social post \u2014 Prakash Pump" },
      {
        property: "og:description",
        content: "Social post analytics and records for the Prakash Pump marketing team.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PostDetail,
});

function PostDetail() {
  const { postId } = Route.useParams();
  const { country } = useLookups();
  const accounts = useSocialAccounts();
  const detail = useSocialPostDetail(postId);

  const post = detail.data?.post ?? null;
  const peers = detail.data?.peers ?? [];
  const account = useMemo(
    () => (accounts.data ?? []).find((a) => String(a.id) === post?.accountId),
    [accounts.data, post?.accountId],
  );

  if (detail.isLoading) return <LoadingBlock className="mt-10" />;

  if (!post) {
    return (
      <div className="panel p-8 text-center text-muted-foreground">
        Post not found.{" "}
        <Link to="/social" className="text-primary hover:underline">
          Back to social media
        </Link>
      </div>
    );
  }

  const meta = PLATFORM_META[post.platform];
  const average = (key: "impressions" | "engagements") =>
    peers.length ? peers.reduce((n, p) => n + p[key], 0) / peers.length : 0;
  const extraChips = meta.chips.filter((chip) => chip.key !== "videoViews" || post.videoViews > 0);

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Social Media", to: "/social" }]}
        eyebrow={`${meta.label} · ${post.format}`}
        title={account?.name ?? "Post"}
        description={`${account?.handle ?? ""} · ${fmtDateTime(post.publishedAt)}`}
        actions={
          <>
            <StatusBadge value={post.status} />
            <Badge variant="muted" className="rounded-full text-[10px]">
              {post.format}
            </Badge>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="panel p-5 xl:col-span-2">
          <div className="flex items-center gap-3">
            <span className="size-10 rounded-full" style={{ background: meta.color }} />
            <div>
              <div className="font-medium">{account?.name}</div>
              <div className="text-xs text-muted-foreground">{account?.handle}</div>
            </div>
          </div>
          <p className="mt-4 whitespace-pre-line text-base leading-relaxed">{post.content}</p>
          <div className="grid-bg mt-4 flex h-48 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
            {post.format} asset preview
          </div>
        </div>
        <ChartCard title="Context">
          <dl className="space-y-2 text-sm">
            {[
              [
                "Market",
                country(account?.country_code ?? "")?.name ??
                  account?.country_code ??
                  "Global",
              ],
              ["Account followers", fmtCompact(account?.followers ?? 0)],
              ["Format", post.format],
              [
                post.status === "Scheduled" ? "Scheduled for" : "Published",
                fmtDateTime(post.publishedAt),
              ],
            ].map(([key, value]) => (
              <div
                key={String(key)}
                className="flex justify-between gap-3 border-b border-border/50 pb-2 last:border-0"
              >
                <dt className="text-muted-foreground">{key}</dt>
                <dd className="text-right">{value}</dd>
              </div>
            ))}
          </dl>
        </ChartCard>
      </div>

      <div className="my-4 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        <DetailStat label="Impressions" value={fmtCompact(post.impressions)} />
        <DetailStat label="Reach" value={fmtCompact(post.reach)} />
        <DetailStat label="Engagements" value={fmtNum(post.engagements)} />
        <DetailStat
          label="Eng. rate"
          value={fmtPct(safeDiv(post.engagements, post.impressions), 2)}
        />
        {extraChips.map((chip) => (
          <DetailStat key={chip.key} label={chip.label} value={fmtCompact(post[chip.key])} />
        ))}
        {post.clicks > 0 && <DetailStat label="Link clicks" value={fmtNum(post.clicks)} />}
      </div>

      {post.status === "Published" && peers.length > 0 && (
        <ChartCard
          title="Versus account average"
          subtitle={`${peers.length} other published posts on this account`}
        >
          <BarsChart
            data={[
              {
                key: "Impressions",
                post: post.impressions,
                avg: Math.round(average("impressions")),
              },
              {
                key: "Engagements",
                post: post.engagements,
                avg: Math.round(average("engagements")),
              },
            ]}
            series={[
              { key: "post", label: "This post" },
              { key: "avg", label: "Account avg", color: "var(--chart-6)" },
            ]}
            height={220}
          />
        </ChartCard>
      )}
    </>
  );
}
