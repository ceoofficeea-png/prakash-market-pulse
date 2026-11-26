/**
 * Deterministic demo fixtures for the social module.
 *
 * Everything here is generated from fixed seeds, so the numbers are stable
 * between renders and between the current/previous period windows. Nothing in
 * this file reads provider data or writes shared records.
 */

export type PlatformId =
  "facebook" | "instagram" | "linkedin" | "youtube" | "x" | "snapchat" | "tiktok";

export type NativeKey =
  "likes" | "comments" | "shares" | "saves" | "storyViews" | "videoViews" | "clicks";

export interface Metrics {
  impressions: number;
  reach: number;
  engagements: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  storyViews: number;
  videoViews: number;
  clicks: number;
  newFollowers: number;
}

interface PlatformMeta {
  id: PlatformId;
  label: string;
  tabLabel: string;
  color: string;
  /** Platform-native breakdown metrics shown as chips / KPI extras. */
  chips: { key: NativeKey; label: string }[];
  /** Per-impression rates. Keys not used by a network stay at zero. */
  rates: Record<NativeKey, number>;
  /** Fraction of followers reached per day. */
  dailyReach: number;
  /** Fraction of followers gained per day. */
  dailyGrowth: number;
  formats: string[];
}

export interface DemoAccount {
  id: string;
  platform: PlatformId;
  name: string;
  handle: string;
  countryCode: string;
  followers: number;
}

export interface AccountSnapshot extends DemoAccount, Metrics {
  engagementRate: number;
  growthPct: number;
}

export interface Totals extends Metrics {
  followers: number;
  engagementRate: number;
  growthPct: number;
  accounts: number;
}

export interface DemoPost extends Metrics {
  id: string;
  platform: PlatformId;
  accountId: string;
  content: string;
  format: string;
  status: "Published" | "Scheduled";
  publishedAt: string;
  engagementRate: number;
}

const DAY_MS = 86_400_000;
const MAX_DAYS = 400;

export const PLATFORM_ORDER: PlatformId[] = [
  "facebook",
  "instagram",
  "linkedin",
  "youtube",
  "x",
  "snapchat",
  "tiktok",
];

