import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useFilters } from "@/lib/filters";
import { primaryRole, type AppRole } from "@/lib/permissions";

type Tables = Database["public"]["Tables"];
export type Row<T extends keyof Tables> = Tables[T]["Row"];

export type Country = Row<"countries">;
export type Product = Row<"products">;
export type TeamMember = Row<"team_members">;
export type Campaign = Row<"campaigns">;
export type Lead = Row<"leads">;
export type ContentItem = Row<"content_items">;
export type SocialPost = Row<"social_posts">;
export type SocialAccount = Row<"social_accounts">;
export type Competitor = Row<"competitors">;
export type AiInsight = Row<"ai_insights">;

export type MetricsRow = Database["public"]["Functions"]["metrics_breakdown"]["Returns"][number];
export type WebRow = Database["public"]["Functions"]["web_breakdown"]["Returns"][number];
export type SocialRow = Database["public"]["Functions"]["social_breakdown"]["Returns"][number];

const REF = { staleTime: 5 * 60_000 };

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

/* ---------- Current user ---------- */
export function useCurrentUser() {
  return useQuery({
    queryKey: ["me"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (!user) return null;
      const [profile, roles] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id),
      ]);
      const roleList = (roles.data ?? []).map((r) => r.role as AppRole);
      return {
        id: user.id,
        email: user.email ?? "",
        profile: profile.data,
        roles: roleList,
        role: primaryRole(roleList),
      };
    },
  });
}

/* ---------- Reference data ---------- */
export const useCountries = () =>
  useQuery({ queryKey: ["countries"], ...REF, queryFn: async () => unwrap(await supabase.from("countries").select("*").order("name")) });
export const useProducts = () =>
  useQuery({ queryKey: ["products"], ...REF, queryFn: async () => unwrap(await supabase.from("products").select("*").order("name")) });
export const useTeam = () =>
  useQuery({ queryKey: ["team_members"], ...REF, queryFn: async () => unwrap(await supabase.from("team_members").select("*").order("id")) });
export const useCampaigns = () =>
  useQuery({ queryKey: ["campaigns"], ...REF, queryFn: async () => unwrap(await supabase.from("campaigns").select("*").order("start_date", { ascending: false })) });

export function useLookups() {
  const countries = useCountries();
  const products = useProducts();
  const team = useTeam();
  const campaigns = useCampaigns();
  const byCode = new Map((countries.data ?? []).map((c) => [c.code, c]));
  const productById = new Map((products.data ?? []).map((p) => [p.id, p]));
  const memberById = new Map((team.data ?? []).map((m) => [m.id, m]));
  const campaignById = new Map((campaigns.data ?? []).map((c) => [c.id, c]));
  return {
    countries: countries.data ?? [],
    products: products.data ?? [],
    team: team.data ?? [],
    campaigns: campaigns.data ?? [],
    country: (code?: string | null) => (code ? byCode.get(code) : undefined),
    product: (id?: string | null) => (id ? productById.get(id) : undefined),
    member: (id?: number | null) => (id != null ? memberById.get(id) : undefined),
    campaign: (id?: number | null) => (id != null ? campaignById.get(id) : undefined),
    loading: countries.isLoading || products.isLoading || team.isLoading || campaigns.isLoading,
  };
}

/* ---------- Aggregations ---------- */
interface MetricsOpts {
  from?: string | undefined;
  to?: string | undefined;
  countries?: string[] | undefined;
  platforms?: string[] | undefined;
  campaigns?: number[] | undefined;
  ignoreFilters?: boolean | undefined;
}

const arr = <T,>(a?: T[]) => (a && a.length ? a : undefined);

/** Drop undefined keys so optional RPC args are simply omitted. */
function clean<T extends object>(o: T) {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as { [K in keyof T]: Exclude<T[K], undefined> };
}

export function useMetrics(dim: string, opts: MetricsOpts = {}) {
  const f = useFilters();
  const params = clean({
    p_dim: dim,
    p_from: opts.from ?? f.from,
    p_to: opts.to ?? f.to,
    p_countries: arr(opts.countries ?? (opts.ignoreFilters ? [] : f.countries)),
    p_platforms: arr(opts.platforms ?? (opts.ignoreFilters ? [] : f.platforms)),
    p_campaigns: arr(opts.campaigns ?? (opts.ignoreFilters ? [] : f.campaigns)),
  });
  return useQuery({
    queryKey: ["metrics", params],
    placeholderData: keepPreviousData,
    queryFn: async () => unwrap(await supabase.rpc("metrics_breakdown", params)) as MetricsRow[],
  });
}

