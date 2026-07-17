/**
 * Executive portfolio dashboard — KPIs, charts and recommendations across
 * every workbook imported this session, driven by the shared filter state.
 */

import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  Clock,
  FolderKanban,
  HeartPulse,
  Hourglass,
  TrendingDown,
} from "lucide-react";

import { ChartCard } from "@/components/charts/ChartCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { KpiTile } from "@/components/shared/KpiTile";
import { RagBadge } from "@/components/shared/badges";
import { formatMoneyCompact, formatNumber } from "@/lib/utils";
import { usePortfolioAnalytics, usePortfolioStore } from "@/store/portfolioStore";

import { FilterBar } from "./FilterBar";
import {
  BudgetByProjectChart,
  BudgetVarianceChart,
  CountByDimensionChart,
  OutputCompletionChart,
  TaskStatusChart,
  UtilizationChart,
} from "./widgets/PortfolioCharts";
import {
  CapacityHeatMap,
  MilestoneTimeline,
  ProjectHealthList,
  RecommendationsPanel,
  TopIssuesList,
  TopRisksList,
} from "./widgets/PortfolioLists";

function countBy(
  items: string[],
): Array<{ name: string; value: number }> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = item.trim() || "Not set";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

export function DashboardPage() {
  const hasProjects = usePortfolioStore((s) => s.projects.length > 0);
  const { snapshots, portfolio, capacity, recommendations } =
    usePortfolioAnalytics();

  if (!hasProjects) return <EmptyState />;

  const charters = snapshots.map((s) => s.project.charter);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Portfolio dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {portfolio.totalProjects} project(s) in scope · consolidated in
            memory, nothing stored
          </p>
        </div>
        <RagBadge rag={portfolio.portfolioRag} score={portfolio.portfolioHealthScore} />
      </div>

      <FilterBar />

      {snapshots.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No projects match the active filters.
        </p>
      ) : (
        <>
          {/* KPI tiles */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            <KpiTile label="Total Projects" value={portfolio.totalProjects} icon={FolderKanban} />
            <KpiTile label="On Track" value={portfolio.onTrack} icon={CheckCircle2} tone="good" />
            <KpiTile label="Delayed" value={portfolio.delayed} icon={Clock} tone={portfolio.delayed > 0 ? "warning" : "default"} />
            <KpiTile label="At Risk" value={portfolio.atRisk} icon={AlertTriangle} tone={portfolio.atRisk > 0 ? "critical" : "default"} />
            <KpiTile label="Completed" value={portfolio.completed} icon={CheckCircle2} />
            <KpiTile
              label="Portfolio Health"
              value={portfolio.portfolioHealthScore}
              icon={HeartPulse}
              hint={portfolio.portfolioRag}
              tone={portfolio.portfolioRag === "Green" ? "good" : portfolio.portfolioRag === "Amber" ? "warning" : "critical"}
            />
            <KpiTile label="Total Budget" value={formatMoneyCompact(portfolio.totalBudget)} icon={Banknote} />
            <KpiTile
              label="Budget Used"
              value={formatMoneyCompact(portfolio.budgetUsed)}
              icon={TrendingDown}
              hint={`${formatMoneyCompact(portfolio.budgetRemaining)} remaining`}
            />
            <KpiTile label="Planned Hours" value={formatNumber(portfolio.totalPlannedHours)} icon={Hourglass} />
            <KpiTile label="Logged Hours" value={formatNumber(portfolio.totalLoggedHours)} icon={Hourglass} />
            <KpiTile label="Remaining Hours" value={formatNumber(portfolio.remainingHours)} icon={Hourglass} />
            <KpiTile
              label="Open Critical Issues"
              value={snapshots.reduce((n, s) => n + s.metrics.openCriticalIssues, 0)}
              icon={AlertTriangle}
              tone={snapshots.some((s) => s.metrics.openCriticalIssues > 0) ? "critical" : "default"}
            />
          </div>

          {/* Charts */}
          <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            <ChartCard title="Project health" description="Weighted health score per project (worst first)">
              <ProjectHealthList snapshots={snapshots} />
            </ChartCard>
            <ChartCard title="Projects by status">
              <CountByDimensionChart data={countBy(charters.map((c) => c.status))} />
            </ChartCard>
            <ChartCard title="Projects by manager">
              <CountByDimensionChart data={countBy(charters.map((c) => c.projectManager))} />
            </ChartCard>
            <ChartCard title="Projects by business unit">
              <CountByDimensionChart data={countBy(charters.map((c) => c.businessUnit))} />
            </ChartCard>
            <ChartCard title="Budget by project" description="Planned vs actual spend">
              <BudgetByProjectChart snapshots={snapshots} />
            </ChartCard>
            <ChartCard title="Budget variance" description="Planned minus forecast — negative is an overrun">
              <BudgetVarianceChart snapshots={snapshots} />
            </ChartCard>
            <ChartCard title="Resource utilization" description="Actual vs planned hours per project">
              <UtilizationChart snapshots={snapshots} />
            </ChartCard>
            <ChartCard title="Task status" description="Backlog items across the portfolio">
              <TaskStatusChart snapshots={snapshots} />
            </ChartCard>
            <ChartCard title="Expected outputs completion" description="Average deliverable completion per project">
              <OutputCompletionChart snapshots={snapshots} />
            </ChartCard>
            <ChartCard title="Milestone timeline" description="Delayed and upcoming milestones across projects">
              <MilestoneTimeline snapshots={snapshots} />
            </ChartCard>
            <ChartCard title="Top risks" description="Ranked by probability × impact">
              <TopRisksList snapshots={snapshots} />
            </ChartCard>
            <ChartCard title="Top issues" description="Open issues by severity">
              <TopIssuesList snapshots={snapshots} />
            </ChartCard>
          </div>

          <ChartCard
            title="Capacity heat map"
            description="Total allocation per person across every project in scope"
          >
            <CapacityHeatMap capacity={capacity} />
          </ChartCard>

          <ChartCard
            title="Executive recommendations"
            description="Automatically generated from the standard governance checks"
          >
            <RecommendationsPanel recommendations={recommendations} />
          </ChartCard>
        </>
      )}
    </div>
  );
}
