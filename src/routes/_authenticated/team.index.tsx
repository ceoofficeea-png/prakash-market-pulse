import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { BarsChart, ChartCard } from "@/components/app/charts";
import { DataTable } from "@/components/app/data-table";
import { KpiCard } from "@/components/app/kpi-card";
import { DemoNote, KpiGrid, PageHeader } from "@/components/app/page";
import { StatusBadge } from "@/components/app/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useKpis, useLookups, useTasks } from "@/lib/api";
import { fmtNum, fmtPct, initials, safeDiv } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/team/")({
  head: () => ({ meta: [{"title": "Marketing Team Performance \u2014 Prakash Pump"}, {"name": "description", "content": "Marketing Team Performance analytics and records for the Prakash Pump marketing team."}, {"property": "og:title", "content": "Marketing Team Performance \u2014 Prakash Pump"}, {"property": "og:description", "content": "Marketing Team Performance analytics and records for the Prakash Pump marketing team."}, {"property": "og:type", "content": "website"}, {"name": "twitter:card", "content": "summary_large_image"}] }),
  component: TeamPage,
});

function TeamPage() {
  const navigate = useNavigate();
  const { team, country } = useLookups();
  const tasks = useTasks();
  const kpis = useKpis();
  const [unit, setUnit] = useState("all");

  const months = Array.from(new Set((kpis.data ?? []).map((k) => k.month))).sort();
  const latest = months[months.length - 1];
  const today = new Date().toISOString().slice(0, 10);

  const rows = useMemo(
    () =>
      team
        .filter((m) => unit === "all" || m.team === unit)
        .map((m) => {
          const ts = (tasks.data ?? []).filter((t) => t.member_id === m.id);
          const open = ts.filter((t) => t.status !== "Done");
          const k = (kpis.data ?? []).find((x) => x.member_id === m.id && x.month === latest);
          const hours = open.reduce((a, t) => a + Number(t.hours_logged), 0) + ts.filter((t) => t.status === "Done" && t.completed_at && t.completed_at >= today.slice(0, 7)).reduce((a, t) => a + Number(t.hours_logged), 0);
          return {
            ...m,
            done: ts.filter((t) => t.status === "Done").length,
            open: open.length,
            overdue: open.filter((t) => t.due_date < today).length,
            blocked: open.filter((t) => t.status === "Blocked").length,
            score: Number(k?.score ?? 0),
            achieved: Number(k?.kpi_achieved ?? 0),
            onTime: Number(k?.on_time_rate ?? 0),
            leads: k?.leads_attributed ?? 0,
            utilisation: safeDiv(hours * 4, m.capacity_hours),
          };
        }),
    [team, tasks.data, kpis.data, latest, unit, today],
  );

  const units = Array.from(new Set(team.map((m) => m.team))).sort();
  const avg = (k: "score" | "achieved" | "onTime") => safeDiv(rows.reduce((a, r) => a + r[k], 0), rows.length);
  const byUnit = units.map((u) => {
    const rs = rows.filter((r) => r.team === u);
    return { key: u, done: rs.reduce((a, r) => a + r.done, 0), open: rs.reduce((a, r) => a + r.open, 0) };
  });

  return (
    <>
      <PageHeader
        eyebrow="10 · Marketing Team Performance"
        title="Team performance"
        description="KPI achievement, delivery and workload across the global marketing team."
        actions={
          <Select value={unit} onValueChange={setUnit}>
            <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All teams</SelectItem>
              {units.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
            </SelectContent>
          </Select>
        }
      />

      <KpiGrid cols={5}>
        <KpiCard label="Team members" value={String(rows.length)} />
        <KpiCard label="Avg KPI achievement" value={`${avg("achieved").toFixed(0)}%`} />
        <KpiCard label="On-time delivery" value={fmtPct(avg("onTime"))} />
        <KpiCard label="Open tasks" value={fmtNum(rows.reduce((a, r) => a + r.open, 0))} hint={`${rows.reduce((a, r) => a + r.overdue, 0)} overdue`} />
        <KpiCard label="Blocked" value={fmtNum(rows.reduce((a, r) => a + r.blocked, 0))} />
      </KpiGrid>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {[...rows].sort((a, b) => b.score - a.score).map((m) => (
          <button key={m.id} type="button" onClick={() => navigate({ to: "/team/$id", params: { id: String(m.id) } })} className="panel p-4 text-left transition-colors hover:border-primary/50">
            <div className="flex items-center gap-3">
              <Avatar className="size-10"><AvatarFallback className="bg-primary/15 text-sm text-primary">{initials(m.name)}</AvatarFallback></Avatar>
              <div className="min-w-0">
                <div className="truncate font-medium">{m.name}</div>
                <div className="truncate text-xs text-muted-foreground">{m.title}</div>
              </div>
              <span className="ml-auto text-lg">{country(m.country_code)?.flag}</span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
              <div><div className="eyebrow">Score</div><div className="num text-base text-foreground">{m.score.toFixed(0)}</div></div>
              <div><div className="eyebrow">KPI</div><div className={cn("num text-base", m.achieved >= 100 ? "text-success" : m.achieved < 85 ? "text-warning" : "text-foreground")}>{m.achieved.toFixed(0)}%</div></div>
              <div><div className="eyebrow">Open</div><div className="num text-base text-foreground">{m.open}{m.overdue > 0 && <span className="text-destructive"> · {m.overdue}!</span>}</div></div>
            </div>
            <div className="mt-3">
              <div className="mb-1 flex justify-between text-[10px] text-muted-foreground"><span>Utilisation</span><span className="num">{fmtPct(m.utilisation, 0)}</span></div>
              <Progress value={Math.min(100, m.utilisation * 100)} className="h-1.5" />
            </div>
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <ChartCard title="Delivery by team" subtitle="Completed vs open tasks">
          <BarsChart data={byUnit} series={[{ key: "done", label: "Done", color: "var(--chart-3)" }, { key: "open", label: "Open" }]} stacked height={260} />
        </ChartCard>
        <div className="xl:col-span-2">
          <DataTable
            rows={rows}
            rowKey={(r) => r.id}
            onRowClick={(r) => navigate({ to: "/team/$id", params: { id: String(r.id) } })}
            searchKeys={[(r) => r.name, (r) => r.title, (r) => r.team]}
            exportName="team-performance"
            initialSort={{ key: "score", dir: "desc" }}
            pageSize={10}
            columns={[
              { key: "name", header: "Member", cell: (r) => <div><div className="font-medium">{r.name}</div><div className="text-xs text-muted-foreground">{r.team}</div></div> },
              { key: "score", header: "Score", align: "right", cell: (r) => r.score.toFixed(0) },
              { key: "achieved", header: "KPI %", align: "right", cell: (r) => `${r.achieved.toFixed(0)}%` },
              { key: "onTime", header: "On time", align: "right", cell: (r) => fmtPct(r.onTime, 0) },
              { key: "done", header: "Done", align: "right" },
              { key: "open", header: "Open", align: "right" },
              { key: "overdue", header: "Overdue", align: "right", cell: (r) => <span className={r.overdue ? "text-destructive" : ""}>{r.overdue}</span> },
              { key: "leads", header: "Leads", align: "right" },
              { key: "status", header: "Status", cell: (r) => <StatusBadge value={r.blocked ? "Blocked" : r.overdue > 2 ? "High" : "Active"} /> },
            ]}
          />
        </div>
      </div>
      <DemoNote />
    </>
  );
}
