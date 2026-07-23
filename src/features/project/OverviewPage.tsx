/** Single-project overview — KPIs, hours vs budget, health/risk and charts. */

import { AlertTriangle } from "lucide-react";

import { ChartCard } from "@/components/charts/ChartCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { KpiTile } from "@/components/shared/KpiTile";
import { RagBadge } from "@/components/shared/badges";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { HOURS_PER_DAY } from "@/lib/config";
import { ragOf } from "@/lib/metrics/healthScore";
import { generateRecommendations } from "@/lib/metrics/recommendations";
import { cn, formatCost, formatPct } from "@/lib/utils";
import { useActiveSnapshot } from "@/store/portfolioStore";

import { HoursByPersonChart, RecommendationsPanel, TaskBucketChart } from "./widgets";

export function OverviewPage() {
  const snapshot = useActiveSnapshot();
  if (!snapshot) return <EmptyState />;
  const { project, metrics, health, evm } = snapshot;

  // EVM tiles (mirror the EVM page), shown when a budget is present.
  const primary = evm.units[0];
  const idx = (v: number | null | undefined) => (v == null ? "—" : v.toFixed(2));
  const evmVal = (v: number | null) =>
    v == null ? "—" : primary.unit === "hours" ? `${Math.round(v)}h` : formatCost(v, primary.currency);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{project.charter.projectName}</h1>
          <p className="text-sm text-muted-foreground">
            {project.charter.projectCode || "—"} · PM: {project.charter.manager || "—"} · consolidated in memory, nothing stored
          </p>
        </div>
        <RagBadge rag={health.rag} score={health.score} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <KpiTile label="Progress" value={`${Math.round(metrics.overallProgressPct)}%`} hint={`${metrics.tasksCompleted}/${metrics.tasksTotal} tasks`} />
        <KpiTile label="Hours Consumed" value={`${Math.round(metrics.consumedHours)}h`}
          hint={metrics.budgetHours != null ? `of ${Math.round(metrics.budgetHours)}h` : "no budget"} tone={metrics.overBudget ? "critical" : "default"} />
        <KpiTile label="Hours Remaining" value={metrics.remainingHours == null ? "—" : `${Math.round(metrics.remainingHours)}h`}
          tone={(metrics.remainingHours ?? 0) < 0 ? "critical" : "default"} />
        <KpiTile label="Days Remaining" value={metrics.daysRemaining ?? "—"} tone={metrics.overdue ? "critical" : "default"}
          hint={metrics.overdue ? "past end date" : "on plan"} />
        <KpiTile label="Overdue / Blocked" value={`${metrics.tasksOverdue} / ${metrics.tasksBlocked}`}
          tone={metrics.tasksOverdue > 0 || metrics.tasksBlocked > 0 ? "warning" : "default"} />
        <KpiTile label="Health" value={health.score} hint={health.rag}
          tone={health.rag === "Green" ? "good" : health.rag === "Amber" ? "warning" : "critical"} />
      </div>

      {evm.available && primary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiTile label="Schedule (SPI)" value={idx(evm.spi)} tone={evm.spi == null ? "default" : evm.spi >= 1 ? "good" : "warning"}
            hint={evm.spi == null ? "" : evm.spi >= 1 ? "on/ahead" : "behind"} />
          <KpiTile label="Cost (CPI)" value={idx(primary.cpi)} tone={primary.cpi == null ? "default" : primary.cpi >= 1 ? "good" : "critical"}
            hint={primary.cpi == null ? "" : primary.cpi >= 1 ? "on/under" : "over"} />
          <KpiTile label="Forecast (EAC)" value={evmVal(primary.eac)} hint={`budget ${evmVal(primary.bac)}`} />
          <KpiTile label="Var. at completion" value={evmVal(primary.vac)}
            tone={primary.vac == null ? "default" : primary.vac >= 0 ? "good" : "critical"} />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Hours consumed vs budget</CardTitle>
            {metrics.overBudget && (
              <Badge variant="outline" className="border-red-600/30 bg-red-600/10 text-red-700 dark:text-red-400">
                <AlertTriangle className="h-3 w-3" /> Over budget
              </Badge>
            )}
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-3">
              <Progress value={metrics.budgetConsumedPct ?? 0} className="h-2 flex-1"
                barClassName={metrics.overBudget ? "bg-red-600" : (metrics.budgetConsumedPct ?? 0) >= 90 ? "bg-amber-500" : "bg-primary"} />
              <span className="tnum text-sm font-medium">{formatPct(metrics.budgetConsumedPct)}</span>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="muted">Budget: {metrics.budgetHours == null ? "—" : `${Math.round(metrics.budgetHours)}h`}</Badge>
              {project.charter.budgetCost != null && (
                <Badge variant="muted">Cost budget: {formatCost(project.charter.budgetCost, project.charter.currency)}</Badge>
              )}
              <Badge variant="muted">Consumed: {Math.round(metrics.consumedHours)}h</Badge>
              <Badge variant="muted">Remaining: {metrics.remainingHours == null ? "—" : `${Math.round(metrics.remainingHours)}h`}</Badge>
              <Badge variant="muted">{metrics.timeEntryCount} entries · {HOURS_PER_DAY}h/day</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
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
              </div>
            ))}
            {health.reasons.length > 0 && (
              <div className="space-y-1 border-t pt-2">
                {health.reasons.map((r, i) => (
                  <p key={i} className={cn("text-xs", r.severity === "critical" ? "text-red-700 dark:text-red-400" : "text-amber-700 dark:text-amber-400")}>• {r.message}</p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Tasks by bucket" description="Where the work sits on the board"><TaskBucketChart snapshot={snapshot} /></ChartCard>
        <ChartCard title="Hours by person" description="Who is spending the time"><HoursByPersonChart snapshot={snapshot} /></ChartCard>
      </div>

      <ChartCard title="Recommendations" description="Automatically generated risk findings">
        <RecommendationsPanel recommendations={generateRecommendations([snapshot])} />
      </ChartCard>
    </div>
  );
}
