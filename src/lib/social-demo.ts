import { previousRange } from "@/lib/periods";

export const DEMO_PAGES = ["Prakash Pumps Main", "Prakash Agro Solutions", "Prakash Motors India"];
export interface DemoAccount { id: string; name: string; handle: string; platform: string; country: string; followers: number }
const PAGE_COUNTRY = ["AE", "KE", "IN"];
const page = (platform: string, channel: number, handles: string[]): DemoAccount[] =>
  DEMO_PAGES.map((name, i) => ({ id: `${platform}-${i}`, name, handle: handles[i] ?? name, platform, country: PAGE_COUNTRY[i] ?? "IN", followers: 12000 + channel * 2400 + i * 3100 }));
export const DEMO_ACCOUNTS: DemoAccount[] = [
  ...page("facebook", 0, ["Prakash Pumps Main", "Prakash Agro Solutions", "Prakash Motors India"]),
  ...page("instagram", 1, ["@prakashpumps_official", "@prakash_agro_solutions", "@prakash_motors_india"]),
  { id: "instagram-3", name: "Prakash Pumps Africa", handle: "@prakash_pumps_africa", platform: "instagram", country: "NG", followers: 9800 },
  { id: "instagram-4", name: "Prakash MENA Export", handle: "@prakash_mena_export", platform: "instagram", country: "AE", followers: 7600 },
  ...page("snapchat", 2, ["prakashpumps", "prakashagro", "prakashmotors"]),
  ...page("x", 3, ["@PrakashPumps", "@PrakashAgro", "@PrakashMotorsIN"]),
  { id: "youtube-0", name: "Prakash Engineering Official", handle: "Prakash Engineering Official", platform: "youtube", country: "AE", followers: 21400 },
  { id: "youtube-1", name: "Prakash Kisan & Agro Tech", handle: "Prakash Kisan & Agro Tech", platform: "youtube", country: "IN", followers: 46800 },
  { id: "youtube-2", name: "Prakash Technical Support", handle: "Prakash Technical Support", platform: "youtube", country: "KE", followers: 15200 },
];
export function socialDemo(from: string, to: string, accounts: string[] = [], countries: string[] = [], platforms: string[] = []) {
  const selected = DEMO_ACCOUNTS.filter((a) => (!accounts.length || accounts.includes(a.id)) && (!countries.length || countries.includes(a.country)) && (!platforms.length || platforms.includes(a.platform)));
  const rows: { key: string; impressions: number; engagements: number; newFollowers: number; posts: number; conversations: number; inquiries: number; leads: number; responseTotal: number; likes: number; comments: number; shares: number; saves: number; storyViews: number; replies: number; reposts: number; spotlightViews: number }[] = [];
  for (let time = Date.parse(from); time <= Date.parse(to); time += 86400000) {
    const day = Math.floor(time / 86400000);
    const activity = selected.reduce((sum, a) => sum + 1 + DEMO_ACCOUNTS.indexOf(a) * 0.12, 0);
    const volume = Math.round((460 + ((day * 17) % 113)) * activity);
    const conversations = countries.length && !countries.some((c) => ["IN", "KE", "AE"].includes(c)) ? 0 : 38 + day % 15;
    rows.push({ key: new Date(time).toISOString().slice(0, 10), impressions: volume, engagements: Math.round(volume * 0.067), newFollowers: Math.round(volume * 0.002), posts: selected.length, conversations, inquiries: Math.round(conversations * 0.71), leads: Math.round(conversations * 0.29), responseTotal: conversations * (92 + day % 37), likes: Math.round(volume * 0.04), comments: Math.round(volume * 0.009), shares: Math.round(volume * 0.008), saves: Math.round(volume * 0.01), storyViews: Math.round(volume * 0.4), replies: Math.round(volume * 0.005), reposts: Math.round(volume * 0.006), spotlightViews: Math.round(volume * 0.28) });
  }
  const sum = (key: Exclude<keyof (typeof rows)[number], "key">) => rows.reduce((n, r) => n + r[key], 0);
  return { rows, selected, followers: selected.reduce((n, a) => n + a.followers, 0) + sum("newFollowers"), impressions: sum("impressions"), engagements: sum("engagements"), newFollowers: sum("newFollowers"), posts: sum("posts"), conversations: sum("conversations"), inquiries: sum("inquiries"), leads: sum("leads"), response: sum("conversations") ? sum("responseTotal") / sum("conversations") : 0, sum };
}
export function socialDemoComparison(from: string, to: string, accounts: string[], countries: string[], platforms: string[]) {
  const prev = previousRange(from, to);
  return { current: socialDemo(from, to, accounts, countries, platforms), previous: socialDemo(prev.prevFrom, prev.prevTo, accounts, countries, platforms) };
}
/** Per-account summary for one platform (or all), each account computed separately. */
export function accountBreakdown(from: string, to: string, platform: string | null, countries: string[] = []) {
  const prev = previousRange(from, to);
  return DEMO_ACCOUNTS.filter((a) => (!platform || a.platform === platform) && (!countries.length || countries.includes(a.country))).map((a) => {
    const c = socialDemo(from, to, [a.id]);
    const p = socialDemo(prev.prevFrom, prev.prevTo, [a.id]);
    const leads = Math.round(c.engagements * 0.004);
    return { ...a, followers: c.followers, growth: a.followers ? c.newFollowers / a.followers : 0, impressions: c.impressions, engagements: c.engagements, rate: c.impressions ? c.engagements / c.impressions : 0, leads, prevImpressions: p.impressions };
  });
}
