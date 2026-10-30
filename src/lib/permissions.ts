export type AppRole = "admin" | "manager" | "analyst" | "viewer";

export const ROLES: { id: AppRole; label: string; description: string }[] = [
  { id: "admin", label: "Administrator", description: "Full access, user roles and API connections" },
  { id: "manager", label: "Marketing Manager", description: "Plan campaigns, tasks, reports and social" },
  { id: "analyst", label: "Analyst / Executive", description: "Work leads, content and AI insights" },
  { id: "viewer", label: "Viewer", description: "Read-only access to all dashboards" },
];

export type Permission =
  | "campaigns.edit"
  | "tasks.edit"
  | "reports.edit"
  | "social.edit"
  | "leads.edit"
  | "content.edit"
  | "insights.edit"
  | "admin.access"
  | "connections.edit"
  | "roles.edit";

const MATRIX: Record<Permission, AppRole[]> = {
  "campaigns.edit": ["admin", "manager"],
  "tasks.edit": ["admin", "manager"],
  "reports.edit": ["admin", "manager"],
  "social.edit": ["admin", "manager"],
  "leads.edit": ["admin", "manager", "analyst"],
  "content.edit": ["admin", "manager", "analyst"],
  "insights.edit": ["admin", "manager", "analyst"],
  "admin.access": ["admin"],
  "connections.edit": ["admin"],
  "roles.edit": ["admin"],
};

const RANK: Record<AppRole, number> = { admin: 4, manager: 3, analyst: 2, viewer: 1 };

/** Highest role a user holds; users with no role row are treated as viewers. */
export function primaryRole(roles: AppRole[]): AppRole {
  return roles.reduce<AppRole>((best, r) => (RANK[r] > RANK[best] ? r : best), "viewer");
}

export function can(roles: AppRole[], permission: Permission): boolean {
  return roles.some((r) => MATRIX[permission].includes(r));
}

export const roleLabel = (r: AppRole) => ROLES.find((x) => x.id === r)?.label ?? r;
