/**
 * Executive portfolio dashboard — KPIs, charts and recommendations across
 * every imported Planner board + matched Timorc time, driven by the shared
 * filter state.
 */

import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  Clock,
  FolderKanban,
  HeartPulse,
  Hourglass,
  ListChecks,
  TrendingDown,
} from "lucide-react";

import { ChartCard } from "@/components/charts/ChartCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { KpiTile } from "@/components/shared/KpiTile";
import { RagBadge } from "@/components/shared/badges";
import { formatNumber } from "@/lib/utils";
import { usePortfolioAnalytics, usePortfolioStore } from "@/store/portfolioStore";

import { FilterBar } from "./FilterBar";
import {
  BudgetVarianceChart,
  HoursByPersonChart,
  HoursByProjectChart,
  ProgressChart,
  TaskBucketChart,
} from "./widgets/PortfolioCharts";
import { ProjectHealthList, RecommendationsPanel } from "./widgets/PortfolioLists";

const hrs = (n: number) => `${formatNumber(n)}h`;

export function DashboardPage() {
  const hasProjects = usePortfolioStore((s) => s.projects.length > 0);
  const { snapshots, portfolio, capacity, recommendations } = usePortfolioAnalytics();

  if (!hasProjects) return <EmptyState />;

  const overdueTasks = snapshots.reduce((n, s) => n + s.metrics.tasksOverdue, 0);
  const byPerson = capacity.map((c) => ({ name: c.name, hours: c.totalHours }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Portfolio dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {portfolio.totalProjects} project(s) · consolidated in memory, nothing stored
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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            <KpiTile label="Projects" value={portfolio.totalProjects} icon={FolderKanban} />
            <KpiTile label="On Track" value={portfolio.onTrack} icon={CheckCircle2} tone="good" />
            <KpiTile label="At Risk" value={portfolio.atRisk} icon={AlertTriangle} tone={portfolio.atRisk > 0 ? "critical" : "default"} />
            <KpiTile label="Over Budget" value={portfolio.overBudget} icon={TrendingDown} tone={portfolio.overBudget > 0 ? "critical" : "default"} />
            <KpiTile label="Completed" value={portfolio.completed} icon={CheckCircle2} />
            <KpiTile label="Portfolio Health" value={portfolio.portfolioHealthScore} icon={HeartPulse} hint={portfolio.portfolioRag}
              tone={portfolio.portfolioRag === "Green" ? "good" : portfolio.portfolioRag === "Amber" ? "warning" : "critical"} />
            <KpiTile label="Hours Budget" value={hrs(portfolio.totalBudgetHours)} icon={Banknote} />
            <KpiTile label="Hours Consumed" value={hrs(portfolio.consumedHours)} icon={Hourglass}
              hint={`${hrs(Math.max(0, portfolio.remainingHours))} remaining`} tone={portfolio.remainingHours < 0 ? "critical" : "default"} />
            <KpiTile label="Tasks Done" value={`${portfolio.tasksCompleted}/${portfolio.tasksTotal}`} icon={ListChecks} />
            <KpiTile label="Overdue Tasks" value={overdueTasks} icon={Clock} tone={overdueTasks > 0 ? "warning" : "default"} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            <ChartCard title="Project health" description="Weighted health score (worst first)">
              <ProjectHealthList snapshots={snapshots} />
            </ChartCard>
            <ChartCard title="Hours: budget vs consumed" description="From the Timorc time export">
              <HoursByProjectChart snapshots={snapshots} />
            </ChartCard>
            <ChartCard title="Hours remaining" description="Negative = over the hours budget">
              <BudgetVarianceChart snapshots={snapshots} />
            </ChartCard>
            <ChartCard title="Progress" description="Task completion per project">
              <ProgressChart snapshots={snapshots} />
            </ChartCard>
            <ChartCard title="Tasks by bucket" description="Across the portfolio">
              <TaskBucketChart snapshots={snapshots} />
            </ChartCard>
            <ChartCard title="Hours by person" description="Who is spending the time">
              <HoursByPersonChart data={byPerson} />
            </ChartCard>
          </div>

          <ChartCard title="Executive recommendations" description="Automatically generated risk findings">
            <RecommendationsPanel recommendations={recommendations} />
          </ChartCard>
        </>
      )}
    </div>
  );
}
