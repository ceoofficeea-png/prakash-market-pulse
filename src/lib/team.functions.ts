import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { TASK_STATUSES } from "@/lib/format";
import { signInEmail, USERNAME_PATTERN } from "@/lib/login-identifier";
import { ALL_MODULE_IDS } from "@/lib/permissions";
import { callerRoles, createLoginUser, requireRole } from "@/lib/user-admin.server";

type TaskPatch = Database["public"]["Tables"]["team_tasks"]["Update"];
type SessionClient = SupabaseClient<Database>;

const roleEnum = z.enum(["admin", "manager", "analyst", "viewer"]);
const moduleEnum = z.enum(ALL_MODULE_IDS as [string, ...string[]]);
const statusEnum = z.enum(TASK_STATUSES);
const priorityEnum = z.enum(["Low", "Medium", "High", "Critical"]);

const memberInput = z.object({
  name: z.string().trim().min(2).max(120),
  title: z.string().trim().min(2).max(120),
  team: z.string().trim().min(2).max(80),
  /** Optional: a username or work email is enough to reach this person. */
  email: z.string().trim().max(255).optional(),
  countryCode: z.string().trim().length(2).nullable(),
  capacityHours: z.number().int().min(8).max(400),
  managerId: z.number().int().positive().nullable(),
  login: z
    .object({
      username: z
        .string()
        .trim()
        .min(3)
        .max(32)
        .regex(USERNAME_PATTERN, "Use letters, numbers, dot, dash or underscore."),
      password: z.string().min(8).max(72),
      role: roleEnum,
      modules: z.array(moduleEnum).min(1).max(ALL_MODULE_IDS.length),
    })
    .nullable(),
});

const taskInput = z.object({
  memberId: z.number().int().positive(),
  title: z.string().trim().min(3).max(160),
  priority: priorityEnum,
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: statusEnum,
  campaignId: z.number().int().positive().nullable(),
  hoursLogged: z.number().min(0).max(999),
});

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

const removeInput = z.object({
  memberId: z.number().int().positive(),
  deleteLogin: z.boolean().optional(),
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

/** Admin/manager: add a teammate to the performance roster (optionally with a login). */
export const createTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => memberInput.parse(data))
  .handler(async ({ data, context }) => {
    await requireRole(
      context.supabase,
      context.userId,
      ["admin", "manager"],
      "Only administrators and managers can add team members.",
    );

    const internalEmail = data.login ? signInEmail(data.login.username) : "";
    const payload = {
      name: data.name,
      title: data.title,
      team: data.team,
      email: data.email?.trim() || internalEmail,
      country_code: data.countryCode,
      capacity_hours: data.capacityHours,
      manager_id: data.managerId,
    };

    let member: { id: number } | null = null;
    const attempt = await context.supabase
      .from("team_members")
      .insert(payload)
      .select("id")
      .single();
    if (!attempt.error && attempt.data) {
      member = attempt.data;
    } else {
      const admin = await adminClient();
      const retry = await admin.from("team_members").insert(payload).select("id").single();
      if (retry.error || !retry.data) {
        throw new Error(
          retry.error?.message ?? attempt.error?.message ?? "Could not add the team member.",
        );
      }
      member = retry.data;
    }

    if (!data.login) return { memberId: member.id, userId: null };

    let userId: string;
    try {
      const created = await createLoginUser({
        username: data.login.username,
        password: data.login.password,
        fullName: data.name,
        role: data.login.role,
        modules: data.login.modules,
        contactEmail: data.email?.trim() || undefined,
      });
      userId = created.userId;
    } catch (err) {
      // Do not leave a roster row behind when the sign-in could not be created.
      await context.supabase.from("team_members").delete().eq("id", member.id);
      throw err;
    }

    // Ownership is decided by this link, not by comparing email addresses.
    const linked = await context.supabase
      .from("team_members")
      .update({ user_id: userId })
      .eq("id", member.id);
    if (linked.error) {
      const admin = await adminClient();
      const retry = await admin.from("team_members").update({ user_id: userId }).eq("id", member.id);
      if (retry.error) throw new Error(retry.error.message);
    }

    return { memberId: member.id, userId };
  });

/** Admin/manager: assign a task to a teammate. */
export const assignTeamTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => taskInput.parse(data))
  .handler(async ({ data, context }) => {
    await requireRole(
      context.supabase,
      context.userId,
      ["admin", "manager"],
      "Only administrators and managers can assign tasks.",
    );

    const payload = {
      member_id: data.memberId,
      title: data.title,
      priority: data.priority,
      due_date: data.dueDate,
      status: data.status,
      campaign_id: data.campaignId,
      hours_logged: data.hoursLogged,
      progress_pct: data.status === "Done" ? 100 : 0,
      completed_at: data.status === "Done" ? new Date().toISOString().slice(0, 10) : null,
      updated_by: context.userId,
    };

    const attempt = await context.supabase.from("team_tasks").insert(payload).select("id").single();
    if (!attempt.error && attempt.data) return { taskId: attempt.data.id };

    const admin = await adminClient();
    const retry = await admin.from("team_tasks").insert(payload).select("id").single();
    if (retry.error || !retry.data) {
      throw new Error(retry.error?.message ?? attempt.error?.message ?? "Could not assign the task.");
    }
    return { taskId: retry.data.id };
  });

/** Admin/manager: remove a teammate (their tasks cascade) and optionally their sign-in. */
export const removeTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => removeInput.parse(data))
  .handler(async ({ data, context }) => {
    await requireRole(
      context.supabase,
      context.userId,
      ["admin", "manager"],
      "Only administrators and managers can remove team members.",
    );

    const { data: member, error: readError } = await context.supabase
      .from("team_members")
      .select("id, name, user_id")
      .eq("id", data.memberId)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!member) throw new Error("That team member no longer exists.");

    const attempt = await context.supabase
      .from("team_members")
      .delete()
      .eq("id", member.id)
      .select("id")
      .maybeSingle();
    if (attempt.error || !attempt.data) {
      const admin = await adminClient();
      const retry = await admin
        .from("team_members")
        .delete()
        .eq("id", member.id)
        .select("id")
        .maybeSingle();
      if (retry.error || !retry.data) {
        throw new Error(retry.error?.message ?? attempt.error?.message ?? "Could not remove the member.");
      }
    }

    if (data.deleteLogin && member.user_id) {
      try {
        const admin = await adminClient();
        const { error } = await admin.auth.admin.deleteUser(member.user_id);
        if (error) throw new Error(error.message);
      } catch (err) {
        throw new Error(
          `${member.name} was removed from the team, but their sign-in could not be deleted: ${
            err instanceof Error ? err.message : "unknown error"
          }`,
        );
      }
    }

    return { memberId: member.id, name: member.name };
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
