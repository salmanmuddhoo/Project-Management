/**
 * Recharts widgets for the portfolio dashboard.
 *
 * Data-viz conventions applied throughout: thin marks with rounded data
 * ends, hairline grids, one axis per chart, categorical hues in fixed order
 * (never cycled), a single blue for magnitude series, and the blue↔red
 * diverging pair reserved for polarity (budget variance).
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
import { formatMoneyCompact } from "@/lib/utils";
import type { ProjectSnapshot } from "@/lib/metrics/portfolioMetrics";
import { KANBAN_COLUMNS } from "@/types/project";

const CHART_HEIGHT = 220;

function useCommonAxes() {
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

/** Truncated project label for category axes. */
const shortName = (s: ProjectSnapshot) => {
  const name = s.project.charter.projectCode || s.project.charter.projectName;
  return name.length > 12 ? `${name.slice(0, 11)}…` : name;
};

// ---------------------------------------------------------------------------

/** Horizontal count-by-category bar (status / manager / business unit). */
export function CountByDimensionChart({
  data,
}: {
  data: Array<{ name: string; value: number }>;
}) {
  const { theme, tick, tooltipStyle } = useCommonAxes();
  return (
    <ResponsiveContainer width="100%" height={Math.max(CHART_HEIGHT, data.length * 34)}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24 }}>
        <CartesianGrid horizontal={false} stroke={theme.grid} />
        <XAxis type="number" allowDecimals={false} tick={tick} axisLine={{ stroke: theme.axisLine }} tickLine={false} />
        <YAxis type="category" dataKey="name" width={120} tick={tick} axisLine={{ stroke: theme.axisLine }} tickLine={false} />
        <Tooltip cursor={{ fill: theme.grid, opacity: 0.4 }} contentStyle={tooltipStyle} />
        <Bar dataKey="value" name="Projects" fill={theme.series[0]} barSize={14} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ---------------------------------------------------------------------------

