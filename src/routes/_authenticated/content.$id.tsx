import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";

import { ChartCard } from "@/components/app/charts";
import { DemoNote, DetailStat, LoadingBlock, PageHeader } from "@/components/app/page";
import { StatusBadge } from "@/components/app/status-badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useContent, useCurrentUser, useLookups } from "@/lib/api";
import { CONTENT_STAGES, fmtCompact, fmtDate, fmtNum, fmtPct } from "@/lib/format";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/content/$id")({
  head: () => ({ meta: [{"title": "Content detail \u2014 Prakash Pump"}, {"name": "description", "content": "Content detail analytics and records for the Prakash Pump marketing team."}, {"property": "og:title", "content": "Content detail \u2014 Prakash Pump"}, {"property": "og:description", "content": "Content detail analytics and records for the Prakash Pump marketing team."}, {"property": "og:type", "content": "website"}, {"name": "twitter:card", "content": "summary_large_image"}] }),
  component: ContentDetail,
});

function ContentDetail() {
  const { id } = Route.useParams();
  const cid = Number(id);
  const qc = useQueryClient();
  const me = useCurrentUser();
  const content = useContent();
  const { country, member, campaign, product } = useLookups();
  const item = content.data?.find((c) => c.id === cid);
  const canEdit = can(me.data?.roles ?? [], "content.edit");

  const setStatus = useMutation({
    mutationFn: async (status: string) => {
      const patch: { status: string; published_at?: string } = { status };
      if (status === "Published" && !item?.published_at) patch.published_at = new Date().toISOString().slice(0, 10);
      const { error } = await supabase.from("content_items").update(patch).eq("id", cid);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status updated");
      qc.invalidateQueries({ queryKey: ["content_items"] });
    },
    onError: (e) => toast.error(e.message),
  });

  if (content.isLoading) return <LoadingBlock />;
  if (!item) return <div className="panel p-8 text-center text-muted-foreground">Content item not found.</div>;
  const idx = CONTENT_STAGES.indexOf(item.status as (typeof CONTENT_STAGES)[number]);
  const related = (content.data ?? []).filter((c) => c.id !== cid && (c.product_id === item.product_id || c.campaign_id === item.campaign_id)).slice(0, 6);
  const cmp = campaign(item.campaign_id);
  const ctry = country(item.country_code);

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Content", to: "/content" }]}
        eyebrow={`${item.content_type} · ${item.channel}`}
        title={item.title}
        description={item.summary ?? undefined}
        actions={
          canEdit ? (
            <Select value={item.status} onValueChange={(v) => setStatus.mutate(v)}>
              <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
              <SelectContent>{CONTENT_STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          ) : (
            <StatusBadge value={item.status} />
          )
        }
      />

      <div className="panel mb-4 flex gap-1 overflow-x-auto p-2">
        {CONTENT_STAGES.filter((s) => s !== "Archived").map((s, i) => (
          <div key={s} className={cn("flex-1 whitespace-nowrap rounded px-3 py-1.5 text-center text-xs", i <= idx ? "bg-signal font-medium text-primary-foreground" : "bg-surface-2 text-muted-foreground")}>
            {s}
          </div>
        ))}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        <DetailStat label="Views" value={fmtCompact(item.views)} />
        <DetailStat label="Downloads" value={fmtNum(item.downloads)} />
        <DetailStat label="Engagement" value={fmtPct(Number(item.engagement_rate))} />
        <DetailStat label="Leads generated" value={fmtNum(item.leads_generated)} />
        <DetailStat label={item.published_at ? "Published" : "Due"} value={fmtDate(item.published_at ?? item.due_date)} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard title="Details">
          <dl className="space-y-2 text-sm">
            {[
              ["Author", member(item.author_id) ? <Link to="/team/$id" params={{ id: String(item.author_id) }} className="text-primary hover:underline">{member(item.author_id)?.name}</Link> : "—"],
              ["Product", product(item.product_id)?.name ?? "—"],
              ["Market", ctry ? <Link to="/markets/$code" params={{ code: ctry.code }} className="text-primary hover:underline">{ctry.flag} {ctry.name}</Link> : "Global"],
              ["Language", item.language],
              ["Campaign", cmp ? <Link to="/campaigns/$id" params={{ id: String(cmp.id) }} className="text-primary hover:underline">{cmp.name}</Link> : "—"],
              ["Created", fmtDate(item.created_at)],
            ].map(([k, v]) => (
              <div key={String(k)} className="flex justify-between gap-4 border-b border-border/50 pb-2 last:border-0">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="text-right">{v}</dd>
              </div>
            ))}
          </dl>
        </ChartCard>
        <ChartCard title="Related assets" subtitle="Same product or campaign" className="xl:col-span-2">
          <ul className="divide-y divide-border/60">
            {related.map((r) => (
              <li key={r.id}>
                <Link to="/content/$id" params={{ id: String(r.id) }} className="flex items-center justify-between gap-3 py-2 text-sm hover:text-primary">
                  <span className="min-w-0">
                    <span className="block truncate">{r.title}</span>
                    <span className="text-xs text-muted-foreground">{r.content_type} · {r.language}</span>
                  </span>
                  <StatusBadge value={r.status} />
                </Link>
              </li>
            ))}
          </ul>
        </ChartCard>
      </div>
      <DemoNote />
    </>
  );
}
