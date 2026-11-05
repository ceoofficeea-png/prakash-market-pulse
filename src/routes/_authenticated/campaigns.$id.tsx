import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { BarList, ChartCard, DonutChart, TrendChart } from "@/components/app/charts";
import { DataTable } from "@/components/app/data-table";
import { DemoNote, DetailStat, LoadingBlock, PageHeader } from "@/components/app/page";
import { StatusBadge } from "@/components/app/status-badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { totals, useContent, useCurrentUser, useLeads, useLookups, useMetrics, useSocialPosts, useTasks } from "@/lib/api";
import { CAMPAIGN_STATUSES, fmtCompact, fmtDate, fmtNum, fmtPct, fmtUsd, platformColor, platformLabel, safeDiv, toISODate } from "@/lib/format";
import { can } from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated/campaigns/$id")({
  head: () => ({ meta: [{"title": "Campaign detail \u2014 Prakash Pump"}, {"name": "description", "content": "Campaign detail analytics and records for the Prakash Pump marketing team."}, {"property": "og:title", "content": "Campaign detail \u2014 Prakash Pump"}, {"property": "og:description", "content": "Campaign detail analytics and records for the Prakash Pump marketing team."}, {"property": "og:type", "content": "website"}, {"name": "twitter:card", "content": "summary_large_image"}] }),
  component: CampaignDetail,
});

