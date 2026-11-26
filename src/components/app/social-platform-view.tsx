import { useNavigate } from "@tanstack/react-router";
import { ArrowUpRight, Eye, MousePointerClick, Users } from "lucide-react";
import { useMemo, useState } from "react";

import { ChartCard, DonutChart, LinesChart } from "@/components/app/charts";
import { DataTable, type Column } from "@/components/app/data-table";
import { KpiCard } from "@/components/app/kpi-card";
import { KpiGrid } from "@/components/app/page";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLookups } from "@/lib/api";
import { useFilters } from "@/lib/filters";
import { fmtCompact, fmtPct, fmtShortDate, pctChange } from "@/lib/format";
import {
  accountById,
  accountSnapshots,
  accountsForPlatform,
  PLATFORM_META,
  PLATFORM_ORDER,
  postsInRange,
  summarise,
  topPosts,
  trendByPlatform,
  type AccountSnapshot,
  type DemoPost,
  type PlatformId,
} from "@/lib/social-platforms";
import { previousRange } from "@/lib/periods";

const openPost = (navigate: ReturnType<typeof useNavigate>, post: DemoPost) =>
  navigate({ to: "/social/$postId", params: { postId: post.id } });

/* Spotlight card -------------------------------------------------------- */

function PostSpotlightCard({ post }: { post: DemoPost }) {
  const navigate = useNavigate();
  const meta = PLATFORM_META[post.platform];
  return (
    <button
      type="button"
      onClick={() => openPost(navigate, post)}
      className="panel flex h-full flex-col p-4 text-left transition-colors hover:border-primary/50"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="size-2 rounded-full" style={{ background: meta.color }} />
          {meta.label}
        </span>
        <Badge variant="muted" className="rounded-full text-[10px]">
          {post.format}
        </Badge>
      </div>
      <p className="mt-2 line-clamp-3 flex-1 text-sm leading-snug">{post.content.split("\n")[0]}</p>
      <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="num">{fmtShortDate(post.publishedAt)}</span>
        <span className="num font-medium text-foreground">{fmtPct(post.engagementRate, 2)}</span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border pt-2 text-[11px] text-muted-foreground">
        <span className="num">{fmtCompact(post.likes)} likes</span>
        <span className="num">{fmtCompact(post.comments)} comments</span>
        {post.shares > 0 && <span className="num">{fmtCompact(post.shares)} shares</span>}
      </div>
    </button>
  );
}

/* Metric chip ----------------------------------------------------------- */

function MetricChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-2 rounded-lg border border-border bg-surface-2/50 px-3 py-2">
      <span className="eyebrow truncate">{label}</span>
      <span className="num text-sm font-semibold">{fmtCompact(value)}</span>
    </div>
  );
}

/* Overall view ---------------------------------------------------------- */

