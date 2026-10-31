import { useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { MultiSelect } from "@/components/app/multi-select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useLookups } from "@/lib/api";
import { PLATFORMS, toISODate } from "@/lib/format";

const OBJECTIVES = ["Lead Generation", "Awareness", "Product Launch", "Distributor Recruitment", "Account-Based Marketing", "Retargeting", "Promotion", "Event"];

export function NewCampaignDialog() {
  const qc = useQueryClient();
  const { products, team, countries, campaigns } = useLookups();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const today = new Date();
  const later = new Date();
  later.setDate(today.getDate() + 60);
  const [form, setForm] = useState({
    name: "",
    objective: "Lead Generation",
    product_id: "SOL",
    owner_id: "2",
    start_date: toISODate(today),
    end_date: toISODate(later),
    budget: "25000",
    target_leads: "500",
    countries: ["IN"] as string[],
    platforms: ["google_ads", "meta_ads"] as string[],
    description: "",
  });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const next = Math.max(0, ...campaigns.map((c) => Number(c.code.split("-").pop()) || 0)) + 1;
    const { error } = await supabase.from("campaigns").insert({
      code: `CMP-26-${String(next).padStart(3, "0")}`,
      name: form.name,
      objective: form.objective,
      status: "Planned",
      product_id: form.product_id,
      owner_id: Number(form.owner_id),
      start_date: form.start_date,
      end_date: form.end_date,
      budget: Number(form.budget),
      target_leads: Number(form.target_leads),
      countries: form.countries,
      platforms: form.platforms,
      description: form.description || null,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Campaign created");
    qc.invalidateQueries({ queryKey: ["campaigns"] });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus /> New campaign
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>New campaign</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1.5">
            <Label>Name</Label>
            <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Rabi Solar — Rajasthan" />
          </div>
          <div className="space-y-1.5">
            <Label>Objective</Label>
            <Select value={form.objective} onValueChange={(v) => setForm({ ...form, objective: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{OBJECTIVES.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Product</Label>
            <Select value={form.product_id} onValueChange={(v) => setForm({ ...form, product_id: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Owner</Label>
            <Select value={form.owner_id} onValueChange={(v) => setForm({ ...form, owner_id: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{team.map((m) => <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Budget (USD)</Label>
            <Input type="number" min={0} required value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Start</Label>
            <Input type="date" required value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>End</Label>
            <Input type="date" required min={form.start_date} value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Markets</Label>
            <MultiSelect label="Countries" value={form.countries} onChange={(v) => setForm({ ...form, countries: v })} options={countries.map((c) => ({ value: c.code, label: `${c.flag} ${c.name}` }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Platforms</Label>
            <MultiSelect label="Platforms" value={form.platforms} onChange={(v) => setForm({ ...form, platforms: v })} options={PLATFORMS.map((p) => ({ value: p.id, label: p.label }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Lead target</Label>
            <Input type="number" min={0} value={form.target_leads} onChange={(e) => setForm({ ...form, target_leads: e.target.value })} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Description</Label>
            <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <DialogFooter className="col-span-2">
            <Button type="submit" disabled={busy || !form.countries.length || !form.platforms.length}>
              Create campaign
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
