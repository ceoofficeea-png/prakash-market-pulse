import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Pencil, ShieldCheck, ShieldOff, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
import {
  deleteTeamUser,
  setTeamUserActive,
  updateTeamUserProfile,
} from "@/lib/admin-users.functions";

export const ACCOUNT_STATUSES = ["Active", "Pending", "Disabled"] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

function useRefresh() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["admin-users"] });
    qc.invalidateQueries({ queryKey: ["me"] });
  };
}

/** Row action: employee ID, department, designation and account status. */
export function EditUserDetailsDialog({
  userId,
  name,
  employeeId,
  department,
  designation,
  accountStatus,
}: {
  userId: string;
  name: string;
  employeeId: string | null;
  department: string | null;
  designation: string | null;
  accountStatus: AccountStatus;
}) {
  const save = useServerFn(updateTeamUserProfile);
  const refresh = useRefresh();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    employeeId: employeeId ?? "",
    department: department ?? "",
    designation: designation ?? "",
    accountStatus,
  });

  const reset = () =>
    setForm({
      employeeId: employeeId ?? "",
      department: department ?? "",
      designation: designation ?? "",
      accountStatus,
    });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await save({
        data: {
          userId,
          employeeId: form.employeeId.trim(),
          department: form.department.trim(),
          designation: form.designation.trim(),
          accountStatus: form.accountStatus,
        },
      });
      toast.success(`Details updated for ${name}`);
      refresh();
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update the employee record");
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
        <Button variant="ghost" size="icon" className="size-8" aria-label={`Edit ${name}`} title="Edit details">
          <Pencil className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Employee record</DialogTitle>
          <DialogDescription>
            Employee ID, department, designation and account status for {name}.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor={`emp-${userId}`}>Employee ID</Label>
            <Input
              id={`emp-${userId}`}
              maxLength={40}
              placeholder="e.g. PP-0142"
              value={form.employeeId}
              onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Optional, but must be unique when set.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`dept-${userId}`}>Department</Label>
              <Input
                id={`dept-${userId}`}
                maxLength={80}
                placeholder="e.g. Paid Media"
                value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`desig-${userId}`}>Designation</Label>
              <Input
                id={`desig-${userId}`}
                maxLength={80}
                placeholder="e.g. Marketing Executive"
                value={form.designation}
                onChange={(e) => setForm({ ...form, designation: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Account status</Label>
            <Select
              value={form.accountStatus}
              onValueChange={(v) => setForm({ ...form, accountStatus: v as AccountStatus })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACCOUNT_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              <span className="text-foreground">Disabled</span> also blocks the sign-in;{" "}
              <span className="text-foreground">Pending</span> is for an account whose login has not
              been created yet.
            </p>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save details"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Row action: deactivate (ban the sign-in) or reactivate it. */
export function AccountStatusAction({
  userId,
  name,
  active,
}: {
  userId: string;
  name: string;
  active: boolean;
}) {
  const setActive = useServerFn(setTeamUserActive);
  const refresh = useRefresh();
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      await setActive({ data: { userId, active } });
      toast.success(active ? `${name} can sign in again` : `Sign-in revoked for ${name}`);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not change the account status");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          disabled={busy}
          aria-label={active ? `Deactivate ${name}` : `Reactivate ${name}`}
          title={active ? "Deactivate sign-in" : "Reactivate sign-in"}
        >
          {active ? <ShieldOff className="size-4" /> : <ShieldCheck className="size-4 text-success" />}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {active ? `Deactivate ${name}?` : `Reactivate ${name}?`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {active
              ? "Their sign-in is blocked immediately and the account status becomes Disabled. Tasks, history and the employee record are kept, so you can reactivate the account later."
              : "Their sign-in is unblocked and the account status becomes Active. They can sign in with their existing password."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            onClick={(e) => {
              e.preventDefault();
              void run();
            }}
          >
            {busy ? "Saving…" : active ? "Deactivate" : "Reactivate"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Row action: permanently delete the sign-in and its profile. */
export function DeleteUserAction({ userId, name }: { userId: string; name: string }) {
  const remove = useServerFn(deleteTeamUser);
  const refresh = useRefresh();
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      await remove({ data: { userId } });
      toast.success(`${name} was deleted`);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete the account");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-destructive hover:text-destructive"
          aria-label={`Delete ${name}`}
          title="Delete account"
        >
          <Trash2 className="size-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {name}?</AlertDialogTitle>
          <AlertDialogDescription>
            This deletes the sign-in and the profile permanently, so the person can never sign in
            again. Their roster row is kept but unlinked from the sign-in; tasks, campaigns, leads
            and reports stay attached to that roster record (remove the teammate separately if you
            want them gone). To keep the account for a return, use Deactivate instead.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={busy}
            onClick={(e) => {
              e.preventDefault();
              void run();
            }}
          >
            {busy ? "Deleting…" : "Delete account"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
