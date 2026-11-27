import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { LayoutGrid } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

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
import { Label } from "@/components/ui/label";
import { updateTeamUserModules } from "@/lib/admin-users.functions";
import { GRANTABLE_MODULES, GRANTABLE_MODULE_IDS, type ModuleId } from "@/lib/permissions";

/** Checkbox grid of the modules an account may open. */
export function ModulePicker({
  value,
  onChange,
}: {
  value: ModuleId[];
  onChange: (next: ModuleId[]) => void;
}) {
  const all = GRANTABLE_MODULES.map((m) => m.id);
  const selected = all.filter((id) => value.includes(id));
  const toggle = (id: ModuleId, on: boolean) =>
    onChange(on ? [...selected, id] : selected.filter((v) => v !== id));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {selected.length} of {all.length} selected
        </span>
        <div className="flex gap-1">
          <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => onChange(all)}>
            Select all
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => onChange([])}>
            Clear
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {GRANTABLE_MODULES.map((m) => (
          <label
            key={m.id}
            htmlFor={`module-${m.id}`}
            className="flex cursor-pointer items-center gap-2 rounded-md border border-border/60 px-2 py-1.5 text-xs hover:border-primary/40"
          >
            <Checkbox
              id={`module-${m.id}`}
              checked={value.includes(m.id)}
              onCheckedChange={(checked) => toggle(m.id, checked === true)}
            />
            <span className="truncate">{m.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

/** Admin row action: edit one account's module access. */
export function ModuleAccessDialog({
  userId,
  name,
  modules,
}: {
  userId: string;
  name: string;
  modules: string[] | null;
}) {
  const qc = useQueryClient();
  const save = useServerFn(updateTeamUserModules);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<ModuleId[]>(modules ? (modules as ModuleId[]) : GRANTABLE_MODULE_IDS);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setSelected(modules ? (modules as ModuleId[]) : GRANTABLE_MODULE_IDS);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 whitespace-nowrap">
          <LayoutGrid /> Modules
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Module access</DialogTitle>
          <DialogDescription>
            Choose the screens {name} can open. Their role still decides what they can do there.
          </DialogDescription>
        </DialogHeader>
        <ModulePicker value={selected} onChange={setSelected} />
        <DialogFooter>
          <Button
            type="button"
            disabled={busy || selected.length === 0}
            onClick={async () => {
              setBusy(true);
              try {
                await save({ data: { userId, modules: selected } });
                toast.success("Module access updated");
                qc.invalidateQueries({ queryKey: ["admin-users"] });
                setOpen(false);
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Could not update module access");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Saving…" : "Save module access"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
