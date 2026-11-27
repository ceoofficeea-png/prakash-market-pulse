import { createFileRoute, Link } from "@tanstack/react-router";
import { Mail } from "lucide-react";

import { BarsChart, ChartCard } from "@/components/app/charts";
import { DataTable } from "@/components/app/data-table";
import { DemoNote, DetailStat, LoadingBlock, NoAccess, PageHeader } from "@/components/app/page";
import { StatusBadge } from "@/components/app/status-badge";
import { TaskActivity, UpdateTaskDialog } from "@/components/app/task-progress";
import { AssignTaskDialog } from "@/components/app/team-actions";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { useCurrentUser, useKpis, useLeads, useLookups, useTasks } from "@/lib/api";
import { fmtDate, fmtNum, fmtPct, fmtUsd, initials } from "@/lib/format";
import { can, canReadLeads } from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated/team/$id")({
  head: () => ({
    meta: [
      { title: "Team member \u2014 Prakash Pump" },
      {
        name: "description",
        content: "Team member analytics and records for the Prakash Pump marketing team.",
      },
      { property: "og:title", content: "Team member \u2014 Prakash Pump" },
      {
        property: "og:description",
        content: "Team member analytics and records for the Prakash Pump marketing team.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MemberDetail,
});

const monthLabel = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { month: "short" });

function MemberDetail() {
  const { id } = Route.useParams();
  const mid = Number(id);
  const me = useCurrentUser();
  const { member, country, campaign, campaigns, team, loading } = useLookups();
  const tasks = useTasks();
  const kpis = useKpis();
  const leads = useLeads();
  const m = member(mid);
  const canEdit = can(me.data?.roles ?? [], "tasks.edit");
  const canRead = canReadLeads(me.data?.roles ?? []);

  if (loading) return <LoadingBlock />;
  if (!m)
    return (
      <div className="panel p-8 text-center text-muted-foreground">Team member not found.</div>
    );

  const isMine = m.user_id != null && m.user_id === me.data?.id;
  // Employees may only open their own profile; administrators and managers see everyone.
  if (!canEdit && !isMine) return <NoAccess what="This team profile" />;

  const ts = (tasks.data ?? []).filter((t) => t.member_id === mid);
  const ks = (kpis.data ?? []).filter((k) => k.member_id === mid);
  const last = ks[ks.length - 1];
  const owned = (leads.data ?? []).filter((l) => l.owner_id === mid);
  const myCampaigns = campaigns.filter((c) => c.owner_id === mid);
  const manager = member(m.manager_id);
  const canUpdate = canEdit || isMine;

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Team", to: "/team" }]}
        eyebrow={`${m.team} · ${country(m.country_code)?.flag ?? ""} ${country(m.country_code)?.name ?? ""}`}
        title={
          <span className="flex items-center gap-3">
            <Avatar className="size-10">
              <AvatarFallback className="bg-primary/15 text-primary">
                {initials(m.name)}
              </AvatarFallback>
            </Avatar>
            {m.name}
          </span>
        }
        description={`${m.title}${manager ? ` · reports to ${manager.name}` : ""} · joined ${fmtDate(m.joined_on)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={`mailto:${m.email}`}
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <Mail className="size-3.5" /> {m.email}
            </a>
            {canEdit && <AssignTaskDialog memberId={m.id} members={team} />}
          </div>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-6">
        <DetailStat label="Performance score" value={Number(last?.score ?? 0).toFixed(0)} />
        <DetailStat
          label="KPI achievement"
          value={`${Number(last?.kpi_achieved ?? 0).toFixed(0)}%`}
        />
        <DetailStat label="On-time rate" value={fmtPct(Number(last?.on_time_rate ?? 0), 0)} />
        <DetailStat
          label="Tasks done"
          value={fmtNum(ts.filter((t) => t.status === "Done").length)}
          sub={`${ts.filter((t) => t.status !== "Done").length} open`}
        />
        <DetailStat
          label="Leads owned"
          value={canRead ? fmtNum(owned.length) : "—"}
          sub={
            canRead
              ? fmtUsd(
                  owned.reduce((a, l) => a + Number(l.deal_value), 0),
                  true,
                )
              : "hidden for your role"
          }
        />
        <DetailStat label="Campaigns owned" value={fmtNum(myCampaigns.length)} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard
          title="Monthly KPI achievement"
          subtitle="Target = 100%"
          className="xl:col-span-2"
        >
          <BarsChart
            data={ks.map((k) => ({
              key: monthLabel(k.month),
              achieved: Number(k.kpi_achieved),
              score: Number(k.score),
            }))}
            series={[
              { key: "achieved", label: "KPI %" },
              { key: "score", label: "Score", color: "var(--chart-2)" },
            ]}
            fmt={(v) => String(v)}
            height={240}
          />
        </ChartCard>
        <ChartCard title="Campaigns owned">
          <ul className="space-y-1.5 text-sm">
            {myCampaigns.map((c) => (
              <li key={c.id}>
                <Link
                  to="/campaigns/$id"
                  params={{ id: String(c.id) }}
                  className="flex items-center justify-between gap-2 rounded px-1 py-1 hover:bg-accent/50"
                >
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
          {
            key: "title",
            header: "Task",
            cell: (r) => (
              <div>
                <div className="font-medium">{r.title}</div>
                <div className="max-w-64 truncate text-xs text-muted-foreground">
                  {r.progress_note ?? campaign(r.campaign_id)?.name ?? "General"}
                </div>
              </div>
            ),
          },
          { key: "priority", header: "Priority", cell: (r) => <StatusBadge value={r.priority} /> },
          {
            key: "due_date",
            header: "Due",
            cell: (r) => <span className="num text-xs">{fmtDate(r.due_date)}</span>,
          },
          {
            key: "hours_logged",
            header: "Hours",
            align: "right",
            value: (r) => Number(r.hours_logged),
          },
          {
            key: "progress_pct",
            header: "Progress",
            align: "right",
            value: (r) => Number(r.progress_pct ?? 0),
            cell: (r) => (
              <div className="flex items-center justify-end gap-2">
                <Progress value={Number(r.progress_pct ?? 0)} className="h-1.5 w-16" />
                <span className="num text-xs">{Number(r.progress_pct ?? 0)}%</span>
              </div>
            ),
          },
          { key: "status", header: "Status", cell: (r) => <StatusBadge value={r.status} /> },
          {
            key: "update",
            header: "",
            sortable: false,
            cell: (r) => (canUpdate ? <UpdateTaskDialog task={r} /> : null),
          },
        ]}
      />

      <div className="mt-4">
        <TaskActivity taskIds={ts.map((t) => t.id)} title={`${m.name} — task activity`} />
      </div>
      <DemoNote />
    </>
  );
}
