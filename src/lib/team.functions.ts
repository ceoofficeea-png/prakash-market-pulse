import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { TASK_STATUSES } from "@/lib/format";
import { USERNAME_PATTERN } from "@/lib/login-identifier";
import { ALL_MODULE_IDS } from "@/lib/permissions";
import { callerRoles, createLoginUser, requireRole } from "@/lib/user-admin.server";

type TaskPatch = Database["public"]["Tables"]["team_tasks"]["Update"];
type SessionClient = SupabaseClient<Database>;

const roleEnum = z.enum(["admin", "manager", "analyst", "viewer"]);
const moduleEnum = z.enum(ALL_MODULE_IDS as [string, ...string[]]);
const statusEnum = z.enum(TASK_STATUSES);

const memberLoginInput = z.object({
  fullName: z.string().trim().min(2).max(120),
  username: z
    .string()
    .trim()
    .min(3)
    .max(32)
    .regex(USERNAME_PATTERN, "Use letters, numbers, dot, dash or underscore."),
  password: z.string().min(8).max(72),
  role: roleEnum,
  modules: z.array(moduleEnum).min(1).max(ALL_MODULE_IDS.length),
  contactEmail: z.string().trim().max(255).optional(),
});

const loginRemovalInput = z.object({ userId: z.string().uuid() });

const progressInput = z.object({
  taskId: z.number().int().positive(),
  status: statusEnum,
  progressPct: z.number().int().min(0).max(100),
  note: z.string().trim().max(1000).optional(),
  completedOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

const decisionInput = z.object({
  taskId: z.number().int().positive(),
  approve: z.boolean(),
  note: z.string().trim().max(1000).optional(),
});

/** A database that has not run a later migration yet reports the column here. */
function missingColumn(message: string | undefined) {
  return !!message && /(does not exist|schema cache|could not find)/i.test(message);
}

async function adminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/**
 * Write a task row with the caller's own RLS session and fall back to the
 * service role only when that session is not allowed. Running on the service
 * role alone would make every team action fail on a deployment that has no
 * service-role key configured, which is exactly how adding a teammate or a
 * task used to break.
 */
async function writeTask(supabase: SessionClient, taskId: number, patch: TaskPatch) {
  const apply = async (client: SessionClient) =>
    client.from("team_tasks").update(patch).eq("id", taskId).select("id").maybeSingle();

  const first = await apply(supabase);
  if (!first.error && first.data) return;

  const admin = await adminClient();
  const second = await apply(admin as unknown as SessionClient);
  if (second.error || !second.data) {
    throw new Error(second.error?.message ?? first.error?.message ?? "Could not save the task.");
  }
}

/**
 * Admin/manager: create the sign-in account for a roster row that the browser
 * has already inserted.
 *
 * Only the auth account needs the server (it needs the service-role key). The
 * roster insert, the task insert and the delete run in the browser under RLS,
 * so they keep working on a deployment where server functions are proxied,
 * blocked by CSRF or missing the service-role key.
 */
export const createMemberLogin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => memberLoginInput.parse(data))
  .handler(async ({ data, context }) => {
    await requireRole(
      context.supabase,
      context.userId,
      ["admin", "manager"],
      "Only administrators and managers can create sign-ins.",
    );

    const created = await createLoginUser({
      username: data.username,
      password: data.password,
      fullName: data.fullName,
      role: data.role,
      modules: data.modules,
      contactEmail: data.contactEmail,
    });

    return { userId: created.userId, username: created.username };
  });

/** Admin/manager: delete a sign-in account (used when removing a teammate). */
export const deleteMemberLogin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => loginRemovalInput.parse(data))
  .handler(async ({ data, context }) => {
    await requireRole(
      context.supabase,
      context.userId,
      ["admin", "manager"],
      "Only administrators and managers can delete sign-ins.",
    );

    const admin = await adminClient();
    const { error } = await admin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);

    return { userId: data.userId };
  });

/**
 * Record progress on a task.
 *
 * An employee may only touch a task assigned to the roster row linked to their
 * own sign-in; administrators and managers may annotate any task. The owner is
 * resolved from the session on the server, never from the browser, and every
 * write appends to the append-only team_task_updates history.
 *
 * When an employee marks a task Done it becomes a completion request for their
 * manager to approve or reject instead of closing silently.
 */
export const updateMyTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => progressInput.parse(data))
  .handler(async ({ data, context }) => {
    const roles = await callerRoles(context.supabase, context.userId);
    const isStaff = roles.includes("admin") || roles.includes("manager");

    const { data: mine, error: memberErr } = await context.supabase
      .from("team_members")
      .select("id, name")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (memberErr) throw new Error(memberErr.message);

    const { data: task, error: taskErr } = await context.supabase
      .from("team_tasks")
      .select("id, member_id, status")
      .eq("id", data.taskId)
      .maybeSingle();
    if (taskErr) throw new Error(taskErr.message);
    if (!task) throw new Error("That task no longer exists.");

    if (!isStaff) {
      if (!mine)
        throw new Error("Your sign-in is not linked to a team member yet. Ask an administrator.");
      if (task.member_id !== mine.id) throw new Error("You can only update tasks assigned to you.");
    }

    const progress = data.status === "Done" ? 100 : data.progressPct;
    const completedAt =
      data.status === "Done" ? (data.completedOn ?? new Date().toISOString().slice(0, 10)) : null;

    const patch: TaskPatch = {
      status: data.status,
      progress_pct: progress,
      progress_note: data.note ?? null,
      completed_at: completedAt,
      updated_by: context.userId,
      updated_at: new Date().toISOString(),
      // Staff close their own tasks; an employee's completion waits for approval.
      approval_status: data.status === "Done" ? (isStaff ? "approved" : "pending") : "none",
      ...(data.status === "Done" ? {} : { approval_note: null }),
    };

    try {
      await writeTask(context.supabase, data.taskId, patch);
    } catch (err) {
      // Older database without the approval columns: keep progress working.
      if (!missingColumn(err instanceof Error ? err.message : "")) throw err;
      const legacy: TaskPatch = { ...patch };
      delete legacy.approval_status;
      delete legacy.approval_note;
      await writeTask(context.supabase, data.taskId, legacy);
    }

    const { data: profile } = await context.supabase
      .from("profiles")
      .select("full_name")
      .eq("id", context.userId)
      .maybeSingle();

    const audit = {
      task_id: data.taskId,
      author_id: context.userId,
      author_name: mine?.name ?? profile?.full_name ?? "Team member",
      status: data.status,
      progress_pct: progress,
      note: data.note ?? null,
    };
    const logged = await context.supabase.from("team_task_updates").insert(audit);
    if (logged.error) {
      const admin = await adminClient();
      const retry = await admin.from("team_task_updates").insert(audit);
      if (retry.error) throw new Error(retry.error.message);
    }

    return { taskId: data.taskId, status: data.status, progressPct: progress };
  });

/**
 * Approve or reject a completion request that is pending at this person's end:
 * administrators and managers decide any request, and a teammate's own manager
 * decides the requests from the people who report to them.
 */
export const decideTaskApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => decisionInput.parse(data))
  .handler(async ({ data, context }) => {
    const roles = await callerRoles(context.supabase, context.userId);
    const isStaff = roles.includes("admin") || roles.includes("manager");

    const { data: myMember } = await context.supabase
      .from("team_members")
      .select("id, name")
      .eq("user_id", context.userId)
      .maybeSingle();

    const { data: task, error: taskErr } = await context.supabase
      .from("team_tasks")
      .select("*")
      .eq("id", data.taskId)
      .maybeSingle();
    if (taskErr) {
      if (missingColumn(taskErr.message)) {
        throw new Error(
          "Approvals are not enabled on this database yet. Run drizzle/migrations/0014_task_approvals.sql.",
        );
      }
      throw new Error(taskErr.message);
    }
    if (!task) throw new Error("That task no longer exists.");

    const { data: owner } = await context.supabase
      .from("team_members")
      .select("id, name, manager_id")
      .eq("id", task.member_id)
      .maybeSingle();

    const isTheirManager =
      !!myMember && owner?.manager_id != null && owner.manager_id === myMember.id;
    if (!isStaff && !isTheirManager) {
      throw new Error("Only this person's manager or an administrator can decide this request.");
    }

    const pending = (task as { approval_status?: string }).approval_status;
    if (pending === undefined) {
      throw new Error(
        "Approvals are not enabled on this database yet. Run drizzle/migrations/0014_task_approvals.sql.",
      );
    }
    if (pending !== "pending") throw new Error("This request has already been decided.");

    const today = new Date().toISOString().slice(0, 10);
    const decidedAt = new Date().toISOString();
    const patch: TaskPatch = data.approve
      ? {
          approval_status: "approved",
          approval_note: data.note ?? null,
          approval_by: context.userId,
          approval_at: decidedAt,
          status: "Done",
          progress_pct: 100,
          completed_at: task.completed_at ?? today,
        }
      : {
          approval_status: "rejected",
          approval_note: data.note ?? "Sent back for more work.",
          approval_by: context.userId,
          approval_at: decidedAt,
          status: "In Progress",
          completed_at: null,
        };

    await writeTask(context.supabase, data.taskId, patch);

    const { data: profile } = await context.supabase
      .from("profiles")
      .select("full_name")
      .eq("id", context.userId)
      .maybeSingle();

    const audit = {
      task_id: data.taskId,
      author_id: context.userId,
      author_name: myMember?.name ?? profile?.full_name ?? "Reviewer",
      status: data.approve ? "Done" : "In Progress",
      progress_pct: data.approve ? 100 : Number(task.progress_pct ?? 0),
      note: data.approve
        ? data.note
          ? `Completion approved — ${data.note}`
          : "Completion approved"
        : `Completion rejected — ${data.note ?? "sent back for more work"}`,
    };
    const logged = await context.supabase.from("team_task_updates").insert(audit);
    if (logged.error) {
      const admin = await adminClient();
      const retry = await admin.from("team_task_updates").insert(audit);
      if (retry.error) throw new Error(retry.error.message);
    }

    return { taskId: data.taskId, approvalStatus: patch.approval_status };
  });