export function OverallView({
  onSelectPlatform,
}: {
  onSelectPlatform: (platform: PlatformId) => void;
}) {
  const f = useFilters();
  const { country } = useLookups();
  const navigate = useNavigate();
  const [metric, setMetric] = useState<"reach" | "engagements">("reach");

  // One pass over the fixtures per filter change: the totals, the previous
  // window and the per-platform split are all derived from these account rows.
  const summary = useMemo(() => {
    const rows = accountSnapshots(f.from, f.to, f.countries);
    const prev = previousRange(f.from, f.to);
    const audience = PLATFORM_ORDER.flatMap((platform) => {
      const followers = summarise(rows.filter((r) => r.platform === platform)).followers;
      if (!followers) return [];
      const meta = PLATFORM_META[platform];
      return [{ id: platform, name: meta.label, value: followers, color: meta.color }];
    });
    return {
      rows,
      current: summarise(rows),
      previous: summarise(accountSnapshots(prev.prevFrom, prev.prevTo, f.countries)),
      audience,
    };
  }, [f.from, f.to, f.countries]);

  const posts = useMemo(() => postsInRange(f.from, f.to, f.countries), [f.from, f.to, f.countries]);
  const trend = useMemo(
    () => trendByPlatform(f.from, f.to, f.countries, metric),
    [f.from, f.to, f.countries, metric],
  );
  const spotlight = useMemo(() => topPosts(posts, 5), [posts]);

  const { current: c, previous: p } = summary;

  const accountRows = useMemo(
    () =>
      summary.rows.map((row) => ({
        ...row,
        market: country(row.countryCode)?.name ?? row.countryCode,
      })),
    [summary.rows, country],
  );

  const accountColumns: Column<(typeof accountRows)[number]>[] = useMemo(
    () => [
      {
        key: "platform",
        header: "Platform",
        cell: (r) => (
          <span className="flex items-center gap-2 whitespace-nowrap">
            <span
              className="size-2 rounded-full"
              style={{ background: PLATFORM_META[r.platform].color }}
            />
            {PLATFORM_META[r.platform].label}
          </span>
        ),
      },
      {
        key: "name",
        header: "Account",
        cell: (r) => (
          <div className="min-w-0">
            <div className="truncate font-medium">{r.name}</div>
            <div className="truncate text-xs text-muted-foreground">{r.handle}</div>
          </div>
        ),
      },
      {
        key: "market",
        header: "Market",
        cell: (r) => <span className="whitespace-nowrap text-xs">{r.market}</span>,
      },
      {
        key: "followers",
        header: "Followers",
        align: "right",
        cell: (r) => fmtCompact(r.followers),
      },
      {
        key: "growthPct",
        header: "Growth",
        align: "right",
        value: (r) => r.growthPct,
        cell: (r) => (
          <span className={r.growthPct >= 0 ? "text-success" : "text-destructive"}>
            {fmtPct(r.growthPct, 2)}
          </span>
        ),
      },
      {
        key: "impressions",
        header: "Impressions",
        align: "right",
        cell: (r) => fmtCompact(r.impressions),
      },
      {
        key: "engagements",
        header: "Engagements",
        align: "right",
        cell: (r) => fmtCompact(r.engagements),
      },
      { key: "likes", header: "Likes", align: "right", cell: (r) => fmtCompact(r.likes) },
      { key: "comments", header: "Comments", align: "right", cell: (r) => fmtCompact(r.comments) },
      { key: "shares", header: "Shares", align: "right", cell: (r) => fmtCompact(r.shares) },
      {
        key: "engagementRate",
        header: "Eng. rate",
        align: "right",
        value: (r) => r.engagementRate,
        cell: (r) => fmtPct(r.engagementRate, 2),
      },
    ],
    [],
  );

  return (
    <div className="space-y-4">
      <KpiGrid cols={5}>
        <KpiCard
          label="Total followers"
          value={fmtCompact(c.followers)}
          icon={Users}
          hint={`${c.accounts} accounts`}
        />
        <KpiCard
          label="Net follower growth"
          value={fmtCompact(c.newFollowers)}
          delta={pctChange(c.newFollowers, p.newFollowers)}
        />
        <KpiCard
          label="Impressions"
          value={fmtCompact(c.impressions)}
          delta={pctChange(c.impressions, p.impressions)}
        />
        <KpiCard
          label="Total engagements"
          value={fmtCompact(c.engagements)}
          delta={pctChange(c.engagements, p.engagements)}
          color="var(--chart-2)"
        />
        <KpiCard
          label="Avg. engagement rate"
          value={fmtPct(c.engagementRate, 2)}
          delta={pctChange(c.engagementRate, p.engagementRate)}
        />
      </KpiGrid>

      <div className="grid gap-2 sm:grid-cols-3">
        <MetricChip label="Likes" value={c.likes} />
        <MetricChip label="Comments" value={c.comments} />
        <MetricChip label="Shares" value={c.shares} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard title="Audience distribution" subtitle="Followers by platform">
          <DonutChart
            data={summary.audience}
            height={180}
            onSliceClick={(slice) => slice.id && onSelectPlatform(slice.id as PlatformId)}
          />
        </ChartCard>
        <ChartCard
          title={metric === "reach" ? "Reach by platform" : "Engagement by platform"}
          subtitle="Daily trend across every connected account"
          className="xl:col-span-2"
          actions={
            <Select value={metric} onValueChange={(v) => setMetric(v as "reach" | "engagements")}>
              <SelectTrigger className="h-8 w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="reach">Reach</SelectItem>
                <SelectItem value="engagements">Engagements</SelectItem>
              </SelectContent>
            </Select>
          }
        >
          <LinesChart
            data={trend}
            series={PLATFORM_ORDER.map((id) => ({
              key: id,
              label: PLATFORM_META[id].label,
              color: PLATFORM_META[id].color,
            }))}
            height={240}
          />
        </ChartCard>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">Top 5 performing posts</h2>
          <span className="text-xs text-muted-foreground">
            Ranked by engagement rate across all platforms
          </span>
        </div>
        {spotlight.length ? (
          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
            {spotlight.map((post) => (
              <PostSpotlightCard key={post.id} post={post} />
            ))}
          </div>
        ) : (
          <div className="panel p-6 text-center text-sm text-muted-foreground">
            No published posts in this date range.
          </div>
        )}
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">Account breakdown</h2>
          <span className="text-xs text-muted-foreground">
            All platforms · {accountRows.length} accounts
          </span>
        </div>
        <DataTable
          rows={accountRows}
          columns={accountColumns}
          rowKey={(r) => r.id}
          searchKeys={[
            (r) => r.name,
            (r) => r.handle,
            (r) => PLATFORM_META[r.platform].label,
            (r) => r.market,
          ]}
          searchPlaceholder="Search accounts, handles or markets…"
          exportName="social-accounts"
          initialSort={{ key: "followers", dir: "desc" }}
          pageSize={21}
        />
      </div>
    </div>
  );
}