export const PLATFORM_META: Record<PlatformId, PlatformMeta> = {
  facebook: {
    id: "facebook",
    label: "Facebook",
    tabLabel: "Facebook",
    color: "var(--chart-3)",
    chips: [
      { key: "likes", label: "Likes" },
      { key: "comments", label: "Comments" },
      { key: "shares", label: "Shares" },
    ],
    rates: {
      likes: 0.048,
      comments: 0.007,
      shares: 0.006,
      saves: 0,
      storyViews: 0,
      videoViews: 0.34,
      clicks: 0.005,
    },
    dailyReach: 0.018,
    dailyGrowth: 0.0005,
    formats: ["Image", "Carousel", "Reel", "Video", "Link"],
  },
  instagram: {
    id: "instagram",
    label: "Instagram",
    tabLabel: "Instagram",
    color: "var(--chart-1)",
    chips: [
      { key: "likes", label: "Likes" },
      { key: "comments", label: "Comments" },
      { key: "shares", label: "Shares" },
      { key: "saves", label: "Saves" },
    ],
    rates: {
      likes: 0.058,
      comments: 0.006,
      shares: 0.004,
      saves: 0.012,
      storyViews: 0.42,
      videoViews: 0.51,
      clicks: 0.003,
    },
    dailyReach: 0.05,
    dailyGrowth: 0.0007,
    formats: ["Reel", "Carousel", "Story", "Image"],
  },
  linkedin: {
    id: "linkedin",
    label: "LinkedIn",
    tabLabel: "LinkedIn",
    color: "var(--chart-2)",
    chips: [
      { key: "likes", label: "Likes" },
      { key: "comments", label: "Comments" },
      { key: "shares", label: "Reposts" },
      { key: "clicks", label: "Link clicks" },
    ],
    rates: {
      likes: 0.038,
      comments: 0.005,
      shares: 0.003,
      saves: 0.002,
      storyViews: 0,
      videoViews: 0.28,
      clicks: 0.009,
    },
    dailyReach: 0.028,
    dailyGrowth: 0.0009,
    formats: ["Document", "Image", "Text", "Video"],
  },
  youtube: {
    id: "youtube",
    label: "YouTube",
    tabLabel: "YouTube",
    color: "var(--chart-5)",
    chips: [
      { key: "likes", label: "Likes" },
      { key: "comments", label: "Comments" },
      { key: "shares", label: "Shares" },
      { key: "videoViews", label: "Video views" },
    ],
    rates: {
      likes: 0.042,
      comments: 0.0035,
      shares: 0.0018,
      saves: 0.004,
      storyViews: 0,
      videoViews: 0.62,
      clicks: 0.004,
    },
    dailyReach: 0.032,
    dailyGrowth: 0.0006,
    formats: ["Short", "Long-form video", "Video"],
  },
  x: {
    id: "x",
    label: "X",
    tabLabel: "X (Twitter)",
    color: "var(--chart-6)",
    chips: [
      { key: "likes", label: "Likes" },
      { key: "comments", label: "Replies" },
      { key: "shares", label: "Reposts" },
    ],
    rates: {
      likes: 0.032,
      comments: 0.0035,
      shares: 0.005,
      saves: 0,
      storyViews: 0,
      videoViews: 0.22,
      clicks: 0.006,
    },
    dailyReach: 0.022,
    dailyGrowth: 0.0003,
    formats: ["Text", "Image", "Thread", "Video"],
  },
  snapchat: {
    id: "snapchat",
    label: "Snapchat",
    tabLabel: "Snapchat",
    color: "var(--chart-4)",
    chips: [
      { key: "storyViews", label: "Story views" },
      { key: "comments", label: "Replies" },
      { key: "shares", label: "Shares" },
    ],
    rates: {
      likes: 0,
      comments: 0.0035,
      shares: 0.0028,
      saves: 0.002,
      storyViews: 0.55,
      videoViews: 0.4,
      clicks: 0.002,
    },
    dailyReach: 0.06,
    dailyGrowth: 0.0004,
    formats: ["Story", "Spotlight", "Video"],
  },
  tiktok: {
    id: "tiktok",
    label: "TikTok",
    tabLabel: "TikTok",
    color: "var(--chart-7)",
    chips: [
      { key: "likes", label: "Likes" },
      { key: "comments", label: "Comments" },
      { key: "shares", label: "Shares" },
      { key: "videoViews", label: "Video views" },
    ],
    rates: {
      likes: 0.085,
      comments: 0.005,
      shares: 0.007,
      saves: 0.009,
      storyViews: 0,
      videoViews: 0.74,
      clicks: 0.002,
    },
    dailyReach: 0.07,
    dailyGrowth: 0.0013,
    formats: ["Short video", "Duet", "Trend"],
  },
};

