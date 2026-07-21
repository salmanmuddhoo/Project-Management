/** Chart & list widgets for the single-project overview. */

import { AlertTriangle, Info, ShieldAlert } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { useChartTheme } from "@/components/charts/chartTheme";
import type { ProjectSnapshot } from "@/lib/metrics/portfolioMetrics";
import type { Recommendation } from "@/lib/metrics/recommendations";
import { cn } from "@/lib/utils";

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

export function TaskBucketChart({ snapshot }: { snapshot: ProjectSnapshot }) {
  const { theme, tick, tooltipStyle } = useAxes();
  const data = snapshot.metrics.byBucket.map((b) => ({ name: b.bucket, value: b.count }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ right: 8 }}>
        <CartesianGrid vertical={false} stroke={theme.grid} />
        <XAxis dataKey="name" tick={{ ...tick, fontSize: 10 }} axisLine={{ stroke: theme.axisLine }} tickLine={false} interval={0} />
        <YAxis allowDecimals={false} tick={tick} axisLine={false} tickLine={false} width={32} />
        <Tooltip cursor={{ fill: theme.grid, opacity: 0.4 }} contentStyle={tooltipStyle} />
        <Bar dataKey="value" name="Tasks" fill={theme.series[0]} barSize={26} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function HoursByPersonChart({ snapshot }: { snapshot: ProjectSnapshot }) {
  const { theme, tick, tooltipStyle } = useAxes();
  const rows = snapshot.metrics.byResource.slice(0, 10).map((r) => ({ name: r.name, Hours: Math.round(r.hours) }));
  if (rows.length === 0) return <p className="py-8 text-center text-xs text-muted-foreground">No time logged yet.</p>;
  return (
    <ResponsiveContainer width="100%" height={Math.max(200, rows.length * 30)}>
      <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 24 }}>
        <CartesianGrid horizontal={false} stroke={theme.grid} />
        <XAxis type="number" unit="h" tick={tick} axisLine={{ stroke: theme.axisLine }} tickLine={false} />
        <YAxis type="category" dataKey="name" width={140} tick={tick} axisLine={{ stroke: theme.axisLine }} tickLine={false} />
        <Tooltip cursor={{ fill: theme.grid, opacity: 0.4 }} contentStyle={tooltipStyle} formatter={(v) => [`${v}h`, "Logged"]} />
        <Bar dataKey="Hours" fill={theme.series[0]} barSize={14} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

const SEVERITY_META = {
  critical: { icon: ShieldAlert, className: "text-red-700 dark:text-red-400", label: "Critical" },
  warning: { icon: AlertTriangle, className: "text-amber-700 dark:text-amber-400", label: "Warning" },
  info: { icon: Info, className: "text-muted-foreground", label: "Info" },
} as const;

export function RecommendationsPanel({ recommendations }: { recommendations: Recommendation[] }) {
  if (recommendations.length === 0) {
    return <p className="text-sm text-muted-foreground">No risks flagged — the project looks healthy against the standard checks.</p>;
  }
  return (
    <ul className="space-y-2">
      {recommendations.map((r, i) => {
        const meta = SEVERITY_META[r.severity];
        const Icon = meta.icon;
        return (
          <li key={i} className="flex items-start gap-2 rounded-md border p-2.5">
            <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", meta.className)} />
            <div className="min-w-0">
              <p className="text-sm">{r.message}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{meta.label} · {r.category}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
