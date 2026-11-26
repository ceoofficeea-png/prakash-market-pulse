import { previousRange } from "@/lib/periods";

export const DEMO_PAGES = ["Prakash Pumps Main", "Prakash Agro Solutions", "Prakash Motors India"];
export const DEMO_ACCOUNTS = ["facebook", "instagram", "snapchat", "x"].flatMap((platform, channel) =>
  DEMO_PAGES.map((name, page) => ({ id: `${platform}-${page}`, name, platform, country: page === 2 ? "IN" : page === 1 ? "KE" : "AE", followers: 12000 + channel * 2400 + page * 3100 })),
);
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