import { useServerFn } from "@tanstack/react-start";
import { Eye, EyeOff, KeyRound, ShieldCheck } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import { toast } from "sonner";

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
import { supabase } from "@/integrations/supabase/client";
import { updateTeamUserPassword } from "@/lib/admin-users.functions";

const MIN_PASSWORD_LENGTH = 8;

function PasswordForm({
  submitLabel,
  onSubmit,
}: {
  submitLabel: string;
  onSubmit: (password: string) => Promise<void>;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const id = useId();
  const passwordId = `${id}-password`;
  const confirmId = `${id}-confirm`;
  const hintId = `${id}-hint`;

  const tooShort = password.length > 0 && password.length < MIN_PASSWORD_LENGTH;
  const mismatch = confirm.length > 0 && confirm !== password;
  const invalid = password.length < MIN_PASSWORD_LENGTH || password !== confirm;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (invalid) return;
    setBusy(true);
    try {
      await onSubmit(password);
      setPassword("");
      setConfirm("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update the password");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor={passwordId}>New password</Label>
        <div className="relative">
          <Input
            id={passwordId}
            type={show ? "text" : "password"}
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="pr-9"
            aria-describedby={hintId}
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label={show ? "Hide password" : "Show password"}
          >
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        <p
          id={hintId}
          className={tooShort ? "text-xs text-destructive" : "text-xs text-muted-foreground"}
        >
          At least {MIN_PASSWORD_LENGTH} characters.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={confirmId}>Confirm password</Label>
        <Input
          id={confirmId}
          type={show ? "text" : "password"}
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          aria-invalid={mismatch}
        />
        {mismatch && <p className="text-xs text-destructive">Passwords do not match.</p>}
      </div>
      <DialogFooter>
        <Button type="submit" disabled={busy || invalid}>
          {busy ? "Saving…" : submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Row action for the admin users table. */
export function ResetPasswordDialog({ userId, name }: { userId: string; name: string }) {
  const reset = useServerFn(updateTeamUserPassword);
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 whitespace-nowrap">
          <KeyRound /> Update password
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Update password</DialogTitle>
          <DialogDescription>
            Set a new password for {name}. They sign in with it on their next visit.
          </DialogDescription>
        </DialogHeader>
        <PasswordForm
          submitLabel="Update password"
          onSubmit={async (password) => {
            await reset({ data: { userId, password } });
            toast.success(`Password updated for ${name}`);
            setOpen(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

/** Self-service password change for the signed-in administrator. */
export function ChangeMyPasswordCard() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="panel mb-4 flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
            <ShieldCheck className="size-4" />
          </span>
          <div>
            <div className="text-sm font-semibold">Change my password</div>
            <div className="text-xs text-muted-foreground">
              Update the password for your own signed-in account.
            </div>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <KeyRound /> Change my password
        </Button>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Change my password</DialogTitle>
            <DialogDescription>
              You stay signed in on this device after the change.
            </DialogDescription>
          </DialogHeader>
          <PasswordForm
            submitLabel="Save password"
            onSubmit={async (password) => {
              const { error } = await supabase.auth.updateUser({ password });
              if (error) throw error;
              toast.success("Your password has been updated.");
              setOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
