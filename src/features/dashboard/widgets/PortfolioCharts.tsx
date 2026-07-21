/**
 * Recharts widgets for the portfolio dashboard. Data-viz conventions: thin
 * marks with rounded ends, hairline grids, one axis per chart, categorical
 * hues in fixed order, blue↔red diverging only for polarity.
 */

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useChartTheme } from "@/components/charts/chartTheme";
import type { ProjectSnapshot } from "@/lib/metrics/portfolioMetrics";

const CHART_HEIGHT = 220;

function useAxes() {
  const theme = useChartTheme();
  return {
    theme,
    tick: { fill: theme.tickInk, fontSize: 11 },
    tooltipStyle: {
      backgroundColor: theme.tooltip.backgroundColor,
      border: theme.tooltip.border,
      borderRadius: 8,
      color: theme.tooltip.color,
      fontSize: 12,
    },
  };
}

const shortName = (s: ProjectSnapshot) => {
  const n = s.project.charter.projectCode || s.project.charter.projectName;
  return n.length > 14 ? `${n.slice(0, 13)}…` : n;
};

/** Hours consumed vs budget, grouped bars per project. */
export function HoursByProjectChart({ snapshots }: { snapshots: ProjectSnapshot[] }) {
  const { theme, tick, tooltipStyle } = useAxes();
  const data = snapshots.map((s) => ({
    name: shortName(s),
    Budget: Math.round(s.metrics.budgetHours ?? 0),
    Consumed: Math.round(s.metrics.consumedHours),
  }));
  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <BarChart data={data} margin={{ right: 8 }} barGap={2}>
        <CartesianGrid vertical={false} stroke={theme.grid} />
        <XAxis dataKey="name" tick={tick} axisLine={{ stroke: theme.axisLine }} tickLine={false} />
        <YAxis unit="h" tick={tick} axisLine={false} tickLine={false} width={48} />
        <Tooltip cursor={{ fill: theme.grid, opacity: 0.4 }} contentStyle={tooltipStyle} formatter={(v) => `${v}h`} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="Budget" fill={theme.series[0]} barSize={14} radius={[4, 4, 0, 0]} />
        <Bar dataKey="Consumed" fill={theme.series[1]} barSize={14} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Remaining hours — polarity (green under budget, red over). */
export function BudgetVarianceChart({ snapshots }: { snapshots: ProjectSnapshot[] }) {
  const { theme, tick, tooltipStyle } = useAxes();
  const good = theme.dark ? "#3987e5" : "#2a78d6";
  const bad = theme.dark ? "#e66767" : "#e34948";
  const data = snapshots.map((s) => ({ name: shortName(s), remaining: Math.round(s.metrics.remainingHours ?? 0) }));
  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <BarChart data={data} margin={{ right: 8 }}>
        <CartesianGrid vertical={false} stroke={theme.grid} />
        <XAxis dataKey="name" tick={tick} axisLine={{ stroke: theme.axisLine }} tickLine={false} />
        <YAxis unit="h" tick={tick} axisLine={false} tickLine={false} width={48} />
        <Tooltip cursor={{ fill: theme.grid, opacity: 0.4 }} contentStyle={tooltipStyle}
          formatter={(v) => [`${v}h`, Number(v) >= 0 ? "Remaining" : "Over budget"]} />
        <Bar dataKey="remaining" name="Remaining hours" barSize={14} radius={[4, 4, 0, 0]}>
          {data.map((d) => <Cell key={d.name} fill={d.remaining >= 0 ? good : bad} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Progress % per project (task completion). */
export function ProgressChart({ snapshots }: { snapshots: ProjectSnapshot[] }) {
  const { theme, tick, tooltipStyle } = useAxes();
  const data = snapshots.map((s) => ({ name: shortName(s), Progress: Math.round(s.metrics.taskCompletionPct ?? 0) }));
  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24 }}>
        <CartesianGrid horizontal={false} stroke={theme.grid} />
        <XAxis type="number" domain={[0, 100]} unit="%" tick={tick} axisLine={{ stroke: theme.axisLine }} tickLine={false} />
        <YAxis type="category" dataKey="name" width={110} tick={tick} axisLine={{ stroke: theme.axisLine }} tickLine={false} />
        <Tooltip cursor={{ fill: theme.grid, opacity: 0.4 }} contentStyle={tooltipStyle} formatter={(v) => [`${v}%`, "Tasks done"]} />
        <Bar dataKey="Progress" fill={theme.series[0]} barSize={14} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Task counts by bucket across the portfolio. */
export function TaskBucketChart({ snapshots }: { snapshots: ProjectSnapshot[] }) {
  const { theme, tick, tooltipStyle } = useAxes();
  const counts = new Map<string, number>();
  for (const s of snapshots) {
    for (const t of s.project.tasks) counts.set(t.bucket, (counts.get(t.bucket) ?? 0) + 1);
  }
  const data = [...counts.entries()].map(([name, value]) => ({ name, value }));
  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <BarChart data={data} margin={{ right: 8 }}>
        <CartesianGrid vertical={false} stroke={theme.grid} />
        <XAxis dataKey="name" tick={{ ...tick, fontSize: 10 }} axisLine={{ stroke: theme.axisLine }} tickLine={false} interval={0} />
        <YAxis allowDecimals={false} tick={tick} axisLine={false} tickLine={false} width={32} />
        <Tooltip cursor={{ fill: theme.grid, opacity: 0.4 }} contentStyle={tooltipStyle} />
        <Bar dataKey="value" name="Tasks" fill={theme.series[0]} barSize={22} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Hours by person across the portfolio (top 10). */
export function HoursByPersonChart({ data }: { data: Array<{ name: string; hours: number }> }) {
  const { theme, tick, tooltipStyle } = useAxes();
  const rows = data.slice(0, 10).map((d) => ({ name: d.name, Hours: Math.round(d.hours) }));
  return (
    <ResponsiveContainer width="100%" height={Math.max(CHART_HEIGHT, rows.length * 30)}>
      <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 24 }}>
        <CartesianGrid horizontal={false} stroke={theme.grid} />
        <XAxis type="number" unit="h" tick={tick} axisLine={{ stroke: theme.axisLine }} tickLine={false} />
        <YAxis type="category" dataKey="name" width={130} tick={tick} axisLine={{ stroke: theme.axisLine }} tickLine={false} />
        <Tooltip cursor={{ fill: theme.grid, opacity: 0.4 }} contentStyle={tooltipStyle} formatter={(v) => [`${v}h`, "Logged"]} />
        <Bar dataKey="Hours" fill={theme.series[0]} barSize={14} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
