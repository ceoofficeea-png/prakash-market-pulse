import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const input = z.object({
  fullName: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(72),
  role: z.enum(["admin", "manager", "analyst", "viewer"]),
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
    // Signup trigger assigns a default role; replace it with the chosen one.
    const del = await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
    if (del.error) throw new Error(del.error.message);
    const ins = await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: data.role });
    if (ins.error) throw new Error(ins.error.message);

    return { userId, email: data.email, role: data.role };
  });