/* Platform view --------------------------------------------------------- */

export function PlatformView({ platform }: { platform: PlatformId }) {
  const f = useFilters();
  const { country } = useLookups();
  const navigate = useNavigate();
  const meta = PLATFORM_META[platform];
  const [accountId, setAccountId] = useState("all");

  const accounts = useMemo(
    () =>
      accountsForPlatform(platform).filter(
        (a) => !f.countries.length || f.countries.includes(a.countryCode),
      ),
    [platform, f.countries],
  );
  const selected =
    accountId !== "all" && accounts.some((a) => a.id === accountId) ? accountId : "all";

  // Current and previous windows are computed once per filter/account change.
  const { current, previous, rows } = useMemo(() => {
    const prev = previousRange(f.from, f.to);
    const nowRows = accountSnapshots(f.from, f.to, f.countries, platform);
    const prevRows = accountSnapshots(prev.prevFrom, prev.prevTo, f.countries, platform);
    const pickRows = (list: AccountSnapshot[]) =>
      selected === "all" ? list : list.filter((r) => r.id === selected);
    const currentRows = pickRows(nowRows);
    return {
      current: summarise(currentRows),
      previous: summarise(pickRows(prevRows)),
      rows: currentRows,
    };
  }, [f.from, f.to, f.countries, platform, selected]);

  const posts = useMemo(() => {
    const all = postsInRange(f.from, f.to, f.countries, platform);
    return selected === "all" ? all : all.filter((p) => p.accountId === selected);
  }, [f.from, f.to, f.countries, platform, selected]);
  const publishedCount = useMemo(
    () => posts.filter((p) => p.status === "Published").length,
    [posts],
  );

  const spotlight = useMemo(() => topPosts(posts, 4), [posts]);

  const shareLabel = meta.chips.find((c) => c.key === "shares")?.label ?? "Shares";
  const commentLabel = meta.chips.find((c) => c.key === "comments")?.label ?? "Comments";

  const breakdownRows = useMemo(
    () =>
      rows.map((row) => ({ ...row, market: country(row.countryCode)?.name ?? row.countryCode })),
    [rows, country],
  );

  const breakdownColumns = useMemo<Column<(typeof breakdownRows)[number]>[]>(
    () => [
      {
        key: "name",
        header: "Account",
        cell: (r) => (
          <div className="min-w-0">
            <div className="truncate font-medium">{r.name}</div>
            <div className="truncate text-xs text-muted-foreground">{r.handle}</div>
          </div>
        ),
      },
      {
        key: "market",
        header: "Market",
        cell: (r) => <span className="whitespace-nowrap text-xs">{r.market}</span>,
      },
      {
        key: "followers",
        header: "Followers",
        align: "right",
        cell: (r) => fmtCompact(r.followers),
      },
      {
        key: "growthPct",
        header: "Growth",
        align: "right",
        value: (r) => r.growthPct,
        cell: (r) => (
          <span className={r.growthPct >= 0 ? "text-success" : "text-destructive"}>
            {fmtPct(r.growthPct, 2)}
          </span>
        ),
      },
      {
        key: "impressions",
        header: "Impressions",
        align: "right",
        cell: (r) => fmtCompact(r.impressions),
      },
      {
        key: "engagements",
        header: "Engagements",
        align: "right",
        cell: (r) => fmtCompact(r.engagements),
      },
      { key: "likes", header: "Likes", align: "right", cell: (r) => fmtCompact(r.likes) },
      {
        key: "comments",
        header: commentLabel,
        align: "right",
        cell: (r) => fmtCompact(r.comments),
      },
      { key: "shares", header: shareLabel, align: "right", cell: (r) => fmtCompact(r.shares) },
      {
        key: "engagementRate",
        header: "Eng. rate",
        align: "right",
        value: (r) => r.engagementRate,
        cell: (r) => fmtPct(r.engagementRate, 2),
      },
    ],
    [commentLabel, shareLabel],
  );

  const postColumns = useMemo<Column<DemoPost>[]>(
    () => [
      {
        key: "content",
        header: "Post",
        cell: (p) => (
          <div className="max-w-sm min-w-0">
            <div className="line-clamp-2">{p.content.split("\n")[0]}</div>
            <div className="text-xs text-muted-foreground">{accountById(p.accountId)?.name}</div>
          </div>
        ),
      },
      {
        key: "format",
        header: "Format",
        cell: (p) => (
          <Badge variant="muted" className="rounded-full text-[10px]">
            {p.format}
          </Badge>
        ),
      },
      {
        key: "status",
        header: "Status",
        cell: (p) => (
          <Badge
            variant={p.status === "Published" ? "default" : "muted"}
            className="rounded-full text-[10px]"
          >
            {p.status}
          </Badge>
        ),
      },
      {
        key: "publishedAt",
        header: "Date",
        cell: (p) => (
          <span className="num whitespace-nowrap text-xs">{fmtShortDate(p.publishedAt)}</span>
        ),
      },
      {
        key: "impressions",
        header: "Impr.",
        align: "right",
        cell: (p) => (p.status === "Published" ? fmtCompact(p.impressions) : "—"),
      },
      {
        key: "likes",
        header: "Likes",
        align: "right",
        cell: (p) => (p.status === "Published" ? fmtCompact(p.likes) : "—"),
      },
      {
        key: "comments",
        header: commentLabel,
        align: "right",
        cell: (p) => (p.status === "Published" ? fmtCompact(p.comments) : "—"),
      },
      {
        key: "shares",
        header: shareLabel,
        align: "right",
        cell: (p) => (p.status === "Published" ? fmtCompact(p.shares) : "—"),
      },
      {
        key: "engagementRate",
        header: "Eng. rate",
        align: "right",
        value: (p) => p.engagementRate,
        cell: (p) => (p.status === "Published" ? fmtPct(p.engagementRate, 2) : "—"),
      },
      {
        key: "open",
        header: "",
        sortable: false,
        cell: (p) => <ArrowUpRight className="size-3.5 text-muted-foreground" />,
      },
    ],
    [commentLabel, shareLabel],
  );

  return (
    <div className="space-y-4">
      <div className="panel flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-3">
          <span className="size-3 rounded-full" style={{ background: meta.color }} />
          <div>
            <h2 className="text-base font-semibold">{meta.label} accounts</h2>
            <p className="text-xs text-muted-foreground">
              {accounts.length} connected accounts · {fmtCompact(current.followers)} followers ·{" "}
              {fmtPct(current.growthPct, 2)} growth
            </p>
          </div>
        </div>
        <Select value={selected} onValueChange={setAccountId}>
          <SelectTrigger className="h-9 w-full sm:w-72">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All {meta.label} accounts</SelectItem>
            {accounts.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name} · {a.handle}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <KpiGrid cols={4}>
        <KpiCard
          label="Followers"
          value={fmtCompact(current.followers)}
          icon={Users}
          delta={pctChange(current.newFollowers, previous.newFollowers)}
          hint={`${fmtCompact(current.newFollowers)} net new`}
        />
        <KpiCard
          label="Reach"
          value={fmtCompact(current.reach)}
          icon={Eye}
          delta={pctChange(current.reach, previous.reach)}
        />
        <KpiCard
          label="Impressions"
          value={fmtCompact(current.impressions)}
          delta={pctChange(current.impressions, previous.impressions)}
        />
        <KpiCard
          label="Engagements"
          value={fmtCompact(current.engagements)}
          icon={MousePointerClick}
          delta={pctChange(current.engagements, previous.engagements)}
          color={meta.color}
        />
      </KpiGrid>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {meta.chips.map((chip) => (
          <MetricChip key={chip.key} label={chip.label} value={current[chip.key]} />
        ))}
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">Top performing posts</h2>
          <span className="text-xs text-muted-foreground">
            Ranked by engagement rate in the selected range
          </span>
        </div>
        {spotlight.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {spotlight.map((post) => (
              <PostSpotlightCard key={post.id} post={post} />
            ))}
          </div>
        ) : (
          <div className="panel p-6 text-center text-sm text-muted-foreground">
            No published {meta.label} posts in this date range.
          </div>
        )}
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">Account breakdown</h2>
          <span className="text-xs text-muted-foreground">
            {rows.length} {rows.length === 1 ? "account" : "accounts"}
          </span>
        </div>
        <DataTable
          rows={breakdownRows}
          columns={breakdownColumns}
          rowKey={(r) => r.id}
          searchKeys={[(r) => r.name, (r) => r.handle, (r) => r.market]}
          searchPlaceholder="Search accounts…"
          exportName={`${platform}-accounts`}
          initialSort={{ key: "followers", dir: "desc" }}
          pageSize={8}
        />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">Post history</h2>
          <span className="text-xs text-muted-foreground">
            {publishedCount} published · {posts.length - publishedCount} scheduled
          </span>
        </div>
        <DataTable
          rows={posts}
          columns={postColumns}
          rowKey={(p) => p.id}
          onRowClick={(p) => openPost(navigate, p)}
          searchKeys={[(p) => p.content, (p) => p.format, (p) => accountById(p.accountId)?.name]}
          searchPlaceholder="Search posts or formats…"
          exportName={`${platform}-posts`}
          initialSort={{ key: "publishedAt", dir: "desc" }}
        />
      </div>
    </div>
  );
}
