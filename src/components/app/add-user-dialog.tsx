import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { UserPlus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { ModulePicker } from "@/components/app/module-access";
import { PasswordInput } from "@/components/app/password-input";
import { Button } from "@/components/ui/button";
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
import { createTeamUser } from "@/lib/admin-users.functions";
import { isValidUsername } from "@/lib/login-identifier";
import { GRANTABLE_MODULE_IDS, ROLES, type AppRole, type ModuleId } from "@/lib/permissions";

const EMPTY_FORM = {
  fullName: "",
  username: "",
  contactEmail: "",
  password: "",
  role: "manager" as AppRole,
};

export function AddUserDialog() {
  const qc = useQueryClient();
  const create = useServerFn(createTeamUser);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [modules, setModules] = useState<ModuleId[]>(GRANTABLE_MODULE_IDS);

  const ready =
    form.fullName.trim().length >= 2 &&
    isValidUsername(form.username) &&
    form.password.length >= 8 &&
    modules.length > 0;

  const reset = () => {
    setForm(EMPTY_FORM);
    setModules(GRANTABLE_MODULE_IDS);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    try {
      await create({ data: { ...form, modules } });
      toast.success(`Account created for @${form.username.trim().toLowerCase()}`);
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      reset();
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create user");
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
          <UserPlus /> Add user
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add user</DialogTitle>
          <DialogDescription>
            They sign in with this username and password — no email or confirmation link needed.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="nu-name">Full name</Label>
            <Input
              id="nu-name"
              required
              minLength={2}
              maxLength={100}
              autoComplete="name"
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="nu-username">Username</Label>
              <Input
                id="nu-username"
                required
                minLength={3}
                maxLength={32}
                autoComplete="off"
                placeholder="e.g. ravi.k"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                aria-describedby="nu-username-hint"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nu-email">Contact email (optional)</Label>
              <Input
                id="nu-email"
                type="email"
                autoComplete="off"
                placeholder="Not required"
                value={form.contactEmail}
                onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
              />
            </div>
          </div>
          <p id="nu-username-hint" className="text-xs text-muted-foreground">
            Usernames are unique: 3–32 letters, numbers, dot, dash or underscore. The email is only
            a contact detail — it is never needed to sign in.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="nu-pw">Temporary password</Label>
            <PasswordInput
              id="nu-pw"
              minLength={8}
              maxLength={72}
              required
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              aria-describedby="nu-pw-hint"
            />
            <p id="nu-pw-hint" className="text-xs text-muted-foreground">
              At least 8 characters. Share it with the user over a secure channel.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select
              value={form.role}
              onValueChange={(v) => setForm({ ...form, role: v as AppRole })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.label} — {r.description}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Module access</Label>
            <ModulePicker value={modules} onChange={setModules} />
            <p className="text-xs text-muted-foreground">
              Admin accounts always see every module. For other roles, only the ticked screens
              appear.
            </p>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={busy || !ready}>
              {busy ? "Creating…" : "Create account"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
