// Server-only helpers for auth-user administration.
// Account creation and role/module writes always run with the service-role
// client after the caller's own role has been checked, so they work even on a
// database that has not had every admin RPC migration applied yet.
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { isValidUsername, normaliseUsername, signInEmail } from "@/lib/login-identifier";
import type { AppRole } from "@/lib/permissions";

type Client = SupabaseClient<Database>;

async function adminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Roles the signed-in caller holds, read through their own RLS-scoped session. */
export async function callerRoles(supabase: Client, userId: string): Promise<AppRole[]> {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => r.role as AppRole);
}

export async function requireRole(
  supabase: Client,
  userId: string,
  roles: AppRole[],
  message: string,
): Promise<void> {
  const held = await callerRoles(supabase, userId);
  if (!held.some((r) => roles.includes(r))) throw new Error(message);
}

/** Replace a user's role, refusing to leave the workspace without an admin. */
export async function setUserRole(userId: string, role: AppRole): Promise<void> {
  const admin = await adminClient();
  const { data: current, error: readErr } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (readErr) throw new Error(readErr.message);

  if (role !== "admin" && (current ?? []).some((r) => r.role === "admin")) {
    const { count, error } = await admin
      .from("user_roles")
      .select("user_id", { count: "exact", head: true })
      .eq("role", "admin")
      .neq("user_id", userId);
    if (error) throw new Error(error.message);
    if (!count) throw new Error("The last administrator cannot be demoted.");
  }

  const { error: delErr } = await admin.from("user_roles").delete().eq("user_id", userId);
  if (delErr) throw new Error(delErr.message);
  const { error: insErr } = await admin.from("user_roles").insert({ user_id: userId, role });
  if (insErr) throw new Error(insErr.message);
}

/**
 * Create a confirmed sign-in account with a unique username, a role and module
 * access. The email address is optional: the auth record uses the deterministic
 * `<username>@prakashpump.local` address, so people sign in with the username
 * they were given and never need an inbox.
 */
export async function createLoginUser(input: {
  username: string;
  password: string;
  fullName: string;
  role: AppRole;
  modules: string[];
  contactEmail?: string | undefined;
}): Promise<{ userId: string; username: string }> {
  const username = normaliseUsername(input.username);
  if (!isValidUsername(username)) {
    throw new Error("Usernames need 3–32 characters: letters, numbers, dot, dash or underscore.");
  }

  const admin = await adminClient();
  const { data: taken, error: takenErr } = await admin
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();
  if (takenErr) throw new Error(takenErr.message);
  if (taken) throw new Error(`The username "${username}" is already taken.`);

  const email = signInEmail(username);
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: input.fullName, username },
    app_metadata: { modules: input.modules },
  });
  if (error || !created.user) throw new Error(error?.message ?? "Could not create the login");

  const userId = created.user.id;
  const contactEmail = input.contactEmail?.trim() || "";

  // The signup trigger normally creates the profile; upsert covers a database
  // where that trigger is missing and keeps the name and handle in sync.
  const { error: profileErr } = await admin
    .from("profiles")
    .upsert({ id: userId, full_name: input.fullName, email: contactEmail || email, username });
  if (profileErr) throw new Error(profileErr.message);

  await setUserRole(userId, input.role);
  return { userId, username };
}

/** Block or restore a sign-in, keeping profiles.account_status in step. */
export async function setUserActive(userId: string, active: boolean): Promise<void> {
  const admin = await adminClient();

  // A ban of ~100 years is Supabase's supported way to disable sign-in without
  // deleting the account; "none" lifts it again.
  const { error } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: active ? "none" : "876000h",
  });
  if (error) throw new Error(error.message);

  const { error: profileErr } = await admin
    .from("profiles")
    .update({ account_status: active ? "Active" : "Disabled" })
    .eq("id", userId);
  if (profileErr) throw new Error(profileErr.message);
}

/** Employee ID, department, designation and account status on the profile. */
export async function setUserDetails(input: {
  userId: string;
  employeeId?: string | undefined;
  department?: string | undefined;
  designation?: string | undefined;
  accountStatus: "Active" | "Pending" | "Disabled";
}): Promise<void> {
  const admin = await adminClient();
  const { data: updated, error } = await admin
    .from("profiles")
    .update({
      employee_id: input.employeeId?.trim() || null,
      department: input.department?.trim() || null,
      designation: input.designation?.trim() || null,
      account_status: input.accountStatus,
    })
    .eq("id", input.userId)
    .select("id");

  if (error) {
    if (error.code === "23505") {
      throw new Error("That employee ID is already used by another account.");
    }
    throw new Error(error.message);
  }
  if (!updated || updated.length === 0) throw new Error("Unknown user");

  // Keep the sign-in ban in step with the status that was just saved, without
  // clobbering a "Pending" label (setUserActive would rewrite it to Active).
  const { error: banErr } = await admin.auth.admin.updateUserById(input.userId, {
    ban_duration: input.accountStatus === "Disabled" ? "876000h" : "none",
  });
  if (banErr) throw new Error(banErr.message);
}

/**
 * Permanently delete a sign-in. The profile and roles cascade, roster rows are
 * unlinked (team_members.user_id is set null) and ownership columns are cleared.
 * The last administrator cannot be removed.
 */
export async function deleteUserAccount(userId: string): Promise<void> {
  const admin = await adminClient();

  const { data: roles, error: rolesErr } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (rolesErr) throw new Error(rolesErr.message);

  if ((roles ?? []).some((r) => r.role === "admin")) {
    const { count, error } = await admin
      .from("user_roles")
      .select("user_id", { count: "exact", head: true })
      .eq("role", "admin")
      .neq("user_id", userId);
    if (error) throw new Error(error.message);
    if (!count) throw new Error("The last administrator cannot be deleted.");
  }

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw new Error(error.message);
}

/** Replace the module list on a user's app metadata (admin-only data). */
export async function setUserModules(userId: string, modules: string[]): Promise<void> {
  const admin = await adminClient();
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data.user) throw new Error(error?.message ?? "Unknown user");
  const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: { ...data.user.app_metadata, modules },
  });
  if (updateError) throw new Error(updateError.message);
}
