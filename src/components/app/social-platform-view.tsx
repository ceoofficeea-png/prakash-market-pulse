import { useNavigate } from "@tanstack/react-router";
import { ArrowUpRight, Eye, MousePointerClick, Users } from "lucide-react";
import { useMemo, useState } from "react";

import { ChartCard, DonutChart, LinesChart } from "@/components/app/charts";
import { DataTable, type Column } from "@/components/app/data-table";
import { KpiCard } from "@/components/app/kpi-card";
import { KpiGrid, LoadingBlock } from "@/components/app/page";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLookups, useSocialAccounts } from "@/lib/api";
import { useFilters } from "@/lib/filters";
import { fmtCompact, fmtPct, fmtShortDate, pctChange } from "@/lib/format";
import { previousRange } from "@/lib/periods";
import {
  accountMap,
  summarise,
  topPosts,
  useSocialPosts,
  useSocialSnapshots,
  useSocialTrend,
  type AccountSnapshot,
  type SocialPostRow,
} from "@/lib/social-data";
import { PLATFORM_META, PLATFORM_ORDER, type PlatformId } from "@/lib/social-platforms";

const openPost = (navigate: ReturnType<typeof useNavigate>, post: SocialPostRow) =>
  navigate({ to: "/social/$postId", params: { postId: post.id } });

const marketName = (
  country: (code?: string | null) => { name: string } | undefined,
  code: string,
) => country(code)?.name ?? (code || "Global");

/* Shared states --------------------------------------------------------- */

function StatePanel({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="panel p-8 text-center">
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{detail}</p>
    </div>
  );
}

/* Spotlight card -------------------------------------------------------- */

