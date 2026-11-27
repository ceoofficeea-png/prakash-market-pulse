/**
 * Presentation catalogue for the social module.
 *
 * The module reads live rows from `social_accounts`, `social_account_daily`
 * and `social_posts` (see `social-data.ts`); this file only maps the seven
 * platform ids stored in the database to labels, tab names, token colours and
 * the platform-native metrics each network reports.
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
}

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
  },
};

/** `social_accounts.platform` is free text, so every read filters through this. */
export function isPlatformId(value: string): value is PlatformId {
  return (PLATFORM_ORDER as string[]).includes(value);
}
