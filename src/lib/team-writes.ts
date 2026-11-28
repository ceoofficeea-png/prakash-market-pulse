import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { TASK_STATUSES } from "@/lib/format";

type MemberInsert = Database["public"]["Tables"]["team_members"]["Insert"];
type MemberUpdate = Database["public"]["Tables"]["team_members"]["Update"];
type TaskInsert = Database["public"]["Tables"]["team_tasks"]["Insert"];

/**
 * Team writes run from the browser and are authorised by the RLS policies on
 * team_members / team_tasks (insert, update and delete for administrators and
 * managers). Keeping them off the server-function runtime means adding a
 * teammate, assigning a task or removing someone does not depend on a
 * service-role key or on the deployment proxying server functions. Only the
 * auth account itself (creating or deleting a sign-in) needs the server.
 */
function explain(error: { message: string; code?: string | undefined }): Error {
  const message = error.message ?? "";
  if (error.code === "42501" || /row-level security|permission denied/i.test(message)) {
    return new Error(
      "Your role cannot change team records. Sign in as an administrator or a marketing manager.",
    );
  }
  if (error.code === "23503") {
    return new Error(
      "Another record still points at this teammate, so the database refused the change. Run drizzle/migrations/0016_team_member_delete.sql in Supabase, then try again.",
    );
  }
  return new Error(message);
}

export type NewMember = {
  name: string;
  title: string;
  team: string;
  email: string;
  countryCode: string | null;
  capacityHours: number;
  managerId: number | null;
};

export async function insertTeamMember(input: NewMember): Promise<number> {
  const payload: MemberInsert = {
    name: input.name,
    title: input.title,
    team: input.team,
    email: input.email,
    country_code: input.countryCode,
    capacity_hours: input.capacityHours,
    manager_id: input.managerId,
  };
  const { data, error } = await supabase
    .from("team_members")
    .insert(payload)
    .select("id")
    .single();
  if (error) throw explain(error);
  if (!data) throw new Error("The team member was not saved.");
  return data.id;
}

/** Ownership of a roster row is this link, never an email comparison. */
export async function linkTeamMemberUser(memberId: number, userId: string): Promise<void> {
  const patch: MemberUpdate = { user_id: userId };
  const { error } = await supabase.from("team_members").update(patch).eq("id", memberId);
  if (error) throw explain(error);
}

export async function deleteTeamMember(memberId: number): Promise<void> {
  const { data, error } = await supabase
    .from("team_members")
    .delete()
    .eq("id", memberId)
    .select("id")
    .maybeSingle();
  if (error) throw explain(error);
  if (!data) throw new Error("That team member could not be removed.");
}

export type NewTask = {
  memberId: number;
  title: string;
  priority: "Low" | "Medium" | "High" | "Critical";
  dueDate: string;
  status: (typeof TASK_STATUSES)[number];
  campaignId: number | null;
  hoursLogged: number;
};

export async function insertTeamTask(input: NewTask): Promise<number> {
  const { data: auth } = await supabase.auth.getUser();
  const payload: TaskInsert = {
    member_id: input.memberId,
    title: input.title,
    priority: input.priority,
    due_date: input.dueDate,
    status: input.status,
    campaign_id: input.campaignId,
    hours_logged: input.hoursLogged,
    progress_pct: input.status === "Done" ? 100 : 0,
    completed_at: input.status === "Done" ? new Date().toISOString().slice(0, 10) : null,
    updated_by: auth.user?.id ?? null,
  };
  const { data, error } = await supabase.from("team_tasks").insert(payload).select("id").single();
  if (error) throw explain(error);
  if (!data) throw new Error("The task was not saved.");
  return data.id;
}
