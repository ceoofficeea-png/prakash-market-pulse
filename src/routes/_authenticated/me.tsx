import { createFileRoute } from "@tanstack/react-router";
import { IdCard, Lock } from "lucide-react";

import { DemoNote, LoadingBlock, PageHeader } from "@/components/app/page";
import { ChangeMyPasswordCard } from "@/components/app/password-actions";
import { MyTasksPanel } from "@/components/app/task-progress";
import { ApprovalsPanel } from "@/components/app/task-approvals";
import { useCurrentUser, useLookups, useTasks } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import { can, GRANTABLE_MODULES, roleLabel } from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated/me")({
  head: () => ({
    meta: [
      { title: "My workspace — Prakash Pump" },
      {
        name: "description",
        content: "Your Prakash Pump marketing account, tasks, approvals and password.",
      },
      { property: "og:title", content: "My workspace — Prakash Pump" },
      {
        property: "og:description",
        content: "Your Prakash Pump marketing account, tasks, approvals and password.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MyWorkspace,
});

function MyWorkspace() {
  const me = useCurrentUser();
  const { team, country, member } = useLookups();
  const tasks = useTasks();

  if (me.isLoading) return <LoadingBlock className="mt-10" />;

  const profile = me.data?.profile;
  const role = me.data?.role ?? "viewer";
  const isStaff = can(me.data?.roles ?? [], "tasks.edit");
  const mine = team.find((row) => row.user_id != null && row.user_id === me.data?.id) ?? null;
  const modules = me.data?.modules ?? null;

  const details: { label: string; value: string }[] = [
    { label: "Full name", value: profile?.full_name || "—" },
    { label: "Username", value: profile?.username ? `@${profile.username}` : "—" },
    {
      label: "Contact email",
      value:
        profile?.contact_email ||
        (profile?.email && !profile.email.endsWith("@prakashpump.local") ? profile.email : "—"),
    },
    { label: "Role", value: roleLabel(role) },
    {
      label: "Module access",
      value:
        role === "admin" || modules == null
          ? "All modules"
          : `${modules.length} of ${GRANTABLE_MODULES.length}`,
    },
    ...(mine
      ? [
          { label: "Team", value: `${mine.team} · ${mine.title}` },
          { label: "Reports to", value: member(mine.manager_id)?.name ?? "—" },
          {
            label: "Country",
            value: country(mine.country_code)?.name ?? mine.country_code ?? "—",
          },
          { label: "Monthly capacity", value: `${mine.capacity_hours} hours` },
          { label: "Joined", value: fmtDate(mine.joined_on) },
        ]
      : []),
  ];

  return (
    <>
      <PageHeader
        eyebrow="My workspace"
        title={profile?.full_name || "My workspace"}
        description="Your details, your password, the tasks assigned to you and anything waiting for your approval."
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <section className="panel p-4 xl:col-span-2">
          <div className="mb-3 flex items-center gap-2">
            <IdCard className="size-4 text-primary" />
            <h2 className="text-sm font-semibold">My details</h2>
          </div>
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {details.map((row) => (
              <div
                key={row.label}
                className="flex items-baseline justify-between gap-3 border-b border-border/50 pb-2 last:border-0"
              >
                <dt className="text-xs text-muted-foreground">{row.label}</dt>
                <dd className="text-right text-sm">{row.value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">
            Your name, team and module access are managed by an administrator.
          </p>
        </section>

        <div>
          <ChangeMyPasswordCard />
          <div className="panel p-4">
            <div className="flex items-center gap-2">
              <Lock className="size-4 text-primary" />
              <h2 className="text-sm font-semibold">Account security</h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              You can change your own password here. Nothing else about your account is editable
              from this page.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <ApprovalsPanel
          memberId={mine?.id ?? null}
          isStaff={isStaff}
          members={team}
          tasks={tasks.data ?? []}
        />
      </div>

      {mine ? (
        <MyTasksPanel member={mine} tasks={tasks.data ?? []} isStaff={isStaff} />
      ) : (
        <section className="panel p-6 text-center text-sm text-muted-foreground">
          Your sign-in is not linked to a team member yet, so no tasks are assigned to you. Ask an
          administrator to link your account on the Team page.
        </section>
      )}

      <DemoNote />
    </>
  );
}
