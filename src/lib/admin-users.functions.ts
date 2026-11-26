import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const input = z.object({
  fullName: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(72),
  role: z.enum(["admin", "manager", "analyst", "viewer"]),
});

const passwordInput = z.object({
  userId: z.string().uuid(),
  password: z.string().min(8).max(72),
});

/** Admin-only: create a confirmed sign-in account with a chosen role. */
export const createTeamUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => input.parse(data))
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error: roleErr } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleErr) throw new Error(roleErr.message);
    if (!isAdmin) throw new Error("Only administrators can create users.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Could not create user");

    const userId = created.user.id;
    // Signup trigger assigns a default role. Replace it through the same guarded
    // SECURITY DEFINER path the admin page uses (migration 0010) instead of
    // writing public.user_roles directly.
    const { error: assignErr } = await context.supabase.rpc("admin_set_user_role", {
      _user_id: userId,
      _role: data.role,
    });
    if (assignErr) throw new Error(assignErr.message);

    return { userId, email: data.email, role: data.role };
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
    const { data: isAdmin, error: roleErr } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleErr) throw new Error(roleErr.message);
    if (!isAdmin) throw new Error("Only administrators can reset passwords.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: data.password,
    });
    if (error) throw new Error(error.message);

    return { userId: data.userId };
  });
