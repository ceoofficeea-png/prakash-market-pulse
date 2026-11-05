import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Bot, Check, Eye, Sparkles, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { ChartCard, DonutChart } from "@/components/app/charts";
import { KpiCard } from "@/components/app/kpi-card";
import { DemoNote, KpiGrid, PageHeader } from "@/components/app/page";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser, useInsights, useLookups } from "@/lib/api";
import { useFilters } from "@/lib/filters";
import { fmtDateTime } from "@/lib/format";
import { can } from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated/ai")({
  head: () => ({ meta: [{"title": "AI Marketing Intelligence \u2014 Prakash Pump"}, {"name": "description", "content": "AI Marketing Intelligence analytics and records for the Prakash Pump marketing team."}, {"property": "og:title", "content": "AI Marketing Intelligence \u2014 Prakash Pump"}, {"property": "og:description", "content": "AI Marketing Intelligence analytics and records for the Prakash Pump marketing team."}, {"property": "og:type", "content": "website"}, {"name": "twitter:card", "content": "summary_large_image"}] }),
  component: AiPage,
});

const SEVERITY_ORDER = ["Critical", "High", "Medium", "Low", "Info"];

function AiPage() {
  const f = useFilters();
  const qc = useQueryClient();
  const me = useCurrentUser();
  const insights = useInsights();
  const { country, campaign } = useLookups();
  const [status, setStatus] = useState("open");
  const [module, setModule] = useState<string | null>(null);
  const canEdit = can(me.data?.roles ?? [], "insights.edit");

  const update = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const { error } = await supabase.from("ai_insights").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Insight updated");
      qc.invalidateQueries({ queryKey: ["ai_insights"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const all = insights.data ?? [];
  const rows = useMemo(
    () =>
      all
        .filter((i) => (status === "open" ? ["New", "In Review"].includes(i.status) : status === "all" ? true : i.status === status))
        .filter((i) => !module || i.module === module)
        .filter((i) => !f.countries.length || !i.country_code || f.countries.includes(i.country_code))
        .sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity)),
    [all, status, module, f.countries],
  );
  const modules = Object.entries(all.reduce<Record<string, number>>((a, i) => ({ ...a, [i.module]: (a[i.module] ?? 0) + 1 }), {}));
  const avgConf = all.length ? all.reduce((a, i) => a + Number(i.confidence), 0) / all.length : 0;

  return (
    <>
      <PageHeader
        eyebrow="11 · AI Marketing Intelligence"
        title="AI insights & recommendations"
        description="Anomalies, risks and opportunities detected across every module, with recommended next actions."
        filters={["country"]}
      />

      <KpiGrid cols={5}>
        <KpiCard label="Open insights" value={String(all.filter((i) => ["New", "In Review"].includes(i.status)).length)} />
        <KpiCard label="Critical" value={String(all.filter((i) => i.severity === "Critical" && i.status !== "Dismissed").length)} />
        <KpiCard label="Actioned" value={String(all.filter((i) => i.status === "Actioned").length)} />
        <KpiCard label="Avg confidence" value={`${(avgConf * 100).toFixed(0)}%`} />
        <KpiCard label="Modules covered" value={String(modules.length)} />
      </KpiGrid>

      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <div>
          <Tabs value={status} onValueChange={setStatus} className="mb-3">
            <TabsList>
              <TabsTrigger value="open">Open</TabsTrigger>
              <TabsTrigger value="Actioned">Actioned</TabsTrigger>
              <TabsTrigger value="Dismissed">Dismissed</TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="space-y-3">
            {rows.map((i) => {
              const cmp = campaign(i.campaign_id);
              const ctry = country(i.country_code);
              return (
                <article key={i.id} className="panel p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Bot className="size-4 text-primary" />
                    <StatusBadge value={i.severity} />
                    <span className="eyebrow">{i.module} · {i.insight_type}</span>
                    <StatusBadge value={i.status} />
                    <span className="num ml-auto text-xs text-muted-foreground">{fmtDateTime(i.created_at)}</span>
                  </div>
                  <h3 className="mt-2 text-base font-semibold">{i.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{i.summary}</p>
                  <div className="mt-3 rounded-lg border border-primary/25 bg-primary/8 p-3 text-sm">
                    <div className="eyebrow mb-1 flex items-center gap-1 text-primary"><Sparkles className="size-3" /> Recommendation</div>
                    {i.recommendation}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
                    {i.impact_estimate && <span className="text-success">Impact: {i.impact_estimate}</span>}
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      Confidence <Progress value={Number(i.confidence) * 100} className="h-1.5 w-20" /> <span className="num">{(Number(i.confidence) * 100).toFixed(0)}%</span>
                    </span>
                    {ctry && <Link to="/markets/$code" params={{ code: ctry.code }} className="text-primary hover:underline">{ctry.flag} {ctry.name}</Link>}
                    {cmp && <Link to="/campaigns/$id" params={{ id: String(cmp.id) }} className="text-primary hover:underline">{cmp.name}</Link>}
                    {canEdit && (
                      <span className="ml-auto flex gap-1.5">
                        {i.status === "New" && <Button size="sm" variant="outline" onClick={() => update.mutate({ id: i.id, status: "In Review" })}><Eye /> Review</Button>}
                        {i.status !== "Actioned" && <Button size="sm" onClick={() => update.mutate({ id: i.id, status: "Actioned" })}><Check /> Mark actioned</Button>}
                        {i.status !== "Dismissed" && <Button size="sm" variant="ghost" onClick={() => update.mutate({ id: i.id, status: "Dismissed" })}><X /> Dismiss</Button>}
                      </span>
                    )}
                  </div>
                </article>
              );
            })}
            {!rows.length && <div className="panel p-8 text-center text-sm text-muted-foreground">No insights in this view.</div>}
          </div>
        </div>
        <div className="space-y-4">
          <ChartCard title="Insights by module" subtitle="Click to filter">
            <DonutChart data={modules.map(([name, value]) => ({ name, id: name, value }))} height={150} onSliceClick={(d) => setModule(module === d.id ? null : (d.id ?? null))} />
            {module && <button type="button" className="mt-2 text-xs text-primary" onClick={() => setModule(null)}>Clear module filter</button>}
          </ChartCard>
          <div className="panel p-4 text-sm">
            <div className="flex items-center gap-2 font-semibold"><Sparkles className="size-4 text-primary" /> Live AI analysis</div>
            <p className="mt-1 text-muted-foreground">
              Stage 1 shows curated demonstration insights. In stage 2, live AI will scan connected ad, web and CRM data daily and generate new recommendations automatically.
            </p>
          </div>
        </div>
      </div>
      <DemoNote />
    </>
  );
}
