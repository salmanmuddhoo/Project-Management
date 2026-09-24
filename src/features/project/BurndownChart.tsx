/**
 * Burndown chart — remaining work (or remaining hours budget) over the charter
 * window: the actual line against the expected straight-line burn.
 * Calculation: `src/lib/metrics/burndown.ts`.
 */

import { useState } from "react";
import { CheckCircle2, Clock, TrendingDown, TrendingUp } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { STATUS_COLORS, useChartTheme } from "@/components/charts/chartTheme";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  burndownVerdict,
  formatBurndownValue,
  type BurndownResult,
  type BurndownSeries,
} from "@/lib/metrics/burndown";
import { cn } from "@/lib/utils";
import { useSettings } from "@/store/settingsStore";

type View = "work" | "budget";

const dateFmt = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", timeZone: "UTC" });
const longDateFmt = new Intl.DateTimeFormat(undefined, { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });

const formatValue = formatBurndownValue;

const VIEW_META: Record<View, { label: string; description: string }> = {
  work: {
    label: "Work",
    description: "Remaining work vs the straight-line plan from charter start to end.",
  },
  budget: {
    label: "Hours budget",
    description: "Remaining hours budget (budget − Timorc hours logged) vs an even burn.",
  },
};

export function BurndownCard({ burndown }: { burndown: BurndownResult }) {
  const [view, setView] = useState<View>(burndown.work.available || !burndown.budget.available ? "work" : "budget");
  const series = burndown[view];

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div className="space-y-1">
          <CardTitle>Burndown — actual vs expected</CardTitle>
          <CardDescription>{VIEW_META[view].description}</CardDescription>
        </div>
        <div role="tablist" aria-label="Burndown measure" className="inline-flex rounded-md border p-0.5">
          {(Object.keys(VIEW_META) as View[]).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={cn(
                "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                view === v ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {VIEW_META[v].label}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {series.available ? (
          <BurndownBody series={series} />
        ) : (
          <p className="py-10 text-center text-sm text-muted-foreground">{series.unavailableReason}</p>
        )}
      </CardContent>
    </Card>
  );
}

const TONE_META = {
  bad: { color: STATUS_COLORS.critical, Icon: TrendingUp },
  good: { color: STATUS_COLORS.good, Icon: TrendingDown },
  "on-plan": { color: STATUS_COLORS.good, Icon: CheckCircle2 },
  "not-started": { color: undefined, Icon: Clock },
} as const;

function Verdict({ series }: { series: BurndownSeries }) {
  const settings = useSettings();
  const verdict = burndownVerdict(series, settings);
  const { color, Icon } = TONE_META[verdict.tone];
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
      <span className="inline-flex items-center gap-1 font-medium">
        <Icon className={cn("h-4 w-4", !color && "text-muted-foreground")} style={color ? { color } : undefined} aria-hidden />
        {verdict.label}
      </span>
      <span className="text-muted-foreground">· {verdict.summary}</span>
    </p>
  );
}

function LegendKey({ dashed, color, label }: { dashed?: boolean; color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <svg width="18" height="6" aria-hidden>
        <line x1="1" y1="3" x2="17" y2="3" stroke={color} strokeWidth="2" strokeLinecap="round" strokeDasharray={dashed ? "4 3" : undefined} />
      </svg>
      {label}
    </span>
  );
}

