import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { USERNAME_PATTERN } from "@/lib/login-identifier";
import { ALL_MODULE_IDS } from "@/lib/permissions";
import {
  createLoginUser,
  deleteUserAccount,
  requireRole,
  setUserActive,
  setUserDetails,
  setUserModules,
  setUserRole,
} from "@/lib/user-admin.server";

const roleEnum = z.enum(["admin", "manager", "analyst", "viewer"]);
const moduleEnum = z.enum(ALL_MODULE_IDS as [string, ...string[]]);

const createInput = z.object({
  fullName: z.string().trim().min(2).max(100),
  username: z
    .string()
    .trim()
    .min(3)
    .max(32)
    .regex(USERNAME_PATTERN, "Use 3–32 letters, numbers, dot, dash or underscore."),
  contactEmail: z
    .string()
    .trim()
    .max(255)
    .optional()
    .refine((v) => !v || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), "Enter a valid email address."),
  password: z.string().min(8).max(72),
  role: roleEnum,
  modules: z.array(moduleEnum).min(1).max(ALL_MODULE_IDS.length),
});

const roleInput = z.object({
  userId: z.string().uuid(),
  role: roleEnum,
});

const modulesInput = z.object({
  userId: z.string().uuid(),
  modules: z.array(moduleEnum).min(1).max(ALL_MODULE_IDS.length),
});

const passwordInput = z.object({
  userId: z.string().uuid(),
  password: z.string().min(8).max(72),
});

const userInput = z.object({ userId: z.string().uuid() });

const activeInput = z.object({
  userId: z.string().uuid(),
  active: z.boolean(),
});

const detailsInput = z.object({
  userId: z.string().uuid(),
  employeeId: z.string().trim().max(40),
  department: z.string().trim().max(80),
  designation: z.string().trim().max(80),
  accountStatus: z.enum(["Active", "Pending", "Disabled"]),
});

/** Admin-only: create a confirmed sign-in account with a role and module access. */
export const createTeamUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => createInput.parse(data))
  .handler(async ({ data, context }) => {
    await requireRole(
      context.supabase,
      context.userId,
      ["admin"],
      "Only administrators can create users.",
    );

    const created = await createLoginUser({
      username: data.username,
      password: data.password,
      fullName: data.fullName,
      role: data.role,
      modules: data.modules,
      contactEmail: data.contactEmail,
    });

    return { userId: created.userId, username: created.username, role: data.role };
  });

/** Admin-only: change an existing account's role. */
export const updateTeamUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => roleInput.parse(data))
  .handler(async ({ data, context }) => {
    await requireRole(
      context.supabase,
      context.userId,
      ["admin"],
      "Only administrators can change roles.",
    );
    await setUserRole(data.userId, data.role);
    return { userId: data.userId, role: data.role };
  });

/** Admin-only: choose which modules an account can open. */
export const updateTeamUserModules = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => modulesInput.parse(data))
  .handler(async ({ data, context }) => {
    await requireRole(
      context.supabase,
      context.userId,
      ["admin"],
      "Only administrators can change module access.",
    );
    await setUserModules(data.userId, data.modules);
    return { userId: data.userId, modules: data.modules };
  });

/**
 * Admin-only: set a new password for an existing account.
 * Runs with the service-role client, so the target user is never required to
 * be signed in — only the caller's admin role is checked.
 */
export const updateTeamUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => passwordInput.parse(data))
  .handler(async ({ data, context }) => {
    await requireRole(
      context.supabase,
      context.userId,
      ["admin"],
      "Only administrators can reset passwords.",
    );

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: data.password,
    });
    if (error) throw new Error(error.message);

    return { userId: data.userId };
  });

/** Admin-only: employee ID, department, designation and account status. */
export const updateTeamUserProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => detailsInput.parse(data))
  .handler(async ({ data, context }) => {
    await requireRole(
      context.supabase,
      context.userId,
      ["admin"],
      "Only administrators can edit employee records.",
    );
    await setUserDetails(data);
    return { userId: data.userId, accountStatus: data.accountStatus };
  });

/** Admin-only: deactivate (ban) or reactivate a sign-in. */
export const setTeamUserActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => activeInput.parse(data))
  .handler(async ({ data, context }) => {
    await requireRole(
      context.supabase,
      context.userId,
      ["admin"],
      "Only administrators can change account status.",
    );
    if (!data.active && data.userId === context.userId) {
      throw new Error("You cannot deactivate your own account.");
    }
    await setUserActive(data.userId, data.active);
    return { userId: data.userId, active: data.active };
  });

/** Admin-only: permanently delete a sign-in and its profile. */
export const deleteTeamUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => userInput.parse(data))
  .handler(async ({ data, context }) => {
    await requireRole(
      context.supabase,
      context.userId,
      ["admin"],
      "Only administrators can delete users.",
    );
    if (data.userId === context.userId) {
      throw new Error("You cannot delete your own account.");
    }
    await deleteUserAccount(data.userId);
    return { userId: data.userId };
  });

/**
 * Admin-only: every account with its saved module access.
 * Module access lives in auth app metadata, which the browser cannot read for
 * other people, so the admin screen gets it from the server.
 */
export const listUserAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireRole(
      context.supabase,
      context.userId,
      ["admin"],
      "Only administrators can list accounts.",
    );

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    if (error) throw new Error(error.message);

    return data.users.map((u) => ({
      id: u.id,
      email: u.email ?? "",
      lastSignInAt: u.last_sign_in_at ?? null,
      modules: Array.isArray(u.app_metadata?.["modules"])
        ? (u.app_metadata["modules"] as string[])
        : null,
    }));
  });
