import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ClipboardCheck } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { DataTable } from "@/components/app/data-table";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { TeamMember } from "@/lib/api";
import { fmtDate, TASK_STATUSES } from "@/lib/format";
import { updateMyTask } from "@/lib/team.functions";

export type Task = Database["public"]["Tables"]["team_tasks"]["Row"];

/** Review state of a completion request. */
export function ApprovalBadge({ status }: { status?: string | null | undefined }) {
  if (!status || status === "none") return null;
  const styles: Record<string, { label: string; className: string }> = {
    pending: { label: "Pending approval", className: "border-warning/50 text-warning" },
    approved: { label: "Approved", className: "border-success/50 text-success" },
    rejected: { label: "Rejected", className: "border-destructive/50 text-destructive" },
  };
  const style = styles[status];
  if (!style) return null;
  return (
    <span
      className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${style.className}`}
    >
      {style.label}
    </span>
  );
}

const todayIso = () => new Date().toISOString().slice(0, 10);
const stamp = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

/**
 * Progress editor for one task.
 * The server decides whether this person may touch it and writes the audit row.
 */
export function UpdateTaskDialog({ task, isStaff = false }: { task: Task; isStaff?: boolean }) {
  const qc = useQueryClient();
  const update = useServerFn(updateMyTask);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(task.status);
  const [progress, setProgress] = useState(String(task.progress_pct ?? 0));
  const [note, setNote] = useState("");
  const [completedOn, setCompletedOn] = useState(task.completed_at ?? todayIso());

  const pct = Math.max(0, Math.min(100, Number(progress) || 0));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await update({
        data: {
          taskId: task.id,
          status: status as (typeof TASK_STATUSES)[number],
          progressPct: pct,
          note: note.trim() || undefined,
          completedOn: status === "Done" ? completedOn : undefined,
        },
      });
      toast.success("Progress saved");
      qc.invalidateQueries({ queryKey: ["team_tasks"] });
      qc.invalidateQueries({ queryKey: ["team_task_updates"] });
      setNote("");
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the update");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 px-2 text-xs">
          Update
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Update progress</DialogTitle>
          <DialogDescription>{task.title}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TASK_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tp-pct">Completion</Label>
            <div className="flex items-center gap-3">
              <Input
                id="tp-pct"
                type="number"
                min={0}
                max={100}
                value={progress}
                disabled={status === "Done"}
                onChange={(e) => setProgress(e.target.value)}
                className="w-24"
              />
              <Progress value={status === "Done" ? 100 : pct} className="h-1.5 flex-1" />
              <span className="num w-10 text-right text-xs text-muted-foreground">
                {status === "Done" ? 100 : pct}%
              </span>
            </div>
          </div>
          {status === "Done" && (
            <div className="space-y-1.5">
              <Label htmlFor="tp-done">Completed on</Label>
              <Input
                id="tp-done"
                type="date"
                value={completedOn}
                onChange={(e) => setCompletedOn(e.target.value)}
              />
              {!isStaff && (
                <p className="text-xs text-muted-foreground">
                  Marking this Done sends an approval request to your manager.
                </p>
              )}
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="tp-note">Progress remark</Label>
            <textarea
              id="tp-note"
              rows={3}
              maxLength={1000}
              placeholder="What moved, and what is blocking it"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:border-primary"
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save update"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Append-only history for a set of tasks, newest first. */
export function TaskActivity({
  taskIds,
  title = "Task activity",
}: {
  taskIds: number[];
  title?: string;
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["team_task_updates", taskIds.join(",")],
    enabled: taskIds.length > 0,
    queryFn: async () => {
      const { data: rows, error: readErr } = await supabase
        .from("team_task_updates")
        .select("*")
        .in("task_id", taskIds)
        .order("created_at", { ascending: false })
        .limit(15);
      if (readErr) throw readErr;
      return rows;
    },
  });

  return (
    <div className="panel p-4">
      <div className="mb-2 flex items-center gap-2">
        <ClipboardCheck className="size-4 text-primary" />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      {error && <p className="text-sm text-destructive">{error.message}</p>}
      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!isLoading && !error && !data?.length && (
        <p className="text-sm text-muted-foreground">No progress updates yet.</p>
      )}
      <ul className="divide-y divide-border/60">
        {(data ?? []).map((u) => (
          <li key={u.id} className="py-2 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">{u.author_name ?? "Team member"}</span>
              <span className="num text-xs text-muted-foreground">{stamp(u.created_at)}</span>
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {u.status && <StatusBadge value={u.status} />}
              {u.progress_pct != null && <span className="num">{u.progress_pct}%</span>}
            </div>
            {u.note && <p className="mt-1 text-muted-foreground">{u.note}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}

const isDone = (t: Task) => t.status === "Done";
const isOpen = (t: Task) => !isDone(t);

/** The signed-in employee's own workload, with the update action on every task. */
export function MyTasksPanel({
  member,
  tasks,
  isStaff = false,
}: {
  member: TeamMember;
  tasks: Task[];
  isStaff?: boolean;
}) {
  const mine = useMemo(() => tasks.filter((t) => t.member_id === member.id), [tasks, member.id]);
  const today = todayIso();
  const open = mine.filter(isOpen);
  const done = mine.filter(isDone);
  const overdue = open.filter((t) => t.due_date < today);
  const dueToday = open.filter((t) => t.due_date === today);
  const inProgress = mine.filter((t) => t.status === "In Progress");
  const pending = open.filter((t) => t.status !== "In Progress");
  const completion = mine.length ? Math.round((done.length / mine.length) * 100) : 0;

  const stats = [
    { label: "Assigned", value: mine.length },
    { label: "Today", value: dueToday.length },
    { label: "In progress", value: inProgress.length },
    { label: "Pending", value: pending.length },
    { label: "Overdue", value: overdue.length },
    { label: "Completed", value: done.length },
  ];

  return (
    <section className="panel mb-4 p-4">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="eyebrow">My work</div>
          <h2 className="text-base font-semibold">Tasks assigned to {member.name}</h2>
        </div>
        <div className="text-xs text-muted-foreground">
          {done.length} of {mine.length} complete · <span className="num">{completion}%</span>
        </div>
      </div>
      <Progress value={completion} className="mb-4 h-1.5" />

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border border-border bg-surface-2/40 p-2">
            <div className="eyebrow">{s.label}</div>
            <div
              className={`num text-lg ${s.label === "Overdue" && s.value > 0 ? "text-destructive" : "text-foreground"}`}
            >
              {s.value}
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <DataTable
            rows={mine}
            rowKey={(r) => r.id}
            searchKeys={[(r) => r.title]}
            exportName={`my-tasks-${member.name.replace(/\s+/g, "-").toLowerCase()}`}
            initialSort={{ key: "due_date", dir: "asc" }}
            pageSize={8}
            columns={[
              {
                key: "title",
                header: "Task",
                cell: (r) => (
                  <div>
                    <div className="font-medium">{r.title}</div>
                    {r.progress_note && (
                      <div className="max-w-64 truncate text-xs text-muted-foreground">
                        {r.progress_note}
                      </div>
                    )}
                  </div>
                ),
              },
              {
                key: "priority",
                header: "Priority",
                cell: (r) => <StatusBadge value={r.priority} />,
              },
              {
                key: "due_date",
                header: "Due",
                cell: (r) => (
                  <span
                    className={`num text-xs ${isOpen(r) && r.due_date < today ? "text-destructive" : ""}`}
                  >
                    {fmtDate(r.due_date)}
                  </span>
                ),
              },
              {
                key: "progress_pct",
                header: "Progress",
                align: "right",
                value: (r) => Number(r.progress_pct ?? 0),
                cell: (r) => <span className="num text-xs">{Number(r.progress_pct ?? 0)}%</span>,
              },
              {
                key: "status",
                header: "Status",
                cell: (r) => (
                  <div className="flex flex-wrap items-center gap-1">
                    <StatusBadge value={r.status} />
                    <ApprovalBadge status={r.approval_status} />
                  </div>
                ),
              },
              {
                key: "update",
                header: "",
                sortable: false,
                cell: (r) => <UpdateTaskDialog task={r} isStaff={isStaff} />,
              },
            ]}
          />
        </div>
        <TaskActivity taskIds={mine.map((t) => t.id)} title="My recent updates" />
      </div>
    </section>
  );
}