const ACCOUNTS: DemoAccount[] = [
  {
    id: "fb-global",
    platform: "facebook",
    name: "Prakash Pumps Global",
    handle: "@prakashpumps",
    countryCode: "AE",
    followers: 184_300,
  },
  {
    id: "fb-india",
    platform: "facebook",
    name: "Prakash Pumps India",
    handle: "@prakashpumpsindia",
    countryCode: "IN",
    followers: 96_800,
  },
  {
    id: "fb-agro",
    platform: "facebook",
    name: "Prakash Agro Solutions",
    handle: "@prakashagro",
    countryCode: "KE",
    followers: 41_200,
  },

  {
    id: "ig-india",
    platform: "instagram",
    name: "Prakash Pumps India",
    handle: "@prakashpumps",
    countryCode: "IN",
    followers: 212_400,
  },
  {
    id: "ig-global",
    platform: "instagram",
    name: "Prakash Pumps Global",
    handle: "@prakashpumps_global",
    countryCode: "AE",
    followers: 118_700,
  },
  {
    id: "ig-agro",
    platform: "instagram",
    name: "Prakash Agro Solutions",
    handle: "@prakashagro",
    countryCode: "KE",
    followers: 64_300,
  },
  {
    id: "ig-motors",
    platform: "instagram",
    name: "Prakash Motors",
    handle: "@prakashmotors",
    countryCode: "IN",
    followers: 38_900,
  },
  {
    id: "ig-service",
    platform: "instagram",
    name: "Prakash Service Network",
    handle: "@prakashservice",
    countryCode: "AE",
    followers: 27_600,
  },

  {
    id: "li-corporate",
    platform: "linkedin",
    name: "Prakash Pump Corporate",
    handle: "Prakash Pump Corporate",
    countryCode: "AE",
    followers: 58_400,
  },
  {
    id: "li-agro",
    platform: "linkedin",
    name: "Prakash Agro Industrial",
    handle: "Prakash Agro Industrial",
    countryCode: "IN",
    followers: 31_700,
  },

  {
    id: "yt-pumps",
    platform: "youtube",
    name: "Prakash Pumps",
    handle: "@prakashpumps",
    countryCode: "IN",
    followers: 74_900,
  },
  {
    id: "yt-service",
    platform: "youtube",
    name: "Prakash Pump Service",
    handle: "@prakashpumpservice",
    countryCode: "AE",
    followers: 42_300,
  },
  {
    id: "yt-agro",
    platform: "youtube",
    name: "Prakash Agro Machinery",
    handle: "@prakashagromachinery",
    countryCode: "KE",
    followers: 21_800,
  },

  {
    id: "x-pumps",
    platform: "x",
    name: "Prakash Pumps",
    handle: "@prakashpumps",
    countryCode: "IN",
    followers: 26_400,
  },
  {
    id: "x-agro",
    platform: "x",
    name: "Prakash Agro",
    handle: "@prakash_agro",
    countryCode: "KE",
    followers: 12_800,
  },
  {
    id: "x-service",
    platform: "x",
    name: "Prakash Service",
    handle: "@prakashservice",
    countryCode: "AE",
    followers: 8_900,
  },

  {
    id: "sc-pumps",
    platform: "snapchat",
    name: "Prakash Pumps",
    handle: "@prakashpumps",
    countryCode: "IN",
    followers: 19_700,
  },
  {
    id: "sc-agro",
    platform: "snapchat",
    name: "Prakash Agro",
    handle: "@prakashagro",
    countryCode: "KE",
    followers: 11_400,
  },
  {
    id: "sc-motors",
    platform: "snapchat",
    name: "Prakash Motors",
    handle: "@prakashmotors",
    countryCode: "AE",
    followers: 7_300,
  },

  {
    id: "tt-shorts",
    platform: "tiktok",
    name: "Prakash Pumps Shorts",
    handle: "@prakashpumps_shorts",
    countryCode: "IN",
    followers: 143_600,
  },
  {
    id: "tt-global",
    platform: "tiktok",
    name: "Prakash Pumps Global",
    handle: "@prakashpumps_global",
    countryCode: "AE",
    followers: 68_200,
  },
];

export const SOCIAL_ACCOUNTS: readonly DemoAccount[] = ACCOUNTS;

export const accountsForPlatform = (platform: PlatformId) =>
  SOCIAL_ACCOUNTS.filter((a) => a.platform === platform);

export const accountById = (id: string) => SOCIAL_ACCOUNTS.find((a) => a.id === id);

