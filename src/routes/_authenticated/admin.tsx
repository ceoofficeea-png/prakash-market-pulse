import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Database, Plug, ShieldCheck, Users } from "lucide-react";
import { toast } from "sonner";

import { AddUserDialog } from "@/components/app/add-user-dialog";
import { DataTable } from "@/components/app/data-table";
import { KpiCard } from "@/components/app/kpi-card";
import { ModuleAccessDialog } from "@/components/app/module-access";
import { KpiGrid, NoAccess, PageHeader } from "@/components/app/page";
import { ChangeMyPasswordCard, ResetPasswordDialog } from "@/components/app/password-actions";
import { StatusBadge } from "@/components/app/status-badge";
import {
  ACCOUNT_STATUSES,
  AccountStatusAction,
  DeleteUserAction,
  EditUserDetailsDialog,
  type AccountStatus,
} from "@/components/app/user-admin-actions";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { listUserAccess, updateTeamUserRole } from "@/lib/admin-users.functions";
import { useConnections, useCurrentUser } from "@/lib/api";
import { fmtDate, initials } from "@/lib/format";
import { GRANTABLE_MODULES, can, primaryRole, ROLES, type AppRole } from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Administration \u2014 Prakash Pump" },
      {
        name: "description",
        content: "Administration analytics and records for the Prakash Pump marketing team.",
      },
      { property: "og:title", content: "Administration \u2014 Prakash Pump" },
      {
        property: "og:description",
        content: "Administration analytics and records for the Prakash Pump marketing team.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminPage,
});

const MATRIX: { area: string; roles: AppRole[] }[] = [
  { area: "View all dashboards & reports", roles: ["admin", "manager", "analyst", "viewer"] },
  { area: "Work leads, content & AI insights", roles: ["admin", "manager", "analyst"] },
  { area: "Create campaigns, tasks, reports & social", roles: ["admin", "manager"] },
  { area: "Manage users, roles & API connections", roles: ["admin"] },
];

const TABLES = [
  ["countries", "Markets & market intelligence"],
  ["products", "Product lines"],
  ["campaigns", "Campaign plans and budgets"],
  ["channel_daily_metrics", "Daily paid media by campaign × country × platform"],
  ["social_accounts / social_posts / social_account_daily", "Social audiences and posts"],
  ["web_daily_metrics / web_pages / seo_keywords", "Website traffic and SEO"],
  ["content_items", "Content pipeline"],
  ["leads / lead_activities", "CRM leads and activity"],
  ["competitors / competitor_monthly / competitor_activities", "Competitive intelligence"],
  ["team_members / team_tasks / team_monthly_kpis", "Team and performance"],
  ["ai_insights", "AI recommendations"],
  ["reports", "Report schedules"],
  ["api_connections", "Integrations"],
];

