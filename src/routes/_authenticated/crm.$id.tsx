import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2, Calendar, FileSignature, Mail, MapPin, MessageSquare, Phone, Presentation, StickyNote, Users } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";

import { ChartCard } from "@/components/app/charts";
import { DemoNote, DetailStat, LoadingBlock, PageHeader } from "@/components/app/page";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser, useLead, useLeadActivities, useLookups } from "@/lib/api";
import { fmtDate, fmtDateTime, fmtUsd, LEAD_STAGES } from "@/lib/format";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/crm/$id")({
  head: () => ({ meta: [{"title": "Lead detail \u2014 Prakash Pump"}, {"name": "description", "content": "Lead detail analytics and records for the Prakash Pump marketing team."}, {"property": "og:title", "content": "Lead detail \u2014 Prakash Pump"}, {"property": "og:description", "content": "Lead detail analytics and records for the Prakash Pump marketing team."}, {"property": "og:type", "content": "website"}, {"name": "twitter:card", "content": "summary_large_image"}] }),
  component: LeadDetail,
});

const ICONS: Record<string, typeof Mail> = { Email: Mail, Call: Phone, Meeting: Users, Demo: Presentation, "Quote Sent": FileSignature, "Site Visit": MapPin, Note: StickyNote };
const TYPES = Object.keys(ICONS);

function LeadDetail() {
  const { id } = Route.useParams();
  const leadId = Number(id);
  const qc = useQueryClient();
  const me = useCurrentUser();
  const lead = useLead(leadId);
  const acts = useLeadActivities(leadId);
  const { country, member, campaign, product } = useLookups();
  const [note, setNote] = useState("");
  const [type, setType] = useState("Call");
  const canEdit = can(me.data?.roles ?? [], "leads.edit");

  const update = useMutation({
    mutationFn: async (patch: { stage?: string; owner_id?: number }) => {
      const { error } = await supabase.from("leads").update({ ...patch, last_activity_at: new Date().toISOString() }).eq("id", leadId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lead updated");
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const addActivity = async (e: FormEvent) => {
    e.preventDefault();
    if (!note.trim()) return;
    const { error } = await supabase.from("lead_activities").insert({ lead_id: leadId, activity_type: type, note, owner_id: lead.data?.owner_id ?? null });
    if (error) {
      toast.error(error.message);
      return;
    }
    await supabase.from("leads").update({ last_activity_at: new Date().toISOString() }).eq("id", leadId);
    setNote("");
    toast.success("Activity logged");
    qc.invalidateQueries({ queryKey: ["lead_activities", leadId] });
    qc.invalidateQueries({ queryKey: ["leads"] });
  };

  if (lead.isLoading) return <LoadingBlock />;
  const l = lead.data;
  if (!l) return <div className="panel p-8 text-center text-muted-foreground">Lead not found.</div>;
  const ctry = country(l.country_code);
  const cmp = campaign(l.campaign_id);
  const stageIdx = LEAD_STAGES.indexOf(l.stage as (typeof LEAD_STAGES)[number]);

  return (
    <>
      <PageHeader
        crumbs={[{ label: "CRM & Leads", to: "/crm" }]}
        eyebrow={`Lead #${l.id} · ${l.industry}`}
        title={l.full_name}
        description={`${l.job_title} at ${l.company}`}
        actions={
          canEdit ? (
            <Select value={l.stage} onValueChange={(v) => update.mutate({ stage: v })}>
              <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
              <SelectContent>{LEAD_STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          ) : (
            <StatusBadge value={l.stage} />
          )
        }
      />

      <div className="panel mb-4 flex items-center gap-1 overflow-x-auto p-2">
        {LEAD_STAGES.filter((s) => s !== "Lost").map((s, i) => (
          <div
            key={s}
            className={cn(
              "flex-1 whitespace-nowrap rounded px-3 py-1.5 text-center text-xs",
              l.stage === "Lost" ? "bg-surface-2 text-muted-foreground" : i <= stageIdx ? "bg-signal text-primary-foreground font-medium" : "bg-surface-2 text-muted-foreground",
            )}
          >
            {s}
          </div>
        ))}
        {l.stage === "Lost" && <StatusBadge value="Lost" className="ml-2" />}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <DetailStat label="Deal value" value={fmtUsd(Number(l.deal_value))} />
        <DetailStat label="Lead score" value={`${l.score} / 100`} sub={l.score >= 75 ? "Hot" : l.score >= 50 ? "Warm" : "Cold"} />
        <DetailStat label="Created" value={fmtDate(l.created_at)} />
        <DetailStat label="Last activity" value={fmtDate(l.last_activity_at)} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard title="Contact & attribution">
          <dl className="space-y-2.5 text-sm">
            {[
              [Mail, "Email", l.email],
              [Phone, "Phone", l.phone ?? "—"],
              [Building2, "Company", l.company],
              [MapPin, "Market", ctry ? <Link to="/markets/$code" params={{ code: ctry.code }} className="text-primary hover:underline">{ctry.flag} {ctry.name}</Link> : "—"],
              [MessageSquare, "Source", l.source],
              [Calendar, "Campaign", cmp ? <Link to="/campaigns/$id" params={{ id: String(cmp.id) }} className="text-primary hover:underline">{cmp.name}</Link> : "Organic / direct"],
              [FileSignature, "Product", product(l.product_id)?.name ?? "—"],
              [Users, "Owner", member(l.owner_id) ? <Link to="/team/$id" params={{ id: String(l.owner_id) }} className="text-primary hover:underline">{member(l.owner_id)?.name}</Link> : "—"],
            ].map(([Icon, k, v]) => {
              const I = Icon as typeof Mail;
              return (
                <div key={k as string} className="flex items-start gap-3">
                  <I className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <dt className="eyebrow">{k as string}</dt>
                    <dd className="truncate">{v as ReactNode}</dd>
                  </div>
                </div>
              );
            })}
          </dl>
        </ChartCard>

        <ChartCard title="Activity timeline" subtitle={`${acts.data?.length ?? 0} activities`} className="xl:col-span-2">
          {canEdit && (
            <form onSubmit={addActivity} className="mb-4 flex flex-col gap-2 rounded-lg border border-border bg-surface-2/40 p-3 md:flex-row">
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="h-9 md:w-36"><SelectValue /></SelectTrigger>
                <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
              <Textarea rows={1} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What happened?" className="min-h-9 flex-1" />
              <Button type="submit" size="sm" className="h-9" disabled={!note.trim()}>Log activity</Button>
            </form>
          )}
          <ol className="relative space-y-4 border-l border-border pl-5">
            {(acts.data ?? []).map((a) => {
              const I = ICONS[a.activity_type] ?? StickyNote;
              return (
                <li key={a.id} className="relative">
                  <span className="absolute -left-[29px] flex size-6 items-center justify-center rounded-full border border-border bg-surface">
                    <I className="size-3 text-primary" />
                  </span>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-medium text-foreground">{a.activity_type}</span>
                    <span className="text-muted-foreground">· {member(a.owner_id)?.name} · {fmtDateTime(a.occurred_at)}</span>
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">{a.note}</p>
                </li>
              );
            })}
          </ol>
        </ChartCard>
      </div>
      <DemoNote />
    </>
  );
}