/* Deterministic helpers ------------------------------------------------- */

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function noise(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function pick<T>(list: readonly T[], index: number): T {
  const value = list[Math.abs(index) % list.length];
  if (value === undefined) throw new Error("Cannot pick from an empty list");
  return value;
}

const emptyMetrics = (): Metrics => ({
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

const dayIndexOf = (iso: string) =>
  Math.floor(Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) / DAY_MS);

const isoDay = (dayIndex: number) => new Date(dayIndex * DAY_MS).toISOString().slice(0, 10);

/** Slow, monotonic growth so the current window differs meaningfully from the one before it. */
const TREND_ANCHOR = dayIndexOf("2026-01-01");
const trendFactor = (dayIndex: number) => 1 + Math.max(0, dayIndex - TREND_ANCHOR) * 0.0006;

/** Inclusive list of UTC day indexes, capped so a bad range cannot hang the page. */
function dayRange(from: string, to: string): number[] {
  const start = dayIndexOf(from);
  const end = dayIndexOf(to);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return [];
  const days: number[] = [];
  for (let d = start; d <= end && days.length < MAX_DAYS; d++) days.push(d);
  return days;
}

function matchesCountries(account: DemoAccount | undefined, countries: string[]): boolean {
  if (!account) return false;
  return !countries.length || countries.includes(account.countryCode);
}

function accountDay(account: DemoAccount, dayIndex: number): Metrics {
  const meta = PLATFORM_META[account.platform];
  const seed = hash(account.id) + dayIndex * 2654435761;
  const wobble = 0.72 + 0.56 * noise(seed);
  const weekday = new Date(dayIndex * DAY_MS).getUTCDay();
  const weekend = weekday === 0 || weekday === 6 ? 0.88 : 1;
  const trend = trendFactor(dayIndex);
  const impressions = Math.round(account.followers * meta.dailyReach * wobble * weekend * trend);
  const r = meta.rates;
  const likes = Math.round(impressions * r.likes);
  const comments = Math.round(impressions * r.comments);
  const shares = Math.round(impressions * r.shares);
  const saves = Math.round(impressions * r.saves);
  return {
    impressions,
    reach: Math.round(impressions * 0.78),
    engagements: likes + comments + shares + saves,
    likes,
    comments,
    shares,
    saves,
    storyViews: Math.round(impressions * r.storyViews),
    videoViews: Math.round(impressions * r.videoViews),
    clicks: Math.round(impressions * r.clicks),
    newFollowers: Math.round(
      account.followers * meta.dailyGrowth * (0.6 + 0.8 * noise(seed + 5)) * trend,
    ),
  };
}

/* Range aggregation ----------------------------------------------------- */

export function accountSnapshots(
  from: string,
  to: string,
  countries: string[],
  platform?: PlatformId,
): AccountSnapshot[] {
  const days = dayRange(from, to);
  return SOCIAL_ACCOUNTS.filter(
    (a) => (!platform || a.platform === platform) && matchesCountries(a, countries),
  ).map((account) => {
    const metrics = emptyMetrics();
    for (const day of days) {
      const d = accountDay(account, day);
      addMetrics(metrics, d);
    }
    return {
      ...account,
      ...metrics,
      engagementRate: metrics.impressions ? metrics.engagements / metrics.impressions : 0,
      growthPct: account.followers ? metrics.newFollowers / account.followers : 0,
    };
  });
}

export function summarise(rows: AccountSnapshot[]): Totals {
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

/** Daily (or weekly for long ranges) reach/engagement per platform, for the comparison chart. */
export function trendByPlatform(
  from: string,
  to: string,
  countries: string[],
  metric: "reach" | "engagements",
): Record<string, unknown>[] {
  const days = dayRange(from, to);
  if (!days.length) return [];
  const weekly = days.length > 92;
  const buckets = new Map<string, Record<string, number>>();
  const accounts = SOCIAL_ACCOUNTS.filter((a) => matchesCountries(a, countries));

  for (const account of accounts) {
    for (const day of days) {
      const key = weekly
        ? isoDay(day - ((new Date(day * DAY_MS).getUTCDay() + 6) % 7))
        : isoDay(day);
      const bucket = buckets.get(key) ?? {};
      bucket[account.platform] = (bucket[account.platform] ?? 0) + accountDay(account, day)[metric];
      buckets.set(key, bucket);
    }
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, values]) => ({ key, ...values }));
}

/* Posts ----------------------------------------------------------------- */

const PRODUCTS = [
  "5HP monoblock pump",
  "solar pump controller",
  "1HP self-priming pump",
  "submersible pump set",
  "drip irrigation kit",
  "open-well pump",
  "3HP agricultural pump",
  "pressure booster pump",
];

const HASHTAGS: Record<PlatformId, string> = {
  facebook: "#PrakashPumps #Irrigation #MadeInIndia",
  instagram: "#PrakashPumps #FarmLife #AgriTech #WaterForAll",
  linkedin: "#WaterManagement #AgriBusiness #Engineering",
  youtube: "#PrakashPumps #Shorts #Irrigation",
  x: "#PrakashPumps",
  snapchat: "#PrakashPumps #FarmLife",
  tiktok: "#PrakashPumps #FarmTok #AgriTok",
};

const COPY: Record<PlatformId, string[]> = {
  facebook: [
    "Monsoon-ready pumping without the downtime. Meet the {product} — built for Indian farms and backed by a 2-year onsite warranty.",
    "From borewell to drip line, one {product} does the work of three. Book a free site assessment this week.",
    "Our dealers in Pune, Nashik and Coimbatore now stock the {product}. Walk in for a live demo and an exchange quote on your old pump.",
    "Field note: a 4-acre sugarcane plot cut watering time from 6 hours to 90 minutes after switching to the {product}.",
    "Service camps this Saturday across all Prakash dealerships. Bring your pump for a free efficiency check.",
  ],
  instagram: [
    "Drip by drip, season after season. The {product} is engineered for real farm conditions.",
    "Swipe to see how the {product} handles a 90-foot borewell without losing pressure. Full test in our reel.",
    "Farmers in Jalgaon asked for lower running costs. Here is what the {product} delivered: 38% less power per hour.",
    "Install day in Nashik. One {product}, two acres, zero manual priming.",
    "Save this post before summer. Five checks that add years to your {product}.",
    "Behind the build: laser-aligned impellers and a sealed motor housing on the {product}.",
  ],
  linkedin: [
    "We are expanding our dealer network across East Africa. The {product} is now available through certified partners in Nairobi and Mombasa.",
    "Water management is an infrastructure problem before it is a hardware problem. Our engineering note covers sizing a {product} for variable head and flow.",
    "Prakash Pump has commissioned a 250kW solar pumping array for a 60-acre horticulture estate. Full case study inside.",
    "Hiring: field service engineers for Maharashtra and Gujarat. Bring hands-on experience with {product} installations.",
    "Our Q3 service data: mean time to repair down to 19 hours across 143 dealerships.",
  ],
  youtube: [
    "Full teardown of the {product} — every part explained in 6 minutes.",
    "Watch the {product} run a 24-hour continuous duty test on a 70-foot head.",
    "Solar pump installation start to finish: a {product} on a 2-acre farm.",
    "Why priming fails and how to fix it in under two minutes.",
    "Dealer training: servicing a {product} the right way.",
  ],
  x: [
    "The {product} just passed our 1,000-hour continuous duty test. Same impeller, zero pressure loss.",
    "Water at 70 feet? The {product} still holds head. Test footage in the thread.",
    "Dealer stock update: {product} units are moving fast in Nashik and Coimbatore.",
    "Solar pumping without a battery bank — sizing guide now live on the site.",
    "Service camp Saturday across 12 dealerships. Bring your pump for a free efficiency check.",
  ],
  snapchat: [
    "POV: the {product} starts first time, every time. 6am on the farm.",
    "Two acres watered before breakfast. {product} doing its thing.",
    "Spotlight: installation in 40 seconds — {product} on a borewell.",
    "The check every farmer forgets before summer.",
    "Behind the scenes at the Prakash service workshop.",
  ],
  tiktok: [
    "POV: your old pump finally gives up and the {product} arrives. Satisfying install incoming.",
    "How a {product} handles 70 feet of head — watch the gauge.",
    "Three settings most farmers never touch on the {product}.",
    "Solar pump vs diesel: the running cost gap is brutal.",
    "Install in 60 seconds. The {product} on a borewell in Nashik.",
  ],
};

const POSTS_PER_ACCOUNT = 16;
const POST_SPACING_DAYS = 4;

const FORMAT_BOOST: Record<string, number> = {
  Reel: 1.9,
  "Short video": 2.2,
  Short: 1.8,
  Video: 1.4,
  Carousel: 1.45,
  Story: 0.7,
  Spotlight: 1.6,
  Thread: 1.3,
  Document: 1.2,
  Text: 0.8,
  Image: 1,
  Link: 0.9,
  "Long-form video": 1.1,
  Duet: 1.3,
  Trend: 1.7,
};

function postMetrics(account: DemoAccount, id: string, format: string): Metrics {
  const meta = PLATFORM_META[account.platform];
  const seed = hash(id);
  const boost = FORMAT_BOOST[format] ?? 1;
  const impressions = Math.round(account.followers * (0.18 + 0.5 * noise(seed)) * boost);
  const rate = 0.02 + 0.055 * noise(seed + 3);
  const engagements = Math.round(impressions * rate);
  const r = meta.rates;
  const weight = r.likes + r.comments + r.shares + r.saves;
  const part = (value: number) => (weight ? Math.round((engagements * value) / weight) : 0);
  const likes = part(r.likes);
  const comments = part(r.comments);
  const shares = part(r.shares);
  const saves = part(r.saves);
  const total = likes + comments + shares + saves;
  return {
    impressions,
    reach: Math.round(impressions * 0.84),
    engagements: total,
    likes,
    comments,
    shares,
    saves,
    storyViews: Math.round(impressions * r.storyViews * 1.6),
    videoViews: Math.round(impressions * r.videoViews),
    clicks: Math.round(impressions * r.clicks),
    newFollowers: Math.round(total * 0.02),
  };
}

function buildPosts(): DemoPost[] {
  const out: DemoPost[] = [];
  const today = new Date();
  const anchor = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());

  for (const account of SOCIAL_ACCOUNTS) {
    const meta = PLATFORM_META[account.platform];
    for (let n = 0; n < POSTS_PER_ACCOUNT; n++) {
      const seed = hash(`${account.id}-${n}`);
      const offset = n * POST_SPACING_DAYS + 1 + (seed % 3);
      const hour = 6 + (seed % 12);
      const publishedAt = new Date(anchor - offset * DAY_MS + hour * 3_600_000).toISOString();
      const format = pick(meta.formats, seed + n);
      const id = `${account.id}-p${n}`;
      const metrics = postMetrics(account, id, format);
      const template = pick(COPY[account.platform], seed + n);
      out.push({
        id,
        platform: account.platform,
        accountId: account.id,
        content: `${template.replace("{product}", pick(PRODUCTS, (seed >>> 3) + n))}\n\n${HASHTAGS[account.platform]}`,
        format,
        status: "Published",
        publishedAt,
        engagementRate: metrics.impressions ? metrics.engagements / metrics.impressions : 0,
        ...metrics,
      });
    }

    for (let s = 0; s < 2; s++) {
      const seed = hash(`${account.id}-s${s}`);
      const offset = 2 + s * 4 + (seed % 3);
      out.push({
        id: `${account.id}-s${s}`,
        platform: account.platform,
        accountId: account.id,
        content: `${pick(COPY[account.platform], seed + s).replace("{product}", pick(PRODUCTS, (seed >>> 3) + s))}\n\n${HASHTAGS[account.platform]}`,
        format: pick(meta.formats, seed + s + 2),
        status: "Scheduled",
        publishedAt: new Date(anchor + offset * DAY_MS + 9 * 3_600_000).toISOString(),
        engagementRate: 0,
        ...emptyMetrics(),
      });
    }
  }

  return out.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

export const DEMO_POSTS: readonly DemoPost[] = buildPosts();

const isoDateOf = (value: string) => value.slice(0, 10);

export function postsInRange(
  from: string,
  to: string,
  countries: string[],
  platform?: PlatformId,
): DemoPost[] {
  return DEMO_POSTS.filter((post) => {
    if (platform && post.platform !== platform) return false;
    if (!matchesCountries(accountById(post.accountId), countries)) return false;
    if (post.status === "Scheduled") return true;
    const day = isoDateOf(post.publishedAt);
    return day >= from && day <= to;
  });
}

/** Published posts inside the range, best engagement rate first. */
export function topPosts(posts: DemoPost[], limit: number): DemoPost[] {
  return posts
    .filter((post) => post.status === "Published" && post.engagementRate > 0)
    .slice()
    .sort((a, b) => b.engagementRate - a.engagementRate)
    .slice(0, limit);
}
