import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarPlus, Trash2, UserPlus } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { ModulePicker } from "@/components/app/module-access";
import { PasswordInput } from "@/components/app/password-input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLookups, type TeamMember } from "@/lib/api";
import { TASK_STATUSES } from "@/lib/format";
import { isValidUsername } from "@/lib/login-identifier";
import { GRANTABLE_MODULE_IDS, ROLES, type AppRole, type ModuleId } from "@/lib/permissions";
import { createMemberLogin, deleteMemberLogin } from "@/lib/team.functions";
import {
  deleteTeamMember,
  insertTeamMember,
  insertTeamTask,
  linkTeamMemberUser,
} from "@/lib/team-writes";

const todayPlus = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

const EMPTY_MEMBER = {
  name: "",
  title: "",
  team: "",
  email: "",
  countryCode: "",
  capacityHours: "160",
};

/** Add a teammate to the roster, with an optional sign-in account. */
export function AddTeammateDialog() {
  const qc = useQueryClient();
  const createLogin = useServerFn(createMemberLogin);
  const { team, countries } = useLookups();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(EMPTY_MEMBER);
  const [managerId, setManagerId] = useState("none");
  const [withLogin, setWithLogin] = useState(true);
  const [login, setLogin] = useState({ username: "", password: "", role: "analyst" as AppRole });
  const [modules, setModules] = useState<ModuleId[]>(GRANTABLE_MODULE_IDS);
  const [error, setError] = useState<string | null>(null);

  const teams = Array.from(new Set(team.map((m) => m.team))).sort();
  const teamsListId = useId();

  const ready =
    form.name.trim().length >= 2 &&
    form.title.trim().length >= 2 &&
    form.team.trim().length >= 2 &&
    (!withLogin ||
      (isValidUsername(login.username) && login.password.length >= 8 && modules.length > 0));

  const reset = () => {
    setForm(EMPTY_MEMBER);
    setManagerId("none");
    setWithLogin(true);
    setLogin({ username: "", password: "", role: "analyst" });
    setModules(GRANTABLE_MODULE_IDS);
    setError(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      const memberId = await insertTeamMember({
        name: form.name.trim(),
        title: form.title.trim(),
        team: form.team.trim(),
        email: form.email.trim(),
        countryCode: form.countryCode || null,
        capacityHours: Number(form.capacityHours) || 160,
        managerId: managerId === "none" ? null : Number(managerId),
      });

      if (withLogin) {
        try {
          const created = await createLogin({
            data: {
              fullName: form.name.trim(),
              username: login.username.trim(),
              password: login.password,
              role: login.role,
              modules,
              contactEmail: form.email.trim() || undefined,
            },
          });
          await linkTeamMemberUser(memberId, created.userId);
        } catch (loginError) {
          // Do not leave a roster row behind when the sign-in could not be created.
          await deleteTeamMember(memberId).catch(() => undefined);
          throw loginError;
        }
      }

      toast.success(`${form.name.trim()} added to the team`);
      qc.invalidateQueries({ queryKey: ["team_members"] });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      reset();
      setOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not add the team member";
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlus /> Add teammate
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add teammate</DialogTitle>
          <DialogDescription>
            Adds them to Team Performance. Optionally create their sign-in with a role and module
            access.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="tm-name">Full name</Label>
              <Input
                id="tm-name"
                required
                minLength={2}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tm-title">Job title</Label>
              <Input
                id="tm-title"
                required
                minLength={2}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tm-team">Team</Label>
              <Input
                id="tm-team"
                required
                minLength={2}
                list={teamsListId}
                placeholder="e.g. Digital Marketing"
                value={form.team}
                onChange={(e) => setForm({ ...form, team: e.target.value })}
              />
              <datalist id={teamsListId}>
                {teams.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tm-email">Work email (optional)</Label>
              <Input
                id="tm-email"
                type="email"
                placeholder="Not needed for a username sign-in"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Country</Label>
              <Select
                value={form.countryCode || "none"}
                onValueChange={(v) => setForm({ ...form, countryCode: v === "none" ? "" : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not set</SelectItem>
                  {countries.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.flag} {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Reports to</Label>
              <Select value={managerId} onValueChange={setManagerId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No manager</SelectItem>
                  {team.map((m) => (
                    <SelectItem key={m.id} value={String(m.id)}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tm-capacity">Monthly capacity (hours)</Label>
              <Input
                id="tm-capacity"
                type="number"
                min={8}
                max={400}
                value={form.capacityHours}
                onChange={(e) => setForm({ ...form, capacityHours: e.target.value })}
              />
            </div>
          </div>

          <div className="rounded-lg border border-border/70 p-3">
            <label
              htmlFor="tm-login"
              className="flex cursor-pointer items-center gap-2 text-sm font-medium"
            >
              <Checkbox
                id="tm-login"
                checked={withLogin}
                onCheckedChange={(c) => setWithLogin(c === true)}
              />
              Create a sign-in for this teammate
            </label>
            {withLogin && (
              <div className="mt-3 space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="tm-username">Username</Label>
                  <Input
                    id="tm-username"
                    required
                    autoComplete="off"
                    placeholder="e.g. ravi.k"
                    value={login.username}
                    onChange={(e) => setLogin({ ...login, username: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    They sign in with this username. It must be unique and is not an email address.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="tm-pw">Temporary password</Label>
                    <PasswordInput
                      id="tm-pw"
                      autoComplete="new-password"
                      minLength={8}
                      required
                      value={login.password}
                      onChange={(e) => setLogin({ ...login, password: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Role</Label>
                    <Select
                      value={login.role}
                      onValueChange={(v) => setLogin({ ...login, role: v as AppRole })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Module access</Label>
                  <ModulePicker value={modules} onChange={setModules} />
                </div>
              </div>
            )}
          </div>

          {error && (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          )}
          {!ready && (
            <p className="text-xs text-muted-foreground">
              Name, job title and team are required. With a sign-in ticked, also add a unique
              username, a password of 8+ characters and at least one module.
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={busy || !ready}>
              {busy ? "Adding…" : "Add teammate"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Assign a task to one teammate (fixed member when opened from their page). */
export function AssignTaskDialog({
  memberId,
  members,
}: {
  memberId?: number | undefined;
  members: TeamMember[];
}) {
  const qc = useQueryClient();

  const { campaigns } = useLookups();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    member: memberId ? String(memberId) : "",
    title: "",
    priority: "Medium",
    dueDate: todayPlus(7),
    status: "To Do",
  });
  const [campaignId, setCampaignId] = useState("none");
  const [error, setError] = useState<string | null>(null);

  const ready = form.member !== "" && form.title.trim().length >= 3 && form.dueDate !== "";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      await insertTeamTask({
        memberId: Number(form.member),
        title: form.title.trim(),
        priority: form.priority as "Low" | "Medium" | "High" | "Critical",
        dueDate: form.dueDate,
        status: form.status as (typeof TASK_STATUSES)[number],
        campaignId: campaignId === "none" ? null : Number(campaignId),
        hoursLogged: 0,
      });
      toast.success("Task assigned");
      qc.invalidateQueries({ queryKey: ["team_tasks"] });
      setForm({
        member: memberId ? String(memberId) : "",
        title: "",
        priority: "Medium",
        dueDate: todayPlus(7),
        status: "To Do",
      });
      setCampaignId("none");
      setOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not assign the task";
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <CalendarPlus /> Assign task
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Assign a task</DialogTitle>
          <DialogDescription>
            It appears on the teammate's card and task list immediately.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Teammate</Label>
            <Select
              value={form.member || "none"}
              onValueChange={(v) => setForm({ ...form, member: v === "none" ? "" : v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose a teammate" />
              </SelectTrigger>
              <SelectContent>
                {memberId === undefined && <SelectItem value="none">Choose a teammate</SelectItem>}
                {members.map((m) => (
                  <SelectItem key={m.id} value={String(m.id)}>
                    {m.name} · {m.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="at-title">Task</Label>
            <Input
              id="at-title"
              required
              minLength={3}
              maxLength={160}
              placeholder="e.g. Publish the monsoon campaign carousel"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select
                value={form.priority}
                onValueChange={(v) => setForm({ ...form, priority: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["Low", "Medium", "High", "Critical"].map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="at-due">Due date</Label>
              <Input
                id="at-due"
                type="date"
                required
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Campaign</Label>
              <Select value={campaignId} onValueChange={setCampaignId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">General</SelectItem>
                  {campaigns.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {error && (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={busy || !ready}>
              {busy ? "Assigning…" : "Assign task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Remove a teammate from the roster, optionally deleting their sign-in too. */
export function RemoveTeammateDialog({
  member,
  compact = false,
}: {
  member: TeamMember;
  compact?: boolean;
}) {
  const qc = useQueryClient();
  const removeLogin = useServerFn(deleteMemberLogin);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deleteLogin, setDeleteLogin] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await deleteTeamMember(member.id);
      qc.invalidateQueries({ queryKey: ["team_members"] });
      qc.invalidateQueries({ queryKey: ["team_tasks"] });

      if (deleteLogin && member.user_id) {
        try {
          await removeLogin({ data: { userId: member.user_id } });
        } catch (err) {
          setOpen(false);
          throw new Error(
            `${member.name} was removed from the team, but their sign-in could not be deleted: ${
              err instanceof Error ? err.message : "unknown error"
            }`,
          );
        }
      }

      toast.success(`${member.name} removed from the team`);
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      setOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not remove the member";
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setDeleteLogin(false);
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        {compact ? (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs text-destructive hover:text-destructive"
          >
            <Trash2 className="size-3.5" /> Remove
          </Button>
        ) : (
          <Button size="sm" variant="outline" className="text-destructive hover:text-destructive">
            <Trash2 /> Remove member
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Remove {member.name}?</DialogTitle>
          <DialogDescription>
            Their tasks and KPI history are deleted along with their place on the team. This cannot
            be undone.
          </DialogDescription>
        </DialogHeader>
        {member.user_id && (
          <label className="flex items-start gap-2 rounded-lg border border-border/70 p-3 text-sm">
            <Checkbox
              checked={deleteLogin}
              onCheckedChange={(checked) => setDeleteLogin(checked === true)}
            />
            <span>
              Also delete their sign-in account
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Leave this unticked to remove only their place on the team and keep the login.
              </span>
            </span>
          </label>
        )}
        {error && (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={submit} disabled={busy}>
            {busy ? "Removing…" : "Remove member"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
