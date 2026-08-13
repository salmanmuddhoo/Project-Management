/**
 * Report definitions shared by the Excel and PDF renderers.
 *
 * A single **combined project report** builds the project details followed by
 * every section (status, time & budget, EVM, tasks, resources, risk flags,
 * governance) — one workbook / one document that tells the whole story.
 */

import { computePortfolioMetrics, type ProjectSnapshot } from "@/lib/metrics/portfolioMetrics";
import { generateRecommendations } from "@/lib/metrics/recommendations";
import { daysBetween, formatCost, formatDate, formatHours, formatNumber, formatPct } from "@/lib/utils";

export interface ReportTable {
  title: string;
  headers: string[];
  rows: Array<Array<string | number>>;
}

export interface ReportDefinition {
  key: string;
  title: string;
  description: string;
  build: (snapshots: ProjectSnapshot[]) => ReportTable[];
}

const hrs = (v: number | null | undefined) => (v == null ? "—" : `${Math.round(v)}h`);
const idx = (v: number | null | undefined) => (v == null ? "—" : v.toFixed(2));

/** "+N j de retard" / "N j d'avance" / "À temps", comparing actual to planned. */
const dateVariance = (planned: Date | null, actual: Date | null): string => {
  if (!planned || !actual) return "—";
  const diff = daysBetween(planned, actual);
  if (diff === 0) return "À temps";
  return diff > 0 ? `+${diff} j de retard` : `${Math.abs(diff)} j d'avance`;
};

// ---------------------------------------------------------------------------
// Section builders (each returns the tables for one section)
// ---------------------------------------------------------------------------

function projectDetailsTables(s: ProjectSnapshot): ReportTable[] {
  const c = s.project.charter;
  const budget = [
    c.budgetHours != null ? `${Math.round(c.budgetHours)}h` : null,
    c.budgetCost != null ? formatCost(c.budgetCost, c.currency) : null,
  ].filter(Boolean).join(" · ") || "—";

  const tables: ReportTable[] = [
    {
      title: "Project Details",
      headers: ["Field", "Value"],
      rows: [
        ["Project", c.projectName],
        ["Code", c.projectCode || "—"],
        ["Project manager", c.manager || "—"],
        ["Département", c.department || "—"],
        ["Communication", c.communication || "—"],
        ["Timorc code(s)", s.project.timorcCodes.map((t) => t.code).join(", ") || "—"],
        ["Start date (prévisionnelle)", formatDate(c.plannedStartDate)],
        ["Start date (réelle)", formatDate(c.startDate)],
        ["Écart date de début", dateVariance(c.plannedStartDate, c.startDate)],
        ["End date (prévisionnelle)", formatDate(c.plannedEndDate)],
        ["End date (réelle)", formatDate(c.endDate)],
        ["Écart date de fin", dateVariance(c.plannedEndDate, c.endDate)],
        ["Budget", budget],
        ["Progress", formatPct(s.metrics.overallProgressPct)],
        ["Health", `${s.health.score} (${s.health.rag})`],
        ["Source file", s.project.meta.sourceFileName],
      ],
    },
  ];
  if (c.sections.length > 0) {
    tables.push({
      title: "Charter",
      headers: ["Section", "Content"],
      rows: c.sections.map((sec) => [sec.title, sec.body]),
    });
  }
  return tables;
}

function statusTable(s: ProjectSnapshot): ReportTable {
  return {
    title: "Status",
    headers: ["Metric", "Value"],
    rows: [
      ["Time elapsed", formatPct(s.metrics.timeElapsedPct)],
      ["Progress", formatPct(s.metrics.taskCompletionPct)],
      ["Days remaining", s.metrics.daysRemaining ?? "—"],
      ["Tasks", `${s.metrics.tasksCompleted}/${s.metrics.tasksTotal} done`],
      ["In progress / Blocked / Overdue", `${s.metrics.tasksInProgress} / ${s.metrics.tasksBlocked} / ${s.metrics.tasksOverdue}`],
      ["Risk flags", s.health.reasons.map((r) => r.message).join(" | ") || "None"],
    ],
  };
}

function timeBudgetTables(s: ProjectSnapshot): ReportTable[] {
  const c = s.project.charter;
  return [
    {
      title: "Time & Budget",
      headers: ["Metric", "Value"],
      rows: [
        ["Hours budget", hrs(c.budgetHours)],
        ["Cost budget", c.budgetCost == null ? "—" : formatCost(c.budgetCost, c.currency)],
        ["Hours consumed", hrs(s.metrics.consumedHours)],
        ["Hours remaining", hrs(s.metrics.remainingHours)],
        ["Consumed %", formatPct(s.metrics.budgetConsumedPct)],
        ["Over budget", s.metrics.overBudget ? "YES" : "No"],
      ],
    },
    {
      title: "Hours by Person",
      headers: ["Person", "Days", "Hours"],
      rows: s.metrics.byResource.map((r) => [r.name, formatNumber(r.days), hrs(r.hours)]),
    },
  ];
}

function evmTable(s: ProjectSnapshot): ReportTable {
  return {
    title: "EVM",
    headers: ["Metric", ...s.evm.units.map((u) => (u.unit === "cost" && u.currency ? `Cost (${u.currency})` : "Hours"))],
    rows: (() => {
      const fmt = (unitIdx: number, v: number | null) => {
        const u = s.evm.units[unitIdx];
        if (v == null) return "—";
        return u.unit === "hours" ? `${Math.round(v)}h` : Math.round(v).toLocaleString();
      };
      const line = (label: string, get: (uIdx: number) => string) => [label, ...s.evm.units.map((_, i) => get(i))];
      return [
        ["% complete", ...s.evm.units.map(() => formatPct(s.evm.percentComplete))],
        ["% planned", ...s.evm.units.map(() => formatPct(s.evm.plannedPercent))],
        line("BAC", (i) => fmt(i, s.evm.units[i].bac)),
        line("PV", (i) => fmt(i, s.evm.units[i].pv)),
        line("EV", (i) => fmt(i, s.evm.units[i].ev)),
        line("AC", (i) => fmt(i, s.evm.units[i].ac)),
        line("SPI", (i) => idx(s.evm.units[i].spi)),
        line("CPI", (i) => idx(s.evm.units[i].cpi)),
        line("EAC", (i) => fmt(i, s.evm.units[i].eac)),
        line("VAC", (i) => fmt(i, s.evm.units[i].vac)),
      ];
    })(),
  };
}

function forecastTable(s: ProjectSnapshot): ReportTable | null {
  const f = s.forecast;
  if (!f.available) return null;
  const verdict = { on_track: "On track", at_risk: "At risk", off_track: "Off track", unknown: "Insufficient data" }[f.verdict];
  const rows: Array<[string, string]> = [["Outlook", verdict], ["Summary", f.summary]];
  if (f.schedule) {
    rows.push(["Planned finish", formatDate(f.schedule.plannedEnd)]);
    rows.push(["Forecast finish", formatDate(f.schedule.forecastEnd)]);
    rows.push([
      "Schedule variance",
      f.schedule.daysVariance == null
        ? "—"
        : `${f.schedule.daysVariance > 0 ? "+" : ""}${f.schedule.daysVariance} day(s)${f.schedule.spi != null ? ` (SPI ${f.schedule.spi.toFixed(2)})` : ""}`,
    ]);
  }
  if (f.budget) {
    const unit = (v: number | null) => (v == null ? "—" : f.budget!.unit === "hours" ? `${Math.round(v)}h` : formatCost(v, f.budget!.currency));
    rows.push(["Budget (BAC)", unit(f.budget.bac)]);
    rows.push(["Forecast at completion (EAC)", unit(f.budget.eac)]);
    rows.push([
      "Variance at completion (VAC)",
      f.budget.vac == null ? "—" : `${unit(f.budget.vac)}${f.budget.overrunPct != null ? ` (${f.budget.overrunPct > 0 ? "+" : ""}${Math.round(f.budget.overrunPct)}%)` : ""}`,
    ]);
  }
  return { title: "Forecast", headers: ["Field", "Value"], rows };
}

function tasksTable(s: ProjectSnapshot): ReportTable {
  const done = (t: (typeof s.project.tasks)[number]) =>
    ["completed", "done", "terminé", "terminée", "terminées"].includes(t.bucket.trim().toLowerCase()) ||
    t.endDate != null || (t.progressPct ?? 0) >= 100;
  return {
    title: "Tasks",
    headers: ["Task", "Bucket", "Assignee", "Priority", "Estimate", "Progress", "Start", "Due", "End"],
    rows: s.project.tasks.map((t) => [
      t.title, t.bucket, t.assignee || "—", t.priority,
      formatHours(t.estimateHours),
      `${done(t) ? 100 : Math.max(0, Math.min(100, t.progressPct ?? 0))}%`,
      formatDate(t.startDate), formatDate(t.dueDate), formatDate(t.endDate),
    ]),
  };
}

function resourcesTable(s: ProjectSnapshot): ReportTable {
  const nameKey = (n: string) => n.toLowerCase().replace(/\s*\([^)]*\)\s*$/, "").trim();
  const hoursByName = new Map<string, number>();
  for (const r of s.metrics.byResource) hoursByName.set(nameKey(r.name), (hoursByName.get(nameKey(r.name)) ?? 0) + r.hours);
  return {
    title: "Resources",
    headers: ["Name", "Role", "Hours logged"],
    rows: s.project.resources.map((r) => [
      r.external ? `${r.name} (Externe)` : r.name,
      r.role || "—",
      hrs(hoursByName.get(nameKey(r.name)) ?? 0),
    ]),
  };
}

function governanceTable(s: ProjectSnapshot): ReportTable {
  return {
    title: "Governance",
    headers: ["Check", "Result"],
    rows: s.governance.checks.map((c) => [c.label, c.passed ? "PASS" : "FAIL"]),
  };
}

// ---------------------------------------------------------------------------
// The single combined report
// ---------------------------------------------------------------------------

export const REPORTS: ReportDefinition[] = [
  {
    key: "project",
    title: "Executive Project Report",
    description:
      "An executive status overview — project snapshot, task status and priority, budget performance and key highlights — followed by the full details: charter, status, time & budget, EVM, tasks, resources and governance.",
    build: (snapshots) => {
      const s = snapshots[0];
      if (!s) return [];
      const p = computePortfolioMetrics(snapshots);
      const forecast = forecastTable(s);
      return [
        ...projectDetailsTables(s),
        statusTable(s),
        ...timeBudgetTables(s),
        evmTable(s),
        ...(forecast ? [forecast] : []),
        tasksTable(s),
        resourcesTable(s),
        {
          title: "Risk Flags",
          headers: ["Severity", "Category", "Finding"],
          rows: generateRecommendations(snapshots).map((r) => [r.severity.toUpperCase(), r.category, r.message]),
        },
        governanceTable(s),
      ];
    },
  },
];