function AdminPage() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  const connections = useConnections();
  const isAdmin = can(me.data?.roles ?? [], "admin.access");

  const listAccess = useServerFn(listUserAccess);
  const changeRole = useServerFn(updateTeamUserRole);

  const users = useQuery({
    queryKey: ["admin-users"],
    enabled: isAdmin,
    queryFn: async () => {
      const [profiles, roles, access, members, tasks] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at"),
        supabase.from("user_roles").select("user_id, role"),
        listAccess(),
        supabase.from("team_members").select("id, user_id"),
        supabase.from("team_tasks").select("member_id"),
      ]);
      if (profiles.error) throw profiles.error;
      if (roles.error) throw roles.error;
      if (members.error) throw members.error;
      if (tasks.error) throw tasks.error;
      // Group roles once (O(n + m)) instead of filtering the full role list for every profile.
      const byUser = new Map<string, AppRole[]>();
      for (const row of roles.data ?? []) {
        const list = byUser.get(row.user_id);
        if (list) list.push(row.role as AppRole);
        else byUser.set(row.user_id, [row.role as AppRole]);
      }
      // Module access lives on auth app metadata, so it arrives from the server.
      const modulesById = new Map(access.map((a) => [a.id, a.modules]));
      const signInById = new Map(access.map((a) => [a.id, a.lastSignInAt]));
      // Map roster row -> sign-in, then count assigned tasks per sign-in.
      const memberUserById = new Map((members.data ?? []).map((m) => [m.id, m.user_id]));
      const taskCountByUser = new Map<string, number>();
      for (const t of tasks.data ?? []) {
        const uid = memberUserById.get(t.member_id);
        if (uid) taskCountByUser.set(uid, (taskCountByUser.get(uid) ?? 0) + 1);
      }
      return (profiles.data ?? []).map((u) => ({
        ...u,
        role: primaryRole(byUser.get(u.id) ?? []),
        modules: modulesById.get(u.id) ?? null,
        lastSignInAt: signInById.get(u.id) ?? null,
        tasks: taskCountByUser.get(u.id) ?? 0,
      }));
    },
  });

  const setRole = useMutation({
    // Role writes run server-side with the service role after checking the
    // caller is an admin, so they do not depend on an optional RPC migration.
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      await changeRole({ data: { userId, role } });
    },
    onSuccess: () => {
      toast.success("Role updated");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const [deptFilter, setDeptFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const allUsers = users.data ?? [];
  const departments = useMemo(
    () =>
      Array.from(
        new Set(allUsers.map((u) => u.department).filter((d): d is string => Boolean(d))),
      ).sort(),
    [allUsers],
  );
  const filteredUsers = useMemo(
    () =>
      allUsers.filter((u) => {
        if (deptFilter !== "all" && (u.department ?? "") !== deptFilter) return false;
        if (roleFilter !== "all" && u.role !== roleFilter) return false;
        if (statusFilter !== "all" && (u.account_status || "Active") !== statusFilter)
          return false;
        return true;
      }),
    [allUsers, deptFilter, roleFilter, statusFilter],
  );

  if (me.isLoading) return null;
  if (!isAdmin) return <NoAccess what="Administration" />;

  const conn = connections.data ?? [];

  return (
    <>
      <PageHeader
        eyebrow="13 · Administration"
        title="Administration & API connections"
        description="Manage who can do what, and the data sources that feed every module."
      />

      <KpiGrid cols={4}>
        <KpiCard label="Users" value={String(users.data?.length ?? 0)} icon={Users} />
        <KpiCard
          label="Administrators"
          value={String(users.data?.filter((u) => u.role === "admin").length ?? 0)}
          icon={ShieldCheck}
        />
        <KpiCard
          label="Integrations"
          value={String(conn.length)}
          icon={Plug}
          hint={`${conn.filter((c) => c.status === "Demo data").length} on demo data`}
        />
        <KpiCard label="Shared data tables" value="22" icon={Database} />
      </KpiGrid>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">Users & roles</TabsTrigger>
          <TabsTrigger value="connections">API connections</TabsTrigger>
          <TabsTrigger value="data">Data architecture</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <ChangeMyPasswordCard />
          <DataTable
            rows={filteredUsers}
            rowKey={(r) => r.id}
            searchKeys={[
              (r) => r.full_name,
              (r) => r.email,
              (r) => r.username ?? "",
              (r) => r.employee_id ?? "",
              (r) => r.department ?? "",
              (r) => r.designation ?? "",
            ]}
            exportName="users"
            toolbar={
              <>
                <Select value={deptFilter} onValueChange={setDeptFilter}>
                  <SelectTrigger className="h-8 w-40">
                    <SelectValue placeholder="Department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All departments</SelectItem>
                    {departments.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="h-8 w-36">
                    <SelectValue placeholder="Role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All roles</SelectItem>
                    {ROLES.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-8 w-36">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    {ACCOUNT_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <AddUserDialog />
              </>
            }
            columns={[
              {
                key: "full_name",
                header: "User",
                cell: (r) => (
                  <div className="flex items-center gap-2">
                    <Avatar className="size-7">
                      <AvatarFallback className="bg-primary/15 text-xs text-primary">
                        {initials(r.full_name || r.email || "U")}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">
                        {r.full_name}
                        {r.id === me.data?.id && (
                          <span className="eyebrow ml-2 text-primary">You</span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {r.username ? `@${r.username}` : r.email}
                        {r.username && r.email ? ` · ${r.email}` : ""}
                      </div>
                    </div>
                  </div>
                ),
              },
              {
                key: "employee_id",
                header: "Employee ID",
                cell: (r) => (
                  <span className="num text-xs">{r.employee_id || "—"}</span>
                ),
              },
              {
                key: "department",
                header: "Department / Designation",
                value: (r) => [r.department, r.designation].filter(Boolean).join(" · "),
                cell: (r) => (
                  <div className="text-xs">
                    <div>{r.department || "—"}</div>
                    <div className="text-muted-foreground">{r.designation || "—"}</div>
                  </div>
                ),
              },
              {
                key: "account_status",
                header: "Status",
                cell: (r) => <StatusBadge value={r.account_status || "Active"} />,
              },
              {
                key: "tasks",
                header: "Tasks",
                align: "right",
                value: (r) => r.tasks,
                cell: (r) => <span className="num text-xs">{r.tasks}</span>,
              },
              {
                key: "created_at",
                header: "Joined",
                cell: (r) => <span className="num text-xs">{fmtDate(r.created_at)}</span>,
              },
              {
                key: "lastSignInAt",
                header: "Last login",
                cell: (r) => (
                  <span className="num text-xs">
                    {r.lastSignInAt ? fmtDate(r.lastSignInAt) : "Never"}
                  </span>
                ),
              },
              {
                key: "role",
                header: "Role",
                cell: (r) => (
                  <Select
                    value={r.role}
                    disabled={r.id === me.data?.id}
                    onValueChange={(v) => setRole.mutate({ userId: r.id, role: v as AppRole })}
                  >
                    <SelectTrigger className="h-8 w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((x) => (
                        <SelectItem key={x.id} value={x.id}>
                          {x.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ),
              },
              {
                key: "modules",
                header: "Module access",
                sortable: false,
                cell: (r) => (
                  <div className="flex items-center gap-2">
                    <span className="whitespace-nowrap text-xs text-muted-foreground">
                      {r.role === "admin" || !r.modules
                        ? "All modules"
                        : `${r.modules.length} of ${GRANTABLE_MODULES.length}`}
                    </span>
                    <ModuleAccessDialog
                      userId={r.id}
                      name={r.full_name || r.email || "this user"}
                      modules={r.modules}
                    />
                  </div>
                ),
              },
              {
                key: "actions",
                header: "Actions",
                sortable: false,
                cell: (r) => {
                  const label = r.full_name || r.email || "this user";
                  const isSelf = r.id === me.data?.id;
                  return (
                    <div className="flex items-center justify-end gap-1">
                      <EditUserDetailsDialog
                        userId={r.id}
                        name={label}
                        employeeId={r.employee_id}
                        department={r.department}
                        designation={r.designation}
                        accountStatus={(r.account_status || "Active") as AccountStatus}
                      />
                      <ResetPasswordDialog userId={r.id} name={label} />
                      {!isSelf && (
                        <>
                          <AccountStatusAction
                            userId={r.id}
                            name={label}
                            active={(r.account_status || "Active") !== "Disabled"}
                          />
                          <DeleteUserAction userId={r.id} name={label} />
                        </>
                      )}
                    </div>
                  );
                },
              },
            ]}
          />
          <div className="panel overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2/60">
                  <th className="eyebrow px-3 py-2 text-left">Permission</th>
                  {ROLES.map((r) => (
                    <th key={r.id} className="eyebrow px-3 py-2 text-center">
                      {r.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MATRIX.map((m) => (
                  <tr key={m.area} className="border-b border-border/60 last:border-0">
                    <td className="px-3 py-2">{m.area}</td>
                    {ROLES.map((r) => (
                      <td key={r.id} className="px-3 py-2 text-center">
                        {m.roles.includes(r.id) ? (
                          <span className="text-success">●</span>
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            You can't change your own role. Use Add user to create a ready-to-use account, or let
            people sign up themselves — self sign-ups start as Viewer.{" "}
            <span className="text-foreground">Module access</span> is layered on top of the role: it
            decides which screens a person sees, while the role still decides what they can do
            there. Administrators always see every module. <span className="text-foreground">Deactivate</span> blocks
            a sign-in immediately and keeps the record; <span className="text-foreground">Delete</span> removes the
            sign-in and profile for good. Neither is offered on your own row.
          </p>
        </TabsContent>

        <TabsContent value="connections">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {conn.map((c) => (
              <div key={c.id} className="panel p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{c.provider}</div>
                    <div className="eyebrow">{c.category}</div>
                  </div>
                  <StatusBadge value={c.status === "Planned" ? "Planned" : c.status} />
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{c.description}</p>
                <div className="mt-3 flex flex-wrap gap-1">
                  {c.modules.map((m) => (
                    <Badge key={m} variant="muted" className="rounded-full text-[10px]">
                      {m}
                    </Badge>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
                  <span>
                    {c.accounts_linked} accounts · {c.sync_frequency}
                  </span>
                  <span className="text-info">Live connection in stage 2</span>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="data">
          <div className="panel p-4">
            <p className="mb-3 text-sm text-muted-foreground">
              All modules read from one shared database. Campaigns, markets, products and team
              members are shared keys, so a lead links to its campaign, market, owner and product
              everywhere it appears.
            </p>
            <ul className="divide-y divide-border/60 text-sm">
              {TABLES.map(([t, d]) => (
                <li key={t} className="flex justify-between gap-4 py-2">
                  <span className="num text-xs text-primary">{t}</span>
                  <span className="text-muted-foreground">{d}</span>
                </li>
              ))}
            </ul>
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}
