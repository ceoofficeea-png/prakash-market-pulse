/**
 * Live data for the social module.
 *
 * Daily figures come from `social_breakdown` (migration 0011) so the KPIs, the
 * audience split and the trend chart are each one aggregated query instead of
 * paging a large time-series table through the Data API. Account metadata and
 * post history are small tables and are read directly.
 */

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { supabase } from "@/integrations/supabase/client";
import {
  useSocial,
  useSocialAccounts,
  type SocialAccount,
  type SocialPost,
  type SocialRow,
} from "@/lib/api";
import { isPlatformId, type Metrics, type PlatformId } from "@/lib/social-platforms";

/* Shapes ---------------------------------------------------------------- */

export interface AccountSnapshot extends Metrics {
  id: string;
  platform: PlatformId;
  name: string;
  handle: string;
  countryCode: string;
  followers: number;
  engagementRate: number;
  growthPct: number;
}

export interface Totals extends Metrics {
  followers: number;
  engagementRate: number;
  growthPct: number;
  accounts: number;
}

export interface SocialPostRow extends Metrics {
  id: string;
  accountId: string;
  platform: PlatformId;
  content: string;
  format: string;
  status: string;
  publishedAt: string;
  engagementRate: number;
}

/* Pure aggregation ------------------------------------------------------ */

/** PostgREST returns bigint as a number; anything else is treated as zero. */
const num = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

export const emptyMetrics = (): Metrics => ({
  impressions: 0,
  reach: 0,
  engagements: 0,
  likes: 0,
  comments: 0,
  shares: 0,
  saves: 0,
  storyViews: 0,
  videoViews: 0,
  clicks: 0,
  newFollowers: 0,
});

function addMetrics(target: Metrics, add: Metrics) {
  target.impressions += add.impressions;
  target.reach += add.reach;
  target.engagements += add.engagements;
  target.likes += add.likes;
  target.comments += add.comments;
  target.shares += add.shares;
  target.saves += add.saves;
  target.storyViews += add.storyViews;
  target.videoViews += add.videoViews;
  target.clicks += add.clicks;
  target.newFollowers += add.newFollowers;
}

export function summarise(rows: readonly AccountSnapshot[]): Totals {
  const total = emptyMetrics();
  let followers = 0;
  for (const row of rows) {
    addMetrics(total, row);
    followers += row.followers;
  }
  return {
    ...total,
    followers,
    engagementRate: total.impressions ? total.engagements / total.impressions : 0,
    growthPct: followers ? total.newFollowers / followers : 0,
    accounts: rows.length,
  };
}

/** Published posts inside the range, best engagement rate first. */
export function topPosts(posts: readonly SocialPostRow[], limit: number): SocialPostRow[] {
  return posts
    .filter((post) => post.status === "Published" && post.engagementRate > 0)
    .slice()
    .sort((a, b) => b.engagementRate - a.engagementRate)
    .slice(0, limit);
}

export function accountMap(accounts: readonly SocialAccount[] | undefined) {
  return new Map((accounts ?? []).map((account) => [String(account.id), account] as const));
}

function buildSnapshots(
  rows: readonly SocialRow[],
  accounts: readonly SocialAccount[],
): AccountSnapshot[] {
  const byId = new Map(accounts.map((account) => [String(account.id), account] as const));
  const out = new Map<string, AccountSnapshot>();

  for (const row of rows) {
    const account = byId.get(row.key);
    if (!account || !isPlatformId(account.platform)) continue;
    const id = String(account.id);
    const snapshot: AccountSnapshot = out.get(id) ?? {
      id,
      platform: account.platform,
      name: account.name,
      handle: account.handle,
      countryCode: account.country_code ?? "",
      followers: 0,
      engagementRate: 0,
      growthPct: 0,
      ...emptyMetrics(),
    };
    snapshot.impressions += num(row.impressions);
    snapshot.reach += num(row.reach);
    snapshot.engagements += num(row.engagements);
    snapshot.likes += num(row.likes);
    snapshot.comments += num(row.comments);
    snapshot.shares += num(row.shares);
    snapshot.saves += num(row.saves);
    snapshot.storyViews += num(row.story_views);
    snapshot.videoViews += num(row.video_views);
    snapshot.clicks += num(row.clicks);
    snapshot.newFollowers += num(row.new_followers);
    // Followers are cumulative, so the figure is a total, not a sum. Fall back
    // to the account row when the window has no latest-day sample.
    snapshot.followers = num(row.followers) || account.followers;
    out.set(id, snapshot);
  }

  return [...out.values()].map((snapshot) => ({
    ...snapshot,
    engagementRate: snapshot.impressions ? snapshot.engagements / snapshot.impressions : 0,
    growthPct: snapshot.followers ? snapshot.newFollowers / snapshot.followers : 0,
  }));
}

/* Hooks ----------------------------------------------------------------- */

