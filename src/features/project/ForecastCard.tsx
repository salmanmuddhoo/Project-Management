/**
 * Forecast card — the PMO executive read-out: "on current performance, will
 * this project finish within budget and on time?" Built from EVM's EAC/VAC and
 * the SPI-derived projected finish date.
 */

import { CalendarClock, TrendingUp, Wallet } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { BudgetForecast, ForecastOutlook, ForecastResult } from "@/lib/metrics/forecast";
import { cn, formatCost, formatDate } from "@/lib/utils";

const VERDICT: Record<ForecastResult["verdict"], { label: string; cls: string }> = {
  on_track: { label: "On track", cls: "border-green-600/30 bg-green-600/10 text-green-700 dark:text-green-400" },
  at_risk: { label: "At risk", cls: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400" },
  off_track: { label: "Off track", cls: "border-red-600/30 bg-red-600/10 text-red-700 dark:text-red-400" },
  unknown: { label: "Insufficient data", cls: "border-muted-foreground/30 bg-muted text-muted-foreground" },
};

const OUTLOOK_CLS: Record<ForecastOutlook, string> = {
  within: "text-green-700 dark:text-green-400",
  over: "text-red-700 dark:text-red-400",
  unknown: "text-muted-foreground",
};

function fmtUnit(b: BudgetForecast, v: number | null): string {
  if (v == null) return "—";
  return b.unit === "hours" ? `${Math.round(v)}h` : formatCost(v, b.currency);
}

function Row({
  icon: Icon,
  label,
  plan,
  forecast,
  variance,
  outlook,
}: {
  icon: typeof CalendarClock;
  label: string;
  plan: string;
  forecast: string;
  variance: string;
  outlook: ForecastOutlook;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border p-3">
      <Icon className={cn("h-5 w-5 shrink-0", OUTLOOK_CLS[outlook])} />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="text-sm">
          <span className="text-muted-foreground">{plan}</span>
          <span className="mx-1.5">→</span>
          <span className="font-semibold">{forecast}</span>
        </p>
      </div>
      <span className={cn("tnum shrink-0 text-sm font-semibold", OUTLOOK_CLS[outlook])}>{variance}</span>
    </div>
  );
}

export function ForecastCard({ forecast }: { forecast: ForecastResult }) {
  if (!forecast.available) return null;
  const v = VERDICT[forecast.verdict];
  const { budget, schedule } = forecast;

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          <CardTitle>Forecast</CardTitle>
        </div>
        <Badge variant="outline" className={cn("gap-1", v.cls)}>{v.label}</Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm">{forecast.summary}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {schedule && (
            <Row
              icon={CalendarClock}
              label={`Timeline${schedule.spi != null ? ` · SPI ${schedule.spi.toFixed(2)}` : ""}`}
              plan={`Plan ${formatDate(schedule.plannedEnd)}`}
              forecast={formatDate(schedule.forecastEnd)}
              variance={
                schedule.daysVariance == null
                  ? "—"
                  : schedule.daysVariance > 0
                    ? `+${schedule.daysVariance}d`
                    : `${schedule.daysVariance}d`
              }
              outlook={schedule.outlook}
            />
          )}
          {budget && (
            <Row
              icon={Wallet}
              label="Budget (EAC vs BAC)"
              plan={`Plan ${fmtUnit(budget, budget.bac)}`}
              forecast={fmtUnit(budget, budget.eac)}
              variance={
                budget.overrunPct == null
                  ? "—"
                  : `${budget.overrunPct > 0 ? "+" : ""}${Math.round(budget.overrunPct)}%`
              }
              outlook={budget.outlook}
            />
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Timeline projected from SPI (planned duration ÷ SPI); budget from EVM EAC/VAC at the
          current cost efficiency. Estimates, not commitments.
        </p>
      </CardContent>
    </Card>
  );
}