export function useWeb(dim: string, opts: { from?: string | undefined; to?: string | undefined; countries?: string[] | undefined; sources?: string[] | undefined } = {}) {
  const f = useFilters();
  const params = clean({
    p_dim: dim,
    p_from: opts.from ?? f.from,
    p_to: opts.to ?? f.to,
    p_countries: arr(opts.countries ?? f.countries),
    p_sources: arr(opts.sources),
  });
  return useQuery({
    queryKey: ["web", params],
    placeholderData: keepPreviousData,
    queryFn: async () => unwrap(await supabase.rpc("web_breakdown", params)) as WebRow[],
  });
}

export function useSocial(dim: string, opts: { from?: string | undefined; to?: string | undefined; platforms?: string[] | undefined; countries?: string[] | undefined } = {}) {
  const f = useFilters();
  const params = clean({
    p_dim: dim,
    p_from: opts.from ?? f.from,
    p_to: opts.to ?? f.to,
    p_platforms: arr(opts.platforms),
    p_countries: arr(opts.countries),
  });
  return useQuery({
    queryKey: ["social", params],
    placeholderData: keepPreviousData,
    queryFn: async () => unwrap(await supabase.rpc("social_breakdown", params)) as SocialRow[],
  });
}

export function totals(rows: MetricsRow[] | undefined) {
  const t = { impressions: 0, clicks: 0, spend: 0, conversions: 0, leads: 0, revenue: 0 };
  for (const r of rows ?? []) {
    t.impressions += Number(r.impressions);
    t.clicks += Number(r.clicks);
    t.spend += Number(r.spend);
    t.conversions += Number(r.conversions);
    t.leads += Number(r.leads);
    t.revenue += Number(r.revenue);
  }
  return t;
}

/* ---------- Tables ---------- */
export const useLeads = () =>
  useQuery({ queryKey: ["leads"], queryFn: async () => unwrap(await supabase.from("leads").select("*").order("created_at", { ascending: false })) });
export const useLead = (id: number) =>
  useQuery({
    queryKey: ["leads", id],
    queryFn: async (): Promise<Lead | null> => {
      const { data, error } = await supabase.from("leads").select("*").eq("id", id).maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
  });
export const useLeadActivities = (leadId: number) =>
  useQuery({
    queryKey: ["lead_activities", leadId],
    queryFn: async () => unwrap(await supabase.from("lead_activities").select("*").eq("lead_id", leadId).order("occurred_at", { ascending: false })),
  });

export const useContent = () =>
  useQuery({ queryKey: ["content_items"], queryFn: async () => unwrap(await supabase.from("content_items").select("*").order("created_at", { ascending: false })) });

export const useSocialPosts = () =>
  useQuery({ queryKey: ["social_posts"], queryFn: async () => unwrap(await supabase.from("social_posts").select("*").order("published_at", { ascending: false })) });
export const useSocialAccounts = () =>
  useQuery({ queryKey: ["social_accounts"], ...REF, queryFn: async () => unwrap(await supabase.from("social_accounts").select("*").order("followers", { ascending: false })) });

export const useWebPages = () =>
  useQuery({ queryKey: ["web_pages"], ...REF, queryFn: async () => unwrap(await supabase.from("web_pages").select("*").order("pageviews", { ascending: false })) });
export const useKeywords = () =>
  useQuery({ queryKey: ["seo_keywords"], ...REF, queryFn: async () => unwrap(await supabase.from("seo_keywords").select("*").order("search_volume", { ascending: false })) });

export const useCompetitors = () =>
  useQuery({ queryKey: ["competitors"], ...REF, queryFn: async () => unwrap(await supabase.from("competitors").select("*").order("market_share", { ascending: false })) });
export const useCompetitorMonthly = () =>
  useQuery({ queryKey: ["competitor_monthly"], ...REF, queryFn: async () => unwrap(await supabase.from("competitor_monthly").select("*").order("month")) });
export const useCompetitorActivities = () =>
  useQuery({ queryKey: ["competitor_activities"], queryFn: async () => unwrap(await supabase.from("competitor_activities").select("*").order("date", { ascending: false })) });

export const useTasks = () =>
  useQuery({ queryKey: ["team_tasks"], queryFn: async () => unwrap(await supabase.from("team_tasks").select("*").order("due_date", { ascending: false })) });
export const useKpis = () =>
  useQuery({ queryKey: ["team_monthly_kpis"], queryFn: async () => unwrap(await supabase.from("team_monthly_kpis").select("*").order("month")) });

export const useInsights = () =>
  useQuery({ queryKey: ["ai_insights"], queryFn: async () => unwrap(await supabase.from("ai_insights").select("*").order("created_at", { ascending: false })) });
export const useReports = () =>
  useQuery({ queryKey: ["reports"], queryFn: async () => unwrap(await supabase.from("reports").select("*").order("id")) });
export const useConnections = () =>
  useQuery({ queryKey: ["api_connections"], queryFn: async () => unwrap(await supabase.from("api_connections").select("*").order("id")) });