export interface SnapshotResult {
  rows: AccountSnapshot[];
  isLoading: boolean;
  error: string | null;
}

export function useSocialSnapshots(
  from: string,
  to: string,
  opts: { countries: string[]; platform?: PlatformId | undefined },
): SnapshotResult {
  const accounts = useSocialAccounts();
  const query = useSocial("account", {
    from,
    to,
    countries: opts.countries,
    platforms: opts.platform ? [opts.platform] : undefined,
  });
  const rows = useMemo(
    () => buildSnapshots(query.data ?? [], accounts.data ?? []),
    [query.data, accounts.data],
  );
  return {
    rows,
    isLoading: query.isLoading || accounts.isLoading,
    error: query.error?.message ?? accounts.error?.message ?? null,
  };
}

export interface TrendResult {
  data: Record<string, unknown>[];
  isLoading: boolean;
}

const DAY_MS = 86_400_000;

function spanDays(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0;
  return Math.round((end - start) / DAY_MS) + 1;
}

/** Reach or engagement per platform over time, for the comparison chart. */
export function useSocialTrend(
  from: string,
  to: string,
  countries: string[],
  metric: "reach" | "engagements",
): TrendResult {
  // Bucket by week in SQL for long ranges so the response stays well under the
  // API row cap: seven platforms × 92 days, or × 53 weeks.
  const weekly = spanDays(from, to) > 92;
  const query = useSocial(weekly ? "platform_week" : "platform_date", { from, to, countries });

  const data = useMemo(() => {
    const buckets = new Map<string, Record<string, number>>();
    for (const row of query.data ?? []) {
      const [platform, day] = row.key.split("|");
      if (!platform || !day || !isPlatformId(platform)) continue;
      const bucket: Record<string, number> = buckets.get(day) ?? {};
      const value = metric === "reach" ? num(row.reach) : num(row.engagements);
      bucket[platform] = (bucket[platform] ?? 0) + value;
      buckets.set(day, bucket);
    }
    return [...buckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, values]) => ({ key, ...values }));
  }, [query.data, metric]);

  return { data, isLoading: query.isLoading };
}

export interface PostsResult {
  rows: SocialPostRow[];
  isLoading: boolean;
  error: string | null;
}

const toPostRow = (row: SocialPost): SocialPostRow[] => {
  if (!isPlatformId(row.platform)) return [];
  const impressions = num(row.impressions);
  const engagements = num(row.engagements);
  return [
    {
      id: String(row.id),
      accountId: String(row.account_id),
      platform: row.platform,
      content: row.content,
      format: row.format,
      status: row.status,
      publishedAt: row.published_at,
      impressions,
      reach: num(row.reach),
      engagements,
      likes: num(row.likes),
      comments: num(row.comments),
      shares: num(row.shares),
      saves: num(row.saves),
      storyViews: num(row.story_views),
      videoViews: num(row.video_views),
      clicks: num(row.clicks),
      newFollowers: 0,
      engagementRate: impressions ? engagements / impressions : 0,
    },
  ];
};

export function useSocialPosts(
  from: string,
  to: string,
  opts: { countries: string[]; platform?: PlatformId | undefined },
): PostsResult {
  const query = useQuery({
    queryKey: ["social_posts", from, to, opts.countries, opts.platform],
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<SocialPostRow[]> => {
      // Scheduled posts stay visible outside the window, the way the module
      // has always shown the publishing queue.
      let request = supabase
        .from("social_posts")
        .select("*")
        .or(
          `and(published_at.gte.${from}T00:00:00Z,published_at.lte.${to}T23:59:59Z),status.eq.Scheduled`,
        )
        .order("published_at", { ascending: false })
        .limit(1000);
      if (opts.platform) request = request.eq("platform", opts.platform);
      if (opts.countries.length) request = request.in("country_code", opts.countries);
      const { data, error } = await request;
      if (error) throw new Error(error.message);
      return (data ?? []).flatMap(toPostRow);
    },
  });
  return {
    rows: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error?.message ?? null,
  };
}

export interface PostDetailResult {
  post: SocialPostRow | null;
  peers: SocialPostRow[];
}

export function useSocialPostDetail(postId: string) {
  return useQuery({
    queryKey: ["social_post", postId],
    queryFn: async (): Promise<PostDetailResult> => {
      const id = Number(postId);
      if (!Number.isInteger(id)) return { post: null, peers: [] };
      const { data, error } = await supabase
        .from("social_posts")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return { post: null, peers: [] };
      const post = toPostRow(data)[0] ?? null;
      if (!post) return { post: null, peers: [] };
      const { data: peers, error: peerError } = await supabase
        .from("social_posts")
        .select("*")
        .eq("account_id", data.account_id)
        .eq("status", "Published")
        .neq("id", id)
        .order("published_at", { ascending: false })
        .limit(100);
      if (peerError) throw new Error(peerError.message);
      return { post, peers: (peers ?? []).flatMap(toPostRow) };
    },
  });
}
