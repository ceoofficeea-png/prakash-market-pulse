import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type { TeamMember } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import { decideTaskApproval } from "@/lib/team.functions";
import type { Task } from "@/components/app/task-progress";

/**
 * Completion requests waiting at this person's end.
 *
 * An administrator or manager sees every pending request; anyone else sees the
 * requests from the teammates who report to them. The server repeats the same
 * check before it writes, so the decision is never authorised in the browser.
 */
export function ApprovalsPanel({
  memberId,
  isStaff,
  members,
  tasks,
}: {
  memberId: number | null;
  isStaff: boolean;
  members: TeamMember[];
  tasks: Task[];
}) {
  const qc = useQueryClient();
  const decideFn = useServerFn(decideTaskApproval);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [rejecting, setRejecting] = useState<Task | null>(null);
  const [note, setNote] = useState("");

  const byId = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const pending = useMemo(
    () =>
      tasks.filter(
        (task) =>
          task.approval_status === "pending" &&
          (isStaff ||
            (memberId != null && byId.get(task.member_id)?.manager_id === memberId)),
      ),
    [tasks, isStaff, memberId, byId],
  );

  const run = async (taskId: number, approve: boolean, reason?: string) => {
    setBusyId(taskId);
    try {
      await decideFn({
        data: { taskId, approve, note: reason?.trim() || undefined },
      });
      toast.success(approve ? "Completion approved" : "Sent back for more work");
      qc.invalidateQueries({ queryKey: ["team_tasks"] });
      qc.invalidateQueries({ queryKey: ["team_task_updates"] });
      setRejecting(null);
      setNote("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the decision");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="panel mb-4 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-primary" />
          <div>
            <h2 className="text-sm font-semibold">Approvals</h2>
            <p className="text-xs text-muted-foreground">
              Completion requests waiting at your end.
            </p>
          </div>
        </div>
        <span className="num text-xs text-muted-foreground">
          {pending.length} pending
        </span>
      </div>

      {pending.length === 0 ? (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-2/40 px-3 py-3 text-sm text-muted-foreground">
          <CheckCircle2 className="size-4 text-success" />
          Nothing is waiting for your approval.
        </div>
      ) : (
        <ul className="divide-y divide-border/60">
          {pending.map((task) => {
            const owner = byId.get(task.member_id);
            return (
              <li key={task.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="font-medium">{task.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {owner?.name ?? "Team member"} · marked done {fmtDate(task.updated_at)}
                  </div>
                  {task.progress_note && (
                    <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                      {task.progress_note}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    size="sm"
                    disabled={busyId === task.id}
                    onClick={() => run(task.id, true)}
                  >
                    {busyId === task.id ? "Saving…" : "Approve"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busyId === task.id}
                    onClick={() => {
                      setRejecting(task);
                      setNote("");
                    }}
                  >
                    Reject
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog
        open={rejecting !== null}
        onOpenChange={(open) => {
          if (!open) setRejecting(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Send this back</DialogTitle>
            <DialogDescription>
              {rejecting?.title} — the task returns to In Progress with your note.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="reject-note">What still needs doing?</Label>
            <textarea
              id="reject-note"
              rows={3}
              maxLength={1000}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:border-primary"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Explain what is missing so they can fix it"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejecting(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={busyId !== null}
              onClick={() => rejecting && run(rejecting.id, false, note)}
            >
              {busyId !== null ? "Saving…" : "Reject request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
