import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { TASK_STATUSES } from "@/lib/format";
import { USERNAME_PATTERN } from "@/lib/login-identifier";
import { ALL_MODULE_IDS } from "@/lib/permissions";
import { callerRoles, createLoginUser, requireRole } from "@/lib/user-admin.server";

const roleEnum = z.enum(["admin", "manager", "analyst", "viewer"]);
const moduleEnum = z.enum(ALL_MODULE_IDS as [string, ...string[]]);
const statusEnum = z.enum(TASK_STATUSES);
const priorityEnum = z.enum(["Low", "Medium", "High", "Critical"]);

const memberInput = z.object({
  name: z.string().trim().min(2).max(120),
  title: z.string().trim().min(2).max(120),
  team: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(255),
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

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: member, error } = await supabaseAdmin
      .from("team_members")
      .insert({
        name: data.name,
        title: data.title,
        team: data.team,
        email: data.email,
        country_code: data.countryCode,
        capacity_hours: data.capacityHours,
        manager_id: data.managerId,
      })
      .select("id")
      .single();
    if (error || !member) throw new Error(error?.message ?? "Could not add the team member");

    let userId: string | null = null;
    if (data.login) {
      const created = await createLoginUser({
        username: data.login.username,
        password: data.login.password,
        fullName: data.name,
        role: data.login.role,
        modules: data.login.modules,
        contactEmail: data.email,
      });
      userId = created.userId;

      // Ownership is decided by this link, not by comparing email addresses.
      const { error: linkErr } = await supabaseAdmin
        .from("team_members")
        .update({ user_id: userId })
        .eq("id", member.id);
      if (linkErr) throw new Error(linkErr.message);
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

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: task, error } = await supabaseAdmin
      .from("team_tasks")
      .insert({
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
      })
      .select("id")
      .single();
    if (error || !task) throw new Error(error?.message ?? "Could not assign the task");

    return { taskId: task.id };
  });

/**
 * Record progress on a task.
 *
 * An employee may only touch a task assigned to the roster row linked to their
 * own sign-in; administrators and managers may annotate any task. The owner is
 * resolved from the session on the server, never from the browser, and every
 * write appends to the append-only team_task_updates history.
 */
export const updateMyTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => progressInput.parse(data))
  .handler(async ({ data, context }) => {
    const roles = await callerRoles(context.supabase, context.userId);
    const isStaff = roles.includes("admin") || roles.includes("manager");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: mine, error: memberErr } = await supabaseAdmin
      .from("team_members")
      .select("id, name")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (memberErr) throw new Error(memberErr.message);

    const { data: task, error: taskErr } = await supabaseAdmin
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

    const { error: updateErr } = await supabaseAdmin
      .from("team_tasks")
      .update({
        status: data.status,
        progress_pct: progress,
        progress_note: data.note ?? null,
        completed_at: completedAt,
        updated_by: context.userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.taskId);
    if (updateErr) throw new Error(updateErr.message);

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", context.userId)
      .maybeSingle();

    const { error: logErr } = await supabaseAdmin.from("team_task_updates").insert({
      task_id: data.taskId,
      author_id: context.userId,
      author_name: mine?.name ?? profile?.full_name ?? "Team member",
      status: data.status,
      progress_pct: progress,
      note: data.note ?? null,
    });
    if (logErr) throw new Error(logErr.message);

    return { taskId: data.taskId, status: data.status, progressPct: progress };
  });