function CampaignDetail() {
  const { id } = Route.useParams();
  const cid = Number(id);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const me = useCurrentUser();
  const { campaign, member, product, country, loading } = useLookups();
  const c = campaign(cid);

  const today = new Date();
  const earliest = new Date();
  earliest.setDate(today.getDate() - 179);
  const from = c ? (c.start_date > toISODate(earliest) ? c.start_date : toISODate(earliest)) : toISODate(earliest);
  const to = toISODate(today);
  const scope = { from, to, campaigns: [cid], countries: [] as string[], platforms: [] as string[] };

  const daily = useMetrics("date", scope);
  const byCountry = useMetrics("country", scope);
  const byPlatform = useMetrics("platform", scope);
  const leads = useLeads();
  const content = useContent();
  const posts = useSocialPosts();
  const tasks = useTasks();

  const setStatus = useMutation({
    mutationFn: async (status: string) => {
      const { error } = await supabase.from("campaigns").update({ status }).eq("id", cid);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status updated");
      qc.invalidateQueries({ queryKey: ["campaigns"] });
    },
    onError: (e) => toast.error(e.message),
  });

  if (loading) return <LoadingBlock />;
  if (!c) return <div className="panel p-8 text-center text-muted-foreground">Campaign not found.</div>;

  const t = totals(daily.data);
  const pacing = safeDiv(t.spend, Number(c.budget));
  const campaignLeads = (leads.data ?? []).filter((l) => l.campaign_id === cid);
  const canEdit = can(me.data?.roles ?? [], "campaigns.edit");

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Campaigns", to: "/campaigns" }]}
        eyebrow={`${c.code} · ${c.objective}`}
        title={c.name}
        description={c.description ?? undefined}
        actions={
          canEdit ? (
            <Select value={c.status} onValueChange={(v) => setStatus.mutate(v)}>
              <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
              <SelectContent>{CAMPAIGN_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          ) : (
            <StatusBadge value={c.status} />
          )
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        <DetailStat label="Budget" value={fmtUsd(Number(c.budget), true)} sub={`${fmtDate(c.start_date)} → ${fmtDate(c.end_date)}`} />
        <DetailStat label="Spend" value={fmtUsd(t.spend, true)} sub={<Progress value={Math.min(100, pacing * 100)} className="mt-1 h-1" />} />
        <DetailStat label="Impressions" value={fmtCompact(t.impressions)} />
        <DetailStat label="CTR" value={fmtPct(safeDiv(t.clicks, t.impressions), 2)} />
        <DetailStat label="Leads" value={fmtNum(t.leads)} sub={`target ${fmtNum(c.target_leads)}`} />
        <DetailStat label="CPL" value={fmtUsd(safeDiv(t.spend, t.leads))} />
        <DetailStat label="Revenue" value={fmtUsd(t.revenue, true)} />
        <DetailStat label="ROAS" value={`${safeDiv(t.revenue, t.spend).toFixed(1)}×`} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard title="Daily performance" subtitle="Spend and leads" className="xl:col-span-2">
          <TrendChart
            data={(daily.data ?? []).map((r) => ({ key: r.key, spend: Number(r.spend), leads: Number(r.leads) }))}
            series={[
              { key: "spend", label: "Spend" },
              { key: "leads", label: "Leads", axis: "right", color: "var(--chart-2)" },
            ]}
            fmt={(v) => fmtUsd(v, true)}
            height={260}
          />
        </ChartCard>
        <ChartCard title="Platform split" subtitle="Share of spend">
          <DonutChart data={(byPlatform.data ?? []).map((r) => ({ name: platformLabel(r.key), value: Number(r.spend), color: platformColor(r.key) }))} fmt={(v) => fmtUsd(v, true)} height={180} />
          <dl className="mt-4 space-y-1 text-xs">
            <div className="flex justify-between"><dt className="text-muted-foreground">Owner</dt><dd>{member(c.owner_id)?.name}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Product</dt><dd>{product(c.product_id)?.name}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Markets</dt><dd>{c.countries.map((x) => country(x)?.flag).join(" ")}</dd></div>
          </dl>
        </ChartCard>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <ChartCard title="Leads by market" subtitle="Click to open market">
          <BarList
            items={(byCountry.data ?? []).map((r) => ({ id: r.key, label: <>{country(r.key)?.flag} {country(r.key)?.name}</>, value: Number(r.leads), sub: fmtUsd(safeDiv(Number(r.spend), Number(r.leads))) + " CPL" }))}
            fmt={fmtNum}
            onSelect={(code) => navigate({ to: "/markets/$code", params: { code } })}
          />
        </ChartCard>
        <ChartCard title="Linked content" subtitle={`${(content.data ?? []).filter((x) => x.campaign_id === cid).length} assets`}>
          <ul className="space-y-1.5 text-sm">
            {(content.data ?? []).filter((x) => x.campaign_id === cid).slice(0, 6).map((x) => (
              <li key={x.id}>
                <Link to="/content/$id" params={{ id: String(x.id) }} className="flex items-center justify-between gap-2 rounded px-1 py-1 hover:bg-accent/50">
                  <span className="truncate">{x.title}</span>
                  <StatusBadge value={x.status} />
                </Link>
              </li>
            ))}
          </ul>
        </ChartCard>
        <ChartCard title="Team tasks" subtitle={`${(tasks.data ?? []).filter((x) => x.campaign_id === cid).length} tasks · ${(posts.data ?? []).filter((p) => p.campaign_id === cid).length} social posts`}>
          <ul className="space-y-1.5 text-sm">
            {(tasks.data ?? []).filter((x) => x.campaign_id === cid).slice(0, 6).map((x) => (
              <li key={x.id} className="flex items-center justify-between gap-2">
                <span className="truncate">{x.title} <span className="text-xs text-muted-foreground">· {member(x.member_id)?.name}</span></span>
                <StatusBadge value={x.status} />
              </li>
            ))}
          </ul>
        </ChartCard>
      </div>

      <h2 className="mb-2 mt-6 text-sm font-semibold">CRM leads from this campaign</h2>
      <DataTable
        rows={campaignLeads}
        rowKey={(r) => r.id}
        onRowClick={(r) => navigate({ to: "/crm/$id", params: { id: String(r.id) } })}
        searchKeys={[(r) => r.full_name, (r) => r.company]}
        exportName={`${c.code}-leads`}
        pageSize={10}
        columns={[
          { key: "full_name", header: "Lead", cell: (r) => <div><div className="font-medium">{r.full_name}</div><div className="text-xs text-muted-foreground">{r.company}</div></div> },
          { key: "country_code", header: "Market", cell: (r) => <>{country(r.country_code)?.flag} {country(r.country_code)?.name}</> },
          { key: "source", header: "Source" },
          { key: "stage", header: "Stage", cell: (r) => <StatusBadge value={r.stage} /> },
          { key: "score", header: "Score", align: "right" },
          { key: "deal_value", header: "Value", align: "right", value: (r) => Number(r.deal_value), cell: (r) => fmtUsd(Number(r.deal_value)) },
        ]}
      />
      <DemoNote />
    </>
  );
}
