import { useState } from "react";
import { MessageCircle, Layers } from "lucide-react";
import { MultiSelect } from "@/components/app/multi-select";
import { ChartCard, TrendChart } from "@/components/app/charts";
import { KpiCard } from "@/components/app/kpi-card";
import { KpiGrid } from "@/components/app/page";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFilters } from "@/lib/filters";
import { fmtCompact, fmtDuration, fmtPct, pctChange, safeDiv, socialLabel } from "@/lib/format";
import { DEMO_ACCOUNTS, socialDemoComparison } from "@/lib/social-demo";

export function SocialAnalytics() {
  const f = useFilters();
  const [accounts, setAccounts] = useState<string[]>([]);
  const [channels, setChannels] = useState<string[]>([]);
  const { current: c, previous: p } = socialDemoComparison(f.from, f.to, accounts, f.countries, channels);
  const metrics = [
    ["facebook", ["likes", "comments", "shares"]],
    ["instagram", ["likes", "comments", "saves", "storyViews"]],
    ["snapchat", ["storyViews", "spotlightViews", "replies"]],
    ["x", ["likes", "replies", "reposts"]],
  ] as const;
  const names = { likes: "Likes", comments: "Comments", shares: "Shares", saves: "Saves", storyViews: "Story views", spotlightViews: "Spotlight views", replies: "Replies", reposts: "Reposts" };
  return <section className="mb-6 border-b border-border pb-6">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h2 className="text-sm font-semibold">Multi-account analytics <span className="ml-2 text-xs font-normal text-warning">Demo</span></h2><div className="flex flex-wrap gap-2">
      <MultiSelect label="Accounts" allLabel="All Accounts" options={DEMO_ACCOUNTS.map((a) => ({ value: a.id, label: a.name, group: socialLabel(a.platform) }))} value={accounts} onChange={setAccounts} icon={<Layers className="size-3.5" />} width="w-80" />
      <MultiSelect label="Channels" options={metrics.map(([id]) => ({ value: id, label: socialLabel(id) }))} value={channels} onChange={setChannels} />
    </div></div>
    <Tabs defaultValue="accounts"><TabsList className="mb-3"><TabsTrigger value="accounts">Social accounts</TabsTrigger><TabsTrigger value="whatsapp"><MessageCircle className="mr-1 size-3.5" /> WhatsApp Business</TabsTrigger></TabsList>
      <TabsContent value="accounts">
        <KpiGrid cols={4}><KpiCard label="Followers" value={fmtCompact(c.followers)} delta={pctChange(c.followers, p.followers)} /><KpiCard label="Impressions" value={fmtCompact(c.impressions)} delta={pctChange(c.impressions, p.impressions)} /><KpiCard label="Engagements" value={fmtCompact(c.engagements)} delta={pctChange(c.engagements, p.engagements)} /><KpiCard label="Engagement rate" value={fmtPct(safeDiv(c.engagements, c.impressions), 2)} delta={pctChange(safeDiv(c.engagements, c.impressions), safeDiv(p.engagements, p.impressions))} /></KpiGrid>
        <ChartCard title="Account reach & engagement" subtitle="Daily · selected pages"><TrendChart data={c.rows} previousData={p.rows} series={[{ key: "impressions", label: "Impressions" }, { key: "engagements", label: "Engagements", axis: "right", color: "var(--chart-2)" }]} /></ChartCard>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">{metrics.filter(([id]) => !channels.length || channels.includes(id)).map(([id, keys]) => {
          const { current, previous } = socialDemoComparison(f.from, f.to, accounts, f.countries, [id]);
          return <div key={id} className="min-w-0"><h3 className="mb-2 text-sm font-semibold">{socialLabel(id)}</h3><div className="space-y-2">{keys.map((key) => <KpiCard key={key} label={names[key]} value={fmtCompact(current.sum(key))} delta={pctChange(current.sum(key), previous.sum(key))} />)}</div></div>;
        })}</div>
      </TabsContent>
      <TabsContent value="whatsapp"><KpiGrid cols={4}><KpiCard label="Total conversations" value={fmtCompact(c.conversations)} delta={pctChange(c.conversations, p.conversations)} /><KpiCard label="Pump inquiry chats" value={fmtCompact(c.inquiries)} delta={pctChange(c.inquiries, p.inquiries)} /><KpiCard label="Avg first-response time" value={fmtDuration(c.response)} delta={pctChange(c.response, p.response)} invert /><KpiCard label="Leads captured" value={fmtCompact(c.leads)} delta={pctChange(c.leads, p.leads)} /></KpiGrid><ChartCard title="WhatsApp conversations & leads" subtitle="Demo · all business numbers"><TrendChart data={c.rows} previousData={p.rows} series={[{ key: "conversations", label: "Conversations", color: "var(--chart-3)" }, { key: "leads", label: "Leads" }]} /></ChartCard></TabsContent>
    </Tabs>
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3 text-sm"><span className="flex items-center gap-2 font-semibold"><MessageCircle className="size-4 text-success" />WhatsApp Business <span className="text-xs font-normal text-warning">Demo</span></span><span>{fmtCompact(c.conversations)} conversations · {fmtCompact(c.inquiries)} pump inquiries · {fmtDuration(c.response)} first response · {fmtCompact(c.leads)} leads</span></div>
  </section>;
}