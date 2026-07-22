/**
 * Earned Value Management — CPI/SPI, variances and forecast (EAC/VAC) in
 * whichever units the budget provides (hours and/or cost), plus a PV/EV/AC
 * chart and a plain-language read-out.
 */

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ChartCard } from "@/components/charts/ChartCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { KpiTile } from "@/components/shared/KpiTile";
import { useChartTheme } from "@/components/charts/chartTheme";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { EvmUnit } from "@/lib/metrics/evm";
import { formatCost } from "@/lib/utils";
import { useActiveSnapshot } from "@/store/portfolioStore";

const idx = (v: number | null) => (v == null ? "—" : v.toFixed(2));

function fmt(u: EvmUnit, v: number | null): string {
  if (v == null) return "—";
  return u.unit === "hours" ? `${Math.round(v)}h` : formatCost(v, u.currency);
}

function interpretation(u: EvmUnit): string {
  const parts: string[] = [];
  if (u.cpi != null) parts.push(u.cpi >= 1 ? `On/under budget (CPI ${u.cpi.toFixed(2)})` : `Over budget (CPI ${u.cpi.toFixed(2)})`);
  if (u.spi != null) parts.push(u.spi >= 1 ? `On/ahead of schedule (SPI ${u.spi.toFixed(2)})` : `Behind schedule (SPI ${u.spi.toFixed(2)})`);
  if (u.eac != null) parts.push(`Forecast at completion ${fmt(u, u.eac)} vs budget ${fmt(u, u.bac)}`);
  return parts.join(" · ");
}

export function EvmPage() {
  const snapshot = useActiveSnapshot();
  const theme = useChartTheme();
  if (!snapshot) return <EmptyState />;
  const { evm, metrics } = snapshot;

  if (!evm.available) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-semibold">Earned Value Management</h1>
        </div>
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          EVM needs a budget. Add a <strong>Budget</strong> block to the charter card with hours
          (e.g. <code>Hours: 50</code>) and/or a cost (e.g. <code>Cost: Rs 1,200,000</code>).
        </p>
      </div>
    );
  }

  const primary = evm.units[0];
  const chartData = [
    { name: "Planned (PV)", value: Math.round(primary.pv) },
    { name: "Earned (EV)", value: Math.round(primary.ev) },
    { name: "Actual (AC)", value: primary.ac == null ? 0 : Math.round(primary.ac) },
  ];
  const tick = { fill: theme.tickInk, fontSize: 11 };

  const rows: Array<[string, (u: EvmUnit) => string]> = [
    ["Budget at completion (BAC)", (u) => fmt(u, u.bac)],
    ["Planned value (PV)", (u) => fmt(u, u.pv)],
    ["Earned value (EV)", (u) => fmt(u, u.ev)],
    ["Actual cost (AC)", (u) => fmt(u, u.ac)],
    ["Schedule variance (SV = EV−PV)", (u) => fmt(u, u.sv)],
    ["Cost variance (CV = EV−AC)", (u) => fmt(u, u.cv)],
    ["Schedule perf. index (SPI)", (u) => idx(u.spi)],
    ["Cost perf. index (CPI)", (u) => idx(u.cpi)],
    ["Estimate at completion (EAC)", (u) => fmt(u, u.eac)],
    ["Estimate to complete (ETC)", (u) => fmt(u, u.etc)],
    ["Variance at completion (VAC)", (u) => fmt(u, u.vac)],
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Earned Value Management</h1>
        <p className="text-sm text-muted-foreground">
          {Math.round(evm.percentComplete)}% complete vs {Math.round(evm.plannedPercent)}% planned
          (time-elapsed baseline) · progress is {metrics.effortCompletionPct != null ? "weighted by task estimates" : "based on task count"}.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiTile label="Schedule (SPI)" value={idx(evm.spi)} tone={evm.spi == null ? "default" : evm.spi >= 1 ? "good" : "warning"}
          hint={evm.spi == null ? "" : evm.spi >= 1 ? "on/ahead" : "behind"} />
        <KpiTile label="Cost (CPI)" value={idx(primary.cpi)} tone={primary.cpi == null ? "default" : primary.cpi >= 1 ? "good" : "critical"}
          hint={primary.cpi == null ? "" : primary.cpi >= 1 ? "on/under" : "over"} />
        <KpiTile label="Forecast (EAC)" value={fmt(primary, primary.eac)} hint={`budget ${fmt(primary, primary.bac)}`} />
        <KpiTile label="Var. at completion" value={fmt(primary, primary.vac)}
          tone={primary.vac == null ? "default" : primary.vac >= 0 ? "good" : "critical"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title={`Planned vs Earned vs Actual (${primary.unit})`} description="The three EVM curves at today">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ right: 8 }}>
              <CartesianGrid vertical={false} stroke={theme.grid} />
              <XAxis dataKey="name" tick={tick} axisLine={{ stroke: theme.axisLine }} tickLine={false} />
              <YAxis tick={tick} axisLine={false} tickLine={false} width={56}
                tickFormatter={(v: number) => (primary.unit === "hours" ? `${v}h` : String(v))} />
              <Tooltip cursor={{ fill: theme.grid, opacity: 0.4 }}
                contentStyle={{ backgroundColor: theme.tooltip.backgroundColor, border: theme.tooltip.border, borderRadius: 8, color: theme.tooltip.color, fontSize: 12 }}
                formatter={(v) => fmt(primary, Number(v))} />
              <Bar dataKey="value" fill={theme.series[0]} barSize={40} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <Card>
          <CardHeader><CardTitle>Reading</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {evm.units.map((u) => (
              <p key={u.unit}>
                <span className="font-medium capitalize">{u.unit}:</span> {interpretation(u) || "—"}
              </p>
            ))}
            {evm.note && <p className="text-xs text-muted-foreground">{evm.note}</p>}
            <p className="text-xs text-muted-foreground">
              SPI/CPI ≥ 1 is good. EAC forecasts the finish at the current cost efficiency; VAC is
              budget − EAC (negative = expected overrun).
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>EVM metrics</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Metric</TableHead>
                {evm.units.map((u) => (
                  <TableHead key={u.unit} className="text-right capitalize">{u.unit === "cost" && u.currency ? `Cost (${u.currency})` : u.unit}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(([label, get]) => (
                <TableRow key={label}>
                  <TableCell className="font-medium">{label}</TableCell>
                  {evm.units.map((u) => (
                    <TableCell key={u.unit} className="tnum text-right">{get(u)}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
