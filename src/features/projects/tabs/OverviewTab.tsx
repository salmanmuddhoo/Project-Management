/** Project overview: KPIs, charter facts, narrative, scope and health. */

import { KpiTile } from "@/components/shared/KpiTile";
import { RagBadge } from "@/components/shared/badges";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { ProjectSnapshot } from "@/lib/metrics/portfolioMetrics";
import { ragOf } from "@/lib/metrics/healthScore";
import { formatDate, formatMoneyCompact, formatNumber, formatPct } from "@/lib/utils";

export function OverviewTab({ snapshot }: { snapshot: ProjectSnapshot }) {
  const { project, metrics, health } = snapshot;
  const c = project.charter;

  const narrative: Array<[string, string]> = [
    ["Description", c.description],
    ["Business Need", c.businessNeed],
    ["Objectives", c.objectives],
    ["Benefits", c.benefits],
  ];
  const facts: Array<[string, string]> = [
    ["Sponsor", c.sponsor || "—"],
    ["Funding", `${c.fundingType || "—"} · ${formatMoneyCompact(c.budget)}`],
    ["Planned window", `${formatDate(c.plannedStartDate)} → ${formatDate(c.plannedEndDate)}`],
    ["Actual start", formatDate(c.actualStartDate)],
    ["Forecast finish", formatDate(metrics.forecastEndDate)],
    ["Source file", project.meta.sourceFileName],
  ];
  const scope: Array<[string, string[]]> = [
    ["In Scope", project.scope.inScope],
    ["Out of Scope", project.scope.outOfScope],
    ["Assumptions", project.scope.assumptions],
    ["Constraints", project.scope.constraints],
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <KpiTile label="Overall Progress" value={formatPct(metrics.overallProgressPct)} />
        <KpiTile label="Time Elapsed" value={formatPct(metrics.timeElapsedPct)} />
        <KpiTile
          label="Days Remaining"
          value={metrics.daysRemaining ?? "—"}
          hint={metrics.daysDelayed > 0 ? `${metrics.daysDelayed} days late` : "on plan"}
          tone={metrics.daysDelayed > 0 ? "critical" : "good"}
        />
        <KpiTile
          label="Budget Consumed"
          value={formatPct(metrics.budgetConsumedPct)}
          hint={`${formatMoneyCompact(metrics.budgetActual)} of ${formatMoneyCompact(metrics.budgetPlanned)}`}
        />
        <KpiTile
          label="Utilization"
          value={formatPct(metrics.resourceUtilizationPct)}
          hint={`${formatNumber(metrics.totalActualHours)} of ${formatNumber(metrics.totalPlannedHours)} hrs`}
        />
        <KpiTile
          label="Milestones"
          value={`${metrics.milestonesCompleted}/${metrics.milestonesTotal}`}
          hint={metrics.milestonesOverdue > 0 ? `${metrics.milestonesOverdue} overdue` : "none overdue"}
          tone={metrics.milestonesOverdue > 0 ? "warning" : "default"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Health score</CardTitle>
            <RagBadge rag={health.rag} score={health.score} />
          </CardHeader>
          <CardContent className="space-y-3">
            {health.dimensions.map((dim) => (
              <div key={dim.key}>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">
                    {dim.label}
                    <span className="ml-1 text-muted-foreground">{Math.round(dim.weight * 100)}%</span>
                  </span>
                  <span className="tnum text-muted-foreground">
                    {dim.score == null ? "n/a" : Math.round(dim.score)}
                  </span>
                </div>
                <Progress
                  value={dim.score ?? 0}
                  className="mt-1"
                  barClassName={
                    dim.score == null
                      ? "bg-muted-foreground/40"
                      : ragOf(dim.score) === "Green"
                        ? "bg-green-600"
                        : ragOf(dim.score) === "Amber"
                          ? "bg-amber-500"
                          : "bg-red-600"
                  }
                />
                <p className="mt-0.5 text-[11px] text-muted-foreground">{dim.detail}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Charter</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              {facts.map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4 border-b pb-1.5">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="truncate text-right font-medium">{value}</dd>
                </div>
              ))}
            </dl>
            {narrative.map(
              ([label, value]) =>
                value && (
                  <div key={label}>
                    <p className="text-xs font-semibold text-muted-foreground">{label}</p>
                    <p className="mt-0.5 whitespace-pre-line text-sm">{value}</p>
                  </div>
                ),
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Scope</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {scope.map(([title, items]) => (
            <div key={title}>
              <p className="mb-1 text-xs font-semibold text-muted-foreground">{title}</p>
              {items.length === 0 ? (
                <p className="text-xs text-muted-foreground">Not defined.</p>
              ) : (
                <ul className="list-disc space-y-1 pl-4 text-sm">
                  {items.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
