/** Project overview: KPIs, charter, resources, Timorc link, health & risk. */

import { CheckCircle2, XCircle } from "lucide-react";

import { KpiTile } from "@/components/shared/KpiTile";
import { RagBadge } from "@/components/shared/badges";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ragOf } from "@/lib/metrics/healthScore";
import type { ProjectSnapshot } from "@/lib/metrics/portfolioMetrics";
import { cn, formatDate } from "@/lib/utils";

export function OverviewTab({ snapshot }: { snapshot: ProjectSnapshot }) {
  const { project, metrics, health } = snapshot;
  const c = project.charter;

  const facts: Array<[string, string]> = [
    ["Manager", c.manager || "—"],
    ["Timorc code(s)", project.timorcCodes.map((t) => t.code).join(", ") || "—"],
    ["Planned window", `${formatDate(c.startDate)} → ${formatDate(c.endDate)}`],
    ["Hours budget", c.budgetHours != null ? `${Math.round(c.budgetHours)}h` : "—"],
    ["Source file", project.meta.sourceFileName],
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <KpiTile label="Progress" value={`${Math.round(metrics.overallProgressPct)}%`} hint={`${metrics.tasksCompleted}/${metrics.tasksTotal} tasks`} />
        <KpiTile label="Time Elapsed" value={metrics.timeElapsedPct == null ? "—" : `${Math.round(metrics.timeElapsedPct)}%`} />
        <KpiTile label="Days Remaining" value={metrics.daysRemaining ?? "—"} tone={metrics.overdue ? "critical" : "default"}
          hint={metrics.overdue ? "past end date" : "on plan"} />
        <KpiTile label="Hours Consumed" value={`${Math.round(metrics.consumedHours)}h`}
          hint={metrics.budgetHours != null ? `of ${Math.round(metrics.budgetHours)}h` : "no budget"}
          tone={metrics.overBudget ? "critical" : "default"} />
        <KpiTile label="Hours Remaining" value={metrics.remainingHours == null ? "—" : `${Math.round(metrics.remainingHours)}h`}
          tone={(metrics.remainingHours ?? 0) < 0 ? "critical" : "default"} />
        <KpiTile label="Overdue / Blocked" value={`${metrics.tasksOverdue} / ${metrics.tasksBlocked}`}
          tone={metrics.tasksOverdue > 0 || metrics.tasksBlocked > 0 ? "warning" : "default"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Health &amp; risk</CardTitle>
            <RagBadge rag={health.rag} score={health.score} />
          </CardHeader>
          <CardContent className="space-y-3">
            {health.dimensions.map((d) => (
              <div key={d.key}>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">{d.label}<span className="ml-1 text-muted-foreground">{Math.round(d.weight * 100)}%</span></span>
                  <span className="tnum text-muted-foreground">{d.score == null ? "n/a" : Math.round(d.score)}</span>
                </div>
                <Progress value={d.score ?? 0} className="mt-1"
                  barClassName={d.score == null ? "bg-muted-foreground/40" : ragOf(d.score) === "Green" ? "bg-green-600" : ragOf(d.score) === "Amber" ? "bg-amber-500" : "bg-red-600"} />
                <p className="mt-0.5 text-[11px] text-muted-foreground">{d.detail}</p>
              </div>
            ))}
            {health.reasons.length > 0 && (
              <div className="mt-3 space-y-1 border-t pt-3">
                {health.reasons.map((r, i) => (
                  <p key={i} className={cn("text-xs", r.severity === "critical" ? "text-red-700 dark:text-red-400" : "text-amber-700 dark:text-amber-400")}>
                    • {r.message}
                  </p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Charter</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              {facts.map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4 border-b pb-1.5">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="truncate text-right font-medium">{value}</dd>
                </div>
              ))}
            </dl>
            {c.notes && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground">Notes</p>
                <p className="mt-0.5 whitespace-pre-line text-sm">{c.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Resources</CardTitle></CardHeader>
          <CardContent>
            {project.resources.length === 0 ? (
              <p className="text-xs text-muted-foreground">No resources listed.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {project.resources.map((r, i) => (
                  <li key={i} className="flex items-center justify-between border-b pb-1.5">
                    <span className="font-medium">{r.name}</span>
                    <Badge variant="muted">{r.role || "—"}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Governance</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-1.5 text-sm">
              {snapshot.governance.checks.map((ch) => (
                <li key={ch.label} className="flex items-center gap-2">
                  {ch.passed ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-red-600" />}
                  <span className={cn(!ch.passed && "font-medium")}>{ch.label}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
