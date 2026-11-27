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
  | "leads.read"
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
  "leads.read": ["admin", "manager", "analyst"],
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

/** Viewers have no row-level read access to leads; mirrors the RLS policy on leads/lead_activities. */
export const canReadLeads = (roles: AppRole[]) => can(roles, "leads.read");

/* ---------- Module access ---------- */
/**
 * Every top-level module a signed-in user can be given. Roles decide what a
 * person may *do* (edit, read leads, administer); module access decides which
 * of these screens they see at all. Administrators always see everything.
 * Stored on the auth user's `app_metadata.modules`, which only the service role
 * can write, so a user cannot grant themselves modules from the browser.
 */
export const MODULES = [
  { id: "overview", label: "Executive Overview", to: "/overview" },
  { id: "reports", label: "CEO Dashboard & Reports", to: "/reports" },
  { id: "ai", label: "AI Intelligence", to: "/ai" },
  { id: "social", label: "Social Media", to: "/social" },
  { id: "ads", label: "Google & Meta Ads", to: "/ads" },
  { id: "web", label: "Website & SEO", to: "/web" },
  { id: "content", label: "Content", to: "/content" },
  { id: "campaigns", label: "Campaigns", to: "/campaigns" },
  { id: "crm", label: "CRM & Leads", to: "/crm" },
  { id: "markets", label: "Markets", to: "/markets" },
  { id: "competitors", label: "Competitors", to: "/competitors" },
  { id: "team", label: "Team Performance", to: "/team" },
  { id: "admin", label: "Administration", to: "/admin" },
] as const;

export type ModuleId = (typeof MODULES)[number]["id"];
export type ModulePath = (typeof MODULES)[number]["to"];

export const ALL_MODULE_IDS = MODULES.map((m) => m.id) as ModuleId[];

/** Modules a person can be granted explicitly (Administration is role-gated). */
export const GRANTABLE_MODULES = MODULES.filter((m) => m.id !== "admin");
export const GRANTABLE_MODULE_IDS = GRANTABLE_MODULES.map((m) => m.id) as ModuleId[];

/** Which module owns a pathname, e.g. `/team/12` → team. */
export function moduleForPath(pathname: string): ModuleId | null {
  const hit = MODULES.find((m) => pathname === m.to || pathname.startsWith(`${m.to}/`));
  return hit?.id ?? null;
}

/**
 * Modules this user may open. `modules == null` means no restriction has been
 * saved yet, which keeps existing accounts (and self sign-ups) fully visible.
 */
export function allowedModules(modules: string[] | null | undefined, role: AppRole): ModuleId[] {
  if (role === "admin" || modules == null) return ALL_MODULE_IDS;
  return ALL_MODULE_IDS.filter((id) => modules.includes(id));
}

export const moduleLabel = (id: string) => MODULES.find((m) => m.id === id)?.label ?? id;