function PostSpotlightCard({ post }: { post: SocialPostRow }) {
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

  const current = useSocialSnapshots(f.from, f.to, { countries: f.countries });
  const prev = previousRange(f.from, f.to);
  const previous = useSocialSnapshots(prev.prevFrom, prev.prevTo, { countries: f.countries });
  const posts = useSocialPosts(f.from, f.to, { countries: f.countries });
  const trend = useSocialTrend(f.from, f.to, f.countries, metric);

  const rows = current.rows;
  const c = useMemo(() => summarise(rows), [rows]);
  const p = useMemo(() => summarise(previous.rows), [previous.rows]);

  const audience = useMemo(
    () =>
      PLATFORM_ORDER.flatMap((platform) => {
        const followers = rows.reduce(
          (total, row) => (row.platform === platform ? total + row.followers : total),
          0,
        );
        if (!followers) return [];
        const meta = PLATFORM_META[platform];
        return [{ id: platform, name: meta.label, value: followers, color: meta.color }];
      }),
    [rows],
  );

  const spotlight = useMemo(() => topPosts(posts.rows, 5), [posts.rows]);

  const accountRows = useMemo(
    () => rows.map((row) => ({ ...row, market: marketName(country, row.countryCode) })),
    [rows, country],
  );

  const accountColumns = useMemo<Column<(typeof accountRows)[number]>[]>(
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

  if (current.error) {
    return (
      <StatePanel
        title="Social data could not be loaded"
        detail={current.error}
      />
    );
  }

  if (current.isLoading && !rows.length) return <LoadingBlock />;

  if (!rows.length) {
    return (
      <StatePanel
        title="No social accounts in this selection"
        detail="No daily rows exist for this date range and market. Widen the range or load the accounts' daily metrics."
      />
    );
  }

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
            data={audience}
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
            data={trend.data}
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

  const accountsQuery = useSocialAccounts();
  const accounts = useMemo(
    () =>
      (accountsQuery.data ?? []).filter(
        (account) =>
          account.platform === platform &&
          (!f.countries.length ||
            (account.country_code !== null && f.countries.includes(account.country_code))),
      ),
    [accountsQuery.data, platform, f.countries],
  );
  const selected =
    accountId !== "all" && accounts.some((a) => String(a.id) === accountId) ? accountId : "all";

  const current = useSocialSnapshots(f.from, f.to, { countries: f.countries, platform });
  const prev = previousRange(f.from, f.to);
  const previous = useSocialSnapshots(prev.prevFrom, prev.prevTo, {
    countries: f.countries,
    platform,
  });
  const posts = useSocialPosts(f.from, f.to, { countries: f.countries, platform });

  const pickRows = useMemo(
    () => (list: AccountSnapshot[]) =>
      selected === "all" ? list : list.filter((row) => row.id === selected),
    [selected],
  );

  const rows = useMemo(() => pickRows(current.rows), [pickRows, current.rows]);
  const c = useMemo(() => summarise(rows), [rows]);
  const p = useMemo(() => summarise(pickRows(previous.rows)), [pickRows, previous.rows]);

  const accountById = useMemo(() => accountMap(accountsQuery.data), [accountsQuery.data]);

  const platformPosts = useMemo(
    () =>
      selected === "all" ? posts.rows : posts.rows.filter((post) => post.accountId === selected),
    [posts.rows, selected],
  );
  const publishedCount = useMemo(
    () => platformPosts.filter((post) => post.status === "Published").length,
    [platformPosts],
  );
  const spotlight = useMemo(() => topPosts(platformPosts, 4), [platformPosts]);

  const shareLabel = meta.chips.find((chip) => chip.key === "shares")?.label ?? "Shares";
  const commentLabel = meta.chips.find((chip) => chip.key === "comments")?.label ?? "Comments";

  const breakdownRows = useMemo(
    () => rows.map((row) => ({ ...row, market: marketName(country, row.countryCode) })),
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

  const postColumns = useMemo<Column<SocialPostRow>[]>(
    () => [
      {
        key: "content",
        header: "Post",
        cell: (p) => (
          <div className="max-w-sm min-w-0">
            <div className="line-clamp-2">{p.content.split("\n")[0]}</div>
            <div className="text-xs text-muted-foreground">
              {accountById.get(p.accountId)?.name}
            </div>
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
        cell: () => <ArrowUpRight className="size-3.5 text-muted-foreground" />,
      },
    ],
    [accountById, commentLabel, shareLabel],
  );

  if (current.error) {
    return <StatePanel title="Social data could not be loaded" detail={current.error} />;
  }

  if (current.isLoading && !rows.length) return <LoadingBlock />;

  if (!rows.length) {
    return (
      <StatePanel
        title={`No ${meta.label} data in this selection`}
        detail={`No ${meta.label} account has daily rows for this date range and market. Widen the range or check the account's country.`}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="panel flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-3">
          <span className="size-3 rounded-full" style={{ background: meta.color }} />
          <div>
            <h2 className="text-base font-semibold">{meta.label} accounts</h2>
            <p className="text-xs text-muted-foreground">
              {accounts.length} connected accounts · {fmtCompact(c.followers)} followers ·{" "}
              {fmtPct(c.growthPct, 2)} growth
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
              <SelectItem key={a.id} value={String(a.id)}>
                {a.name} · {a.handle}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <KpiGrid cols={4}>
        <KpiCard
          label="Followers"
          value={fmtCompact(c.followers)}
          icon={Users}
          delta={pctChange(c.newFollowers, p.newFollowers)}
          hint={`${fmtCompact(c.newFollowers)} net new`}
        />
        <KpiCard
          label="Reach"
          value={fmtCompact(c.reach)}
          icon={Eye}
          delta={pctChange(c.reach, p.reach)}
        />
        <KpiCard
          label="Impressions"
          value={fmtCompact(c.impressions)}
          delta={pctChange(c.impressions, p.impressions)}
        />
        <KpiCard
          label="Engagements"
          value={fmtCompact(c.engagements)}
          icon={MousePointerClick}
          delta={pctChange(c.engagements, p.engagements)}
          color={meta.color}
        />
      </KpiGrid>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {meta.chips.map((chip) => (
          <MetricChip key={chip.key} label={chip.label} value={c[chip.key]} />
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
            {publishedCount} published · {platformPosts.length - publishedCount} scheduled
          </span>
        </div>
        <DataTable
          rows={platformPosts}
          columns={postColumns}
          rowKey={(p) => p.id}
          onRowClick={(p) => openPost(navigate, p)}
          searchKeys={[
            (p) => p.content,
            (p) => p.format,
            (p) => accountById.get(p.accountId)?.name,
          ]}
          searchPlaceholder="Search posts or formats…"
          exportName={`${platform}-posts`}
          initialSort={{ key: "publishedAt", dir: "desc" }}
        />
      </div>
    </div>
  );
}