function BurndownBody({ series }: { series: BurndownSeries }) {
  const theme = useChartTheme();
  const actualColor = theme.series[0];
  const expectedColor = theme.tickInk;
  const tick = { fill: theme.tickInk, fontSize: 11 };
  const hasNegative = series.points.some((p) => (p.actual ?? 0) < 0);
  const lastActual = [...series.points].reverse().find((p) => p.actual != null);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Verdict series={series} />
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <LegendKey color={actualColor} label="Actual" />
          <LegendKey color={expectedColor} dashed label="Expected" />
        </div>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={series.points} margin={{ top: 16, right: 56, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke={theme.grid} />
          <XAxis
            dataKey="date"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            tickFormatter={(d: number) => dateFmt.format(d)}
            tick={tick}
            axisLine={{ stroke: theme.axisLine }}
            tickLine={false}
            minTickGap={24}
          />
          <YAxis
            tick={tick}
            axisLine={false}
            tickLine={false}
            width={48}
            allowDecimals={series.unit === "hours"}
            tickFormatter={(v: number) => (series.unit === "hours" ? `${Math.round(v)}h` : String(v))}
          />
          {hasNegative && <ReferenceLine y={0} stroke={theme.axisLine} />}
          {series.today != null && (
            <ReferenceLine
              x={series.today}
              stroke={theme.axisLine}
              label={{ value: "Today", position: "top", fill: theme.tickInk, fontSize: 11 }}
            />
          )}
          <Tooltip
            contentStyle={{
              backgroundColor: theme.tooltip.backgroundColor,
              border: theme.tooltip.border,
              borderRadius: 8,
              color: theme.tooltip.color,
              fontSize: 12,
            }}
            cursor={{ stroke: theme.axisLine }}
            labelFormatter={(d) => longDateFmt.format(Number(d))}
            formatter={(value, name) => [formatValue(series, value == null ? null : Number(value)), name]}
          />
          <Line
            dataKey="expected"
            name="Expected"
            stroke={expectedColor}
            strokeWidth={2}
            strokeDasharray="6 4"
            dot={false}
            activeDot={{ r: 4, fill: expectedColor, stroke: theme.surface, strokeWidth: 2 }}
            isAnimationActive={false}
          />
          <Line
            dataKey="actual"
            name="Actual"
            stroke={actualColor}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            connectNulls={false}
            isAnimationActive={false}
            activeDot={{ r: 5, fill: actualColor, stroke: theme.surface, strokeWidth: 2 }}
            // End-dot + value label on the latest actual point only.
            dot={(props: { cx?: number; cy?: number; payload?: { date: number }; index?: number }) => {
              const { cx, cy, payload, index } = props;
              if (cx == null || cy == null || payload?.date !== lastActual?.date) {
                return <g key={`d-${index}`} />;
              }
              return (
                <g key={`d-${index}`}>
                  <circle cx={cx} cy={cy} r={4} fill={actualColor} stroke={theme.surface} strokeWidth={2} />
                  <text
                    x={cx + 8}
                    y={cy + 4}
                    fontSize={11}
                    fill={theme.tooltip.color}
                    stroke={theme.surface}
                    strokeWidth={3}
                    paintOrder="stroke"
                  >
                    {formatValue(series, lastActual?.actual)}
                  </text>
                </g>
              );
            }}
          />
        </LineChart>
      </ResponsiveContainer>

      <DataTable series={series} />
    </div>
  );
}

/** Table view of the plotted values (accessibility / exact numbers). */
function DataTable({ series }: { series: BurndownSeries }) {
  // Keep it readable: ~12 evenly spaced rows plus the start, today and end.
  const pts = series.points;
  const step = Math.max(1, Math.ceil(pts.length / 12));
  const keep = new Set([pts[0]?.date, series.today, series.endDate, pts[pts.length - 1]?.date]);
  const rows = pts.filter((p, i) => i % step === 0 || keep.has(p.date));

  return (
    <details className="text-xs">
      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">View data</summary>
      <div className="mt-2 max-h-64 overflow-auto rounded-md border">
        <table className="w-full text-left">
          <thead className="sticky top-0 bg-muted text-muted-foreground">
            <tr>
              <th className="px-3 py-1.5 font-medium">Date</th>
              <th className="px-3 py-1.5 text-right font-medium">Expected</th>
              <th className="px-3 py-1.5 text-right font-medium">Actual</th>
              <th className="px-3 py-1.5 text-right font-medium">Variance</th>
            </tr>
          </thead>
          <tbody className="tnum">
            {rows.map((p) => (
              <tr key={p.date} className={cn("border-t", p.date === series.today && "font-medium")}>
                <td className="px-3 py-1">
                  {longDateFmt.format(p.date)}
                  {p.date === series.today && <span className="ml-1 text-muted-foreground">(today)</span>}
                </td>
                <td className="px-3 py-1 text-right">{formatValue(series, p.expected)}</td>
                <td className="px-3 py-1 text-right">{formatValue(series, p.actual)}</td>
                <td className="px-3 py-1 text-right">
                  {p.actual != null && p.expected != null
                    ? `${p.actual - p.expected > 0 ? "+" : ""}${formatValue(series, p.actual - p.expected)}`
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
