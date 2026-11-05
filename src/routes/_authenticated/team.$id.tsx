import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Mail } from "lucide-react";
import { toast } from "sonner";

import { BarsChart, ChartCard } from "@/components/app/charts";
import { DataTable } from "@/components/app/data-table";
import { DemoNote, DetailStat, LoadingBlock, PageHeader } from "@/components/app/page";
import { StatusBadge } from "@/components/app/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser, useKpis, useLeads, useLookups, useTasks } from "@/lib/api";
import { fmtDate, fmtNum, fmtPct, fmtUsd, initials, TASK_STATUSES } from "@/lib/format";
import { can } from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated/team/$id")({
  head: () => ({ meta: [{"title": "Team member \u2014 Prakash Pump"}, {"name": "description", "content": "Team member analytics and records for the Prakash Pump marketing team."}, {"property": "og:title", "content": "Team member \u2014 Prakash Pump"}, {"property": "og:description", "content": "Team member analytics and records for the Prakash Pump marketing team."}, {"property": "og:type", "content": "website"}, {"name": "twitter:card", "content": "summary_large_image"}] }),
  component: MemberDetail,
});

const monthLabel = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { month: "short" });

function MemberDetail() {
  const { id } = Route.useParams();
  const mid = Number(id);
  const qc = useQueryClient();
  const me = useCurrentUser();
  const { member, country, campaign, campaigns, loading } = useLookups();
  const tasks = useTasks();
  const kpis = useKpis();
  const leads = useLeads();
  const m = member(mid);
  const canEdit = can(me.data?.roles ?? [], "tasks.edit");

  const setStatus = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: number; status: string }) => {
      const { error } = await supabase
        .from("team_tasks")
        .update({ status, completed_at: status === "Done" ? new Date().toISOString().slice(0, 10) : null })
        .eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Task updated");
      qc.invalidateQueries({ queryKey: ["team_tasks"] });
    },
    onError: (e) => toast.error(e.message),
  });

  if (loading) return <LoadingBlock />;
  if (!m) return <div className="panel p-8 text-center text-muted-foreground">Team member not found.</div>;

  const ts = (tasks.data ?? []).filter((t) => t.member_id === mid);
  const ks = (kpis.data ?? []).filter((k) => k.member_id === mid);
  const last = ks[ks.length - 1];
  const owned = (leads.data ?? []).filter((l) => l.owner_id === mid);
  const myCampaigns = campaigns.filter((c) => c.owner_id === mid);
  const manager = member(m.manager_id);

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Team", to: "/team" }]}
        eyebrow={`${m.team} · ${country(m.country_code)?.flag ?? ""} ${country(m.country_code)?.name ?? ""}`}
        title={
          <span className="flex items-center gap-3">
            <Avatar className="size-10"><AvatarFallback className="bg-primary/15 text-primary">{initials(m.name)}</AvatarFallback></Avatar>
            {m.name}
          </span>
        }
        description={`${m.title}${manager ? ` · reports to ${manager.name}` : ""} · joined ${fmtDate(m.joined_on)}`}
        actions={<a href={`mailto:${m.email}`} className="inline-flex items-center gap-1 text-xs text-primary hover:underline"><Mail className="size-3.5" /> {m.email}</a>}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-6">
        <DetailStat label="Performance score" value={Number(last?.score ?? 0).toFixed(0)} />
        <DetailStat label="KPI achievement" value={`${Number(last?.kpi_achieved ?? 0).toFixed(0)}%`} />
        <DetailStat label="On-time rate" value={fmtPct(Number(last?.on_time_rate ?? 0), 0)} />
        <DetailStat label="Tasks done" value={fmtNum(ts.filter((t) => t.status === "Done").length)} sub={`${ts.filter((t) => t.status !== "Done").length} open`} />
        <DetailStat label="Leads owned" value={fmtNum(owned.length)} sub={fmtUsd(owned.reduce((a, l) => a + Number(l.deal_value), 0), true)} />
        <DetailStat label="Campaigns owned" value={fmtNum(myCampaigns.length)} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard title="Monthly KPI achievement" subtitle="Target = 100%" className="xl:col-span-2">
          <BarsChart data={ks.map((k) => ({ key: monthLabel(k.month), achieved: Number(k.kpi_achieved), score: Number(k.score) }))} series={[{ key: "achieved", label: "KPI %" }, { key: "score", label: "Score", color: "var(--chart-2)" }]} fmt={(v) => String(v)} height={240} />
        </ChartCard>
        <ChartCard title="Campaigns owned">
          <ul className="space-y-1.5 text-sm">
            {myCampaigns.map((c) => (
              <li key={c.id}>
                <Link to="/campaigns/$id" params={{ id: String(c.id) }} className="flex items-center justify-between gap-2 rounded px-1 py-1 hover:bg-accent/50">
                  <span className="truncate">{c.name}</span>
                  <StatusBadge value={c.status} />
                </Link>
              </li>
            ))}
            {!myCampaigns.length && <li className="text-muted-foreground">No campaigns owned.</li>}
          </ul>
        </ChartCard>
      </div>

      <h2 className="mb-2 mt-6 text-sm font-semibold">Tasks</h2>
      <DataTable
        rows={ts}
        rowKey={(r) => r.id}
        searchKeys={[(r) => r.title]}
        exportName={`tasks-${m.name.replace(/\s+/g, "-").toLowerCase()}`}
        initialSort={{ key: "due_date", dir: "desc" }}
        columns={[
          { key: "title", header: "Task", cell: (r) => <div><div className="font-medium">{r.title}</div><div className="max-w-64 truncate text-xs text-muted-foreground">{campaign(r.campaign_id)?.name ?? "General"}</div></div> },
          { key: "priority", header: "Priority", cell: (r) => <StatusBadge value={r.priority} /> },
          { key: "due_date", header: "Due", cell: (r) => <span className="num text-xs">{fmtDate(r.due_date)}</span> },
          { key: "hours_logged", header: "Hours", align: "right", value: (r) => Number(r.hours_logged) },
          {
            key: "status",
            header: "Status",
            cell: (r) =>
              canEdit ? (
                <div onClick={(e) => e.stopPropagation()}>
                  <Select value={r.status} onValueChange={(v) => setStatus.mutate({ taskId: r.id, status: v })}>
                    <SelectTrigger className="h-7 w-32 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{TASK_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              ) : (
                <StatusBadge value={r.status} />
              ),
          },
        ]}
      />
      <DemoNote />
    </>
  );
}