export function BudgetByProjectChart({ snapshots }: { snapshots: ProjectSnapshot[] }) {
  const { theme, tick, tooltipStyle } = useCommonAxes();
  const data = snapshots.map((s) => ({
    name: shortName(s),
    Planned: s.metrics.budgetPlanned,
    Actual: s.metrics.budgetActual,
  }));
  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <BarChart data={data} margin={{ right: 8 }} barGap={2}>
        <CartesianGrid vertical={false} stroke={theme.grid} />
        <XAxis dataKey="name" tick={tick} axisLine={{ stroke: theme.axisLine }} tickLine={false} />
        <YAxis tickFormatter={(v: number) => formatMoneyCompact(v)} tick={tick} axisLine={false} tickLine={false} width={56} />
        <Tooltip
          cursor={{ fill: theme.grid, opacity: 0.4 }}
          contentStyle={tooltipStyle}
          formatter={(value) => formatMoneyCompact(Number(value))}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="Planned" fill={theme.series[0]} barSize={14} radius={[4, 4, 0, 0]} />
        <Bar dataKey="Actual" fill={theme.series[1]} barSize={14} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ---------------------------------------------------------------------------

/** Variance is polarity → diverging blue (favourable) / red (overrun). */
export function BudgetVarianceChart({ snapshots }: { snapshots: ProjectSnapshot[] }) {
  const { theme, tick, tooltipStyle } = useCommonAxes();
  const favourable = theme.dark ? "#3987e5" : "#2a78d6";
  const overrun = theme.dark ? "#e66767" : "#e34948";
  const data = snapshots.map((s) => ({
    name: shortName(s),
    variance: Math.round(s.metrics.budgetVariance),
  }));
  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <BarChart data={data} margin={{ right: 8 }}>
        <CartesianGrid vertical={false} stroke={theme.grid} />
        <XAxis dataKey="name" tick={tick} axisLine={{ stroke: theme.axisLine }} tickLine={false} />
        <YAxis tickFormatter={(v: number) => formatMoneyCompact(v)} tick={tick} axisLine={false} tickLine={false} width={56} />
        <Tooltip
          cursor={{ fill: theme.grid, opacity: 0.4 }}
          contentStyle={tooltipStyle}
          formatter={(value) => [formatMoneyCompact(Number(value)), Number(value) >= 0 ? "Under plan" : "Over plan"]}
        />
        <Bar dataKey="variance" name="Variance" barSize={14} radius={[4, 4, 0, 0]}>
          {data.map((d) => (
            <Cell key={d.name} fill={d.variance >= 0 ? favourable : overrun} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ---------------------------------------------------------------------------

export function UtilizationChart({ snapshots }: { snapshots: ProjectSnapshot[] }) {
  const { theme, tick, tooltipStyle } = useCommonAxes();
  const data = snapshots.map((s) => ({
    name: shortName(s),
    Utilization: Math.round(s.metrics.resourceUtilizationPct ?? 0),
  }));
  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <BarChart data={data} margin={{ right: 8 }}>
        <CartesianGrid vertical={false} stroke={theme.grid} />
        <XAxis dataKey="name" tick={tick} axisLine={{ stroke: theme.axisLine }} tickLine={false} />
        <YAxis unit="%" tick={tick} axisLine={false} tickLine={false} width={44} />
        <Tooltip
          cursor={{ fill: theme.grid, opacity: 0.4 }}
          contentStyle={tooltipStyle}
          formatter={(value) => [`${value}%`, "Actual vs planned hours"]}
        />
        <Bar dataKey="Utilization" fill={theme.series[0]} barSize={14} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ---------------------------------------------------------------------------

export function TaskStatusChart({ snapshots }: { snapshots: ProjectSnapshot[] }) {
  const { theme, tick, tooltipStyle } = useCommonAxes();
  const counts = new Map<string, number>(KANBAN_COLUMNS.map((c) => [c, 0]));
  for (const s of snapshots) {
    for (const t of s.project.tasks) {
      counts.set(t.status, (counts.get(t.status) ?? 0) + 1);
    }
  }
  const data = KANBAN_COLUMNS.map((c) => ({ name: c, value: counts.get(c) ?? 0 }));
  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <BarChart data={data} margin={{ right: 8 }}>
        <CartesianGrid vertical={false} stroke={theme.grid} />
        <XAxis dataKey="name" tick={{ ...tick, fontSize: 10 }} axisLine={{ stroke: theme.axisLine }} tickLine={false} interval={0} />
        <YAxis allowDecimals={false} tick={tick} axisLine={false} tickLine={false} width={32} />
        <Tooltip cursor={{ fill: theme.grid, opacity: 0.4 }} contentStyle={tooltipStyle} />
        <Bar dataKey="value" name="Tasks" fill={theme.series[0]} barSize={18} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ---------------------------------------------------------------------------

export function DeliverableCompletionChart({ snapshots }: { snapshots: ProjectSnapshot[] }) {
  const { theme, tick, tooltipStyle } = useCommonAxes();
  const data = snapshots.map((s) => ({
    name: shortName(s),
    Completion: Math.round(s.metrics.deliverableCompletionPct ?? 0),
  }));
  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24 }}>
        <CartesianGrid horizontal={false} stroke={theme.grid} />
        <XAxis type="number" domain={[0, 100]} unit="%" tick={tick} axisLine={{ stroke: theme.axisLine }} tickLine={false} />
        <YAxis type="category" dataKey="name" width={96} tick={tick} axisLine={{ stroke: theme.axisLine }} tickLine={false} />
        <Tooltip
          cursor={{ fill: theme.grid, opacity: 0.4 }}
          contentStyle={tooltipStyle}
          formatter={(value) => [`${value}%`, "Deliverables complete"]}
        />
        <Bar dataKey="Completion" fill={theme.series[0]} barSize={14} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
