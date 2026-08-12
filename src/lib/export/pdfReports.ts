/**
 * PDF report renderer (jsPDF + autotable) — fully client-side.
 *
 * Produces an executive "one-page project status" cover — an at-a-glance
 * dashboard with the project snapshot, task-status and priority donuts, a
 * budget (planned vs actual) comparison and key highlights — followed by the
 * full detailed tables (status, time & budget, EVM, tasks, resources,
 * governance) on the pages after it.
 */

import { jsPDF } from "jspdf";
import autoTable, { type RowInput, type Styles } from "jspdf-autotable";

import type { ProjectSnapshot } from "@/lib/metrics/portfolioMetrics";
import type { Task } from "@/types/project";
import { formatCost, formatDate, formatPct } from "@/lib/utils";
import type { ReportDefinition } from "./reportDefinitions";

type RGB = [number, number, number];

// Palette (navy-led executive theme).
const NAVY: RGB = [31, 58, 95];
const BLUE: RGB = [46, 105, 160];
const STEEL: RGB = [93, 141, 184];
const LIGHT_BLUE: RGB = [173, 199, 224];
const SALMON: RGB = [224, 138, 108];
const GREY: RGB = [176, 186, 197];
const GREEN: RGB = [76, 175, 80];
const AMBER: RGB = [240, 186, 74];
const RED: RGB = [214, 90, 74];

const BORDER: RGB = [221, 226, 232];
const MUTED: RGB = [110, 118, 128];
const INK: RGB = [33, 37, 41];

const CARD_HEADER_H = 22;

// ---------------------------------------------------------------------------
// Task classification (single status per task) — mirrors the app's buckets.
// ---------------------------------------------------------------------------

type StatusKey = "done" | "wip" | "hold" | "late" | "todo";

const DONE_BUCKETS = ["completed", "done", "terminé", "terminée", "terminées", "termine", "closed", "clos"];
const HOLD_BUCKETS = ["blocked", "bloqué", "bloque", "on hold"];
const WIP_BUCKETS = ["in progress", "en cours", "doing", "wip"];

function classifyTask(t: Task): { label: string; key: StatusKey } {
  const b = t.bucket.trim().toLowerCase();
  const status = t.progressStatus.trim().toLowerCase();
  const done =
    DONE_BUCKETS.includes(b) || t.endDate != null || (t.progressPct ?? 0) >= 100 || status.startsWith("termin");
  if (done) return { label: "Closed", key: "done" };
  if (t.overdue) return { label: "Late", key: "late" };
  if (HOLD_BUCKETS.includes(b)) return { label: "On Hold", key: "hold" };
  if (WIP_BUCKETS.includes(b) || (t.progressPct ?? 0) > 0 || status.startsWith("en cours"))
    return { label: "WIP", key: "wip" };
  return { label: "Not Started", key: "todo" };
}

const STATUS_FILL: Record<StatusKey, RGB> = {
  done: GREEN,
  wip: [214, 234, 213],
  hold: [255, 242, 204],
  late: [250, 219, 216],
  todo: [233, 236, 239],
};
const STATUS_TEXT: Record<StatusKey, RGB> = {
  done: [255, 255, 255],
  wip: [30, 90, 45],
  hold: [125, 95, 10],
  late: [146, 43, 33],
  todo: [90, 95, 100],
};

// ---------------------------------------------------------------------------
// Low-level drawing helpers
// ---------------------------------------------------------------------------

/** Draw a card frame with a navy header bar; returns the y where content begins. */
function drawCard(doc: jsPDF, x: number, y: number, w: number, h: number, title: string): number {
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.6);
  doc.setFillColor(255, 255, 255);
  doc.rect(x, y, w, h, "FD");
  doc.setFillColor(...NAVY);
  doc.rect(x, y, w, CARD_HEADER_H, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.text(title, x + 10, y + CARD_HEADER_H - 7);
  return y + CARD_HEADER_H;
}

/** Draw a donut from weighted segments. Returns false when there is no data. */
function drawDonut(
  doc: jsPDF,
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  segments: Array<{ value: number; color: RGB }>,
): boolean {
  const total = segments.reduce((a, s) => a + s.value, 0);
  if (total <= 0) {
    doc.setFillColor(...[236, 238, 241] as RGB);
    doc.circle(cx, cy, rOuter, "F");
    doc.setFillColor(255, 255, 255);
    doc.circle(cx, cy, rInner, "F");
    return false;
  }
  let start = -Math.PI / 2;
  for (const seg of segments) {
    if (seg.value <= 0) continue;
    const sweep = (seg.value / total) * Math.PI * 2;
    const steps = Math.max(2, Math.ceil(sweep / (Math.PI / 36)));
    const inc = sweep / steps;
    doc.setFillColor(...seg.color);
    for (let i = 0; i < steps; i++) {
      const a0 = start + i * inc;
      const a1 = start + (i + 1) * inc;
      doc.triangle(
        cx,
        cy,
        cx + rOuter * Math.cos(a0),
        cy + rOuter * Math.sin(a0),
        cx + rOuter * Math.cos(a1),
        cy + rOuter * Math.sin(a1),
        "F",
      );
    }
    start += sweep;
  }
  doc.setFillColor(255, 255, 255);
  doc.circle(cx, cy, rInner, "F");
  return true;
}

/** Compact one-line-per-item legend with swatch, label and count (percentage). */
function drawLegend(
  doc: jsPDF,
  x: number,
  y: number,
  items: Array<{ label: string; value: number; color: RGB }>,
): void {
  const total = items.reduce((a, i) => a + i.value, 0);
  let ly = y;
  doc.setFontSize(8.2);
  for (const it of items) {
    doc.setFillColor(...it.color);
    doc.rect(x, ly - 6.5, 8, 8, "F");
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...INK);
    doc.text(it.label, x + 12, ly);
    const pct = total > 0 ? Math.round((it.value / total) * 100) : 0;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...MUTED);
    doc.text(`${it.value}  (${pct}%)`, x + 88, ly);
    ly += 14.5;
  }
}

/** A labelled horizontal bar with its value at the end. */
function drawBar(
  doc: jsPDF,
  x: number,
  y: number,
  label: string,
  value: number,
  maxValue: number,
  barMaxW: number,
  color: RGB,
  valueText: string,
): void {
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...INK);
  doc.text(label, x, y + 6);
  const trackX = x + 52;
  doc.setFillColor(...[238, 240, 243] as RGB);
  doc.rect(trackX, y, barMaxW, 9, "F");
  const w = maxValue > 0 ? Math.max(1, (value / maxValue) * barMaxW) : 0;
  doc.setFillColor(...color);
  doc.rect(trackX, y, w, 9, "F");
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MUTED);
  doc.text(valueText, trackX + barMaxW + 4, y + 7);
}

// ---------------------------------------------------------------------------
// Executive one-page cover
// ---------------------------------------------------------------------------

function drawExecutiveCover(
  doc: jsPDF,
  report: ReportDefinition,
  s: ProjectSnapshot,
  pageWidth: number,
  margin: number,
): void {
  const c = s.project.charter;
  const usableWidth = pageWidth - margin * 2;

  // ---- Title band -----------------------------------------------------------
  const bandH = 104;
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageWidth, bandH, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(21);
  doc.text("Project Status Report", margin, 44);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.6);
  doc.setTextColor(...[209, 219, 233] as RGB);
  const subtitle = doc.splitTextToSize(report.description, usableWidth - 96);
  doc.text(subtitle.slice(0, 3), margin, 62);

  // Icon badge (white circle + mini bar chart).
  const ix = pageWidth - margin - 26;
  const iy = 52;
  doc.setFillColor(255, 255, 255);
  doc.circle(ix, iy, 26, "F");
  doc.setFillColor(...NAVY);
  doc.rect(ix - 12, iy + 2, 6, 8, "F");
  doc.rect(ix - 3, iy - 8, 6, 18, "F");
  doc.rect(ix + 6, iy - 2, 6, 12, "F");

  // ---- Grid geometry --------------------------------------------------------
  const gap = 15;
  const cardW = (usableWidth - gap) / 2;
  const leftX = margin;
  const rightX = margin + cardW + gap;
  const row1Y = bandH + 14;
  const rowH = 138;
  const row2Y = row1Y + rowH + 12;

  // ---- Card 1: Project snapshot (info box) ---------------------------------
  {
    const cy = drawCard(doc, leftX, row1Y, cardW, rowH, "Project Snapshot");
    const rows: Array<[string, string]> = [
      ["Project Manager", c.manager || "—"],
      ["Department", c.department || "—"],
      ["Project Name", c.projectName || "—"],
      ["Code", c.projectCode || "—"],
      ["Communication", c.communication || "—"],
      ["Dated", formatDate(new Date())],
    ];
    const rowH2 = 17.5;
    let ry = cy + 6;
    const labelX = leftX + 10;
    const valueX = leftX + 118;
    const valueW = cardW - 118 - 12;
    doc.setFontSize(8.6);
    rows.forEach(([label, value], i) => {
      if (i % 2 === 1) {
        doc.setFillColor(...[245, 247, 249] as RGB);
        doc.rect(leftX + 1, ry - 1, cardW - 2, rowH2, "F");
      }
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...MUTED);
      doc.text(label, labelX, ry + 11);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...INK);
      const v = doc.splitTextToSize(value, valueW);
      doc.text(v[0] ?? "—", valueX, ry + 11);
      ry += rowH2;
    });
  }

  // ---- Card 2: Task status donut -------------------------------------------
  {
    const cy = drawCard(doc, rightX, row1Y, cardW, rowH, "Task Status Overview");
    const counts: Record<StatusKey, number> = { done: 0, wip: 0, hold: 0, late: 0, todo: 0 };
    for (const t of s.project.tasks) counts[classifyTask(t).key] += 1;
    const segs: Array<{ label: string; value: number; color: RGB }> = [
      { label: "Complete", value: counts.done, color: GREEN },
      { label: "In Progress", value: counts.wip, color: BLUE },
      { label: "Not Started", value: counts.todo, color: LIGHT_BLUE },
      { label: "On Hold", value: counts.hold, color: AMBER },
      { label: "Overdue", value: counts.late, color: RED },
    ];
    const dcx = rightX + 58;
    const dcy = cy + 60;
    const ok = drawDonut(doc, dcx, dcy, 42, 24, segs);
    const total = segs.reduce((a, x) => a + x.value, 0);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...NAVY);
    doc.text(String(total), dcx, dcy + 1, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.6);
    doc.setTextColor(...MUTED);
    doc.text("TASKS", dcx, dcy + 9, { align: "center" });
    if (ok) drawLegend(doc, rightX + 120, cy + 20, segs);
    else {
      doc.setFontSize(9);
      doc.setTextColor(...MUTED);
      doc.text("No tasks on the board.", rightX + 120, cy + 40);
    }
  }

  // ---- Card 3: Priority donut ----------------------------------------------
  {
    const cy = drawCard(doc, leftX, row2Y, cardW, rowH, "Task Priority Breakdown");
    let high = 0;
    let medium = 0;
    let low = 0;
    let critical = 0;
    let none = 0;
    for (const t of s.project.tasks) {
      if (t.priority === "Critical") critical += 1;
      else if (t.priority === "High") high += 1;
      else if (t.priority === "Medium") medium += 1;
      else if (t.priority === "Low") low += 1;
      else none += 1;
    }
    const segs: Array<{ label: string; value: number; color: RGB }> = [
      { label: "Critical", value: critical, color: RED },
      { label: "High", value: high, color: NAVY },
      { label: "Medium", value: medium, color: SALMON },
      { label: "Low", value: low, color: STEEL },
      { label: "Unset", value: none, color: GREY },
    ].filter((seg) => seg.value > 0);
    const dcx = leftX + 58;
    const dcy = cy + 60;
    const ok = drawDonut(doc, dcx, dcy, 42, 24, segs);
    if (ok) drawLegend(doc, leftX + 120, cy + 24, segs);
    else {
      doc.setFontSize(9);
      doc.setTextColor(...MUTED);
      doc.text("No prioritised tasks.", leftX + 120, cy + 40);
    }
  }

  // ---- Card 4: Overall project budget --------------------------------------
  {
    const cy = drawCard(doc, rightX, row2Y, cardW, rowH, "Overall Project Budget");
    const barMaxW = cardW - 52 - 62;
    let by = cy + 18;
    // Hours (planned vs actual).
    const plannedH = s.metrics.budgetHours ?? 0;
    const actualH = s.metrics.consumedHours ?? 0;
    const maxH = Math.max(plannedH, actualH, 1);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text("HOURS", rightX + 10, by);
    by += 8;
    drawBar(doc, rightX + 10, by, "Planned", plannedH, maxH, barMaxW, STEEL, `${Math.round(plannedH)}h`);
    by += 16;
    drawBar(doc, rightX + 10, by, "Actual", actualH, maxH, barMaxW, NAVY, `${Math.round(actualH)}h`);
    by += 22;
    // Cost budget line, when present.
    if (c.budgetCost != null) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...MUTED);
      doc.text("COST BUDGET", rightX + 10, by);
      by += 12;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...INK);
      doc.text(formatCost(c.budgetCost, c.currency), rightX + 10, by);
    }
    // Consumed % badge.
    const pct = s.metrics.budgetConsumedPct;
    if (pct != null) {
      const over = s.metrics.overBudget;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(...(over ? RED : GREEN));
      doc.text(`${formatPct(pct)} consumed${over ? " — over budget" : ""}`, rightX + 10, cy + rowH - 34);
    }
  }

  // ---- Card 5: Key highlights (full width) ---------------------------------
  const row3Y = row2Y + rowH + 12;
  const row3H = 92;
  {
    const cy = drawCard(doc, leftX, row3Y, usableWidth, row3H, "Key Highlights");
    const bullets: string[] = [];
    bullets.push(
      `Overall progress ${formatPct(s.metrics.overallProgressPct)} — ${s.metrics.tasksCompleted}/${s.metrics.tasksTotal} tasks complete.`,
    );
    bullets.push(`Project health: ${s.health.score}/100 (${s.health.rag}).`);
    if (s.metrics.daysRemaining != null)
      bullets.push(
        s.metrics.overdue
          ? `Schedule: past end date by ${Math.abs(s.metrics.daysRemaining)} day(s).`
          : `Schedule: ${s.metrics.daysRemaining} day(s) remaining to the planned end date.`,
      );
    for (const reason of s.health.reasons.slice(0, 2)) bullets.push(reason.message);
    const items = bullets.slice(0, 4);

    let hy = cy + 14;
    const textW = usableWidth - 28;
    doc.setFontSize(9);
    for (const b of items) {
      doc.setFillColor(...NAVY);
      doc.circle(leftX + 12, hy - 3, 1.6, "F");
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...INK);
      const lines = doc.splitTextToSize(b, textW);
      doc.text(lines.slice(0, 1), leftX + 20, hy);
      hy += 17;
    }
  }

  // ---- Task / issue status table -------------------------------------------
  const tableTitleY = row3Y + row3H + 22;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...NAVY);
  doc.text("Task & Issue Status", margin, tableTitleY);

  const body: RowInput[] = s.project.tasks.map((t, i) => {
    const cls = classifyTask(t);
    const statusCell: { content: string; styles: Partial<Styles> } = {
      content: cls.label,
      styles: {
        fillColor: STATUS_FILL[cls.key],
        textColor: STATUS_TEXT[cls.key],
        fontStyle: "bold",
        halign: "center",
      },
    };
    const comments = (t.notes || "").replace(/\s+/g, " ").trim() || "—";
    return [
      i + 1,
      t.title,
      t.assignee || "—",
      formatDate(t.startDate),
      formatDate(t.dueDate),
      statusCell,
      comments,
    ];
  });

  autoTable(doc, {
    startY: tableTitleY + 8,
    head: [["#", "Task / Issue", "Owner", "Start", "Due", "Status", "Comments / Updates"]],
    body:
      body.length > 0
        ? body
        : [[{ content: "No tasks on the board.", colSpan: 7, styles: { halign: "center", textColor: MUTED } }]],
    styles: {
      fontSize: 8.5,
      cellPadding: { top: 4, bottom: 4, left: 5, right: 5 },
      overflow: "linebreak",
      valign: "middle",
      lineColor: BORDER,
      lineWidth: 0.5,
    },
    headStyles: { fillColor: NAVY, textColor: 255, fontStyle: "bold", fontSize: 8.5 },
    alternateRowStyles: { fillColor: [246, 247, 249] },
    columnStyles: {
      0: { cellWidth: 22, halign: "center" },
      2: { cellWidth: 62 },
      3: { cellWidth: 50 },
      4: { cellWidth: 50 },
      5: { cellWidth: 58 },
    },
    margin: { left: margin, right: margin },
  });
}

// ---------------------------------------------------------------------------
// Detailed tables (the full report body)
// ---------------------------------------------------------------------------

function drawDetailTables(
  doc: jsPDF,
  report: ReportDefinition,
  snapshots: ProjectSnapshot[],
  pageWidth: number,
  pageHeight: number,
  margin: number,
): void {
  const usableWidth = pageWidth - margin * 2;
  doc.addPage();
  doc.setFontSize(16);
  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold");
  doc.text("Detailed Report", margin, 50);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...MUTED);
  doc.text(
    `Generated ${new Date().toLocaleString()} — Portfolio PPM (in-browser, no data stored)`,
    margin,
    66,
  );

  let cursorY = 92;
  for (const table of report.build(snapshots)) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...INK);
    doc.text(table.title, margin, cursorY);
    const columnStyles: Record<string, Partial<{ cellWidth: number; fontStyle: "bold" }>> =
      table.headers.length <= 2 ? { 0: { cellWidth: 150, fontStyle: "bold" } } : {};
    autoTable(doc, {
      startY: cursorY + 12,
      head: [table.headers],
      body: table.rows.map((r) => r.map((cell) => String(cell))),
      tableWidth: usableWidth,
      styles: {
        fontSize: 9.5,
        cellPadding: { top: 4, bottom: 4, left: 6, right: 6 },
        overflow: "linebreak",
        valign: "middle",
        lineColor: BORDER,
        lineWidth: 0.5,
      },
      headStyles: { fillColor: NAVY, textColor: 255, fontStyle: "bold", fontSize: 9.5 },
      alternateRowStyles: { fillColor: [245, 246, 248] },
      columnStyles,
      margin: { left: margin, right: margin },
    });
    cursorY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 26;
    if (cursorY > pageHeight - 90) {
      doc.addPage();
      cursorY = 56;
    }
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function exportReportToPdf(report: ReportDefinition, snapshots: ProjectSnapshot[]): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 32;

  const s = snapshots[0];
  if (s) {
    drawExecutiveCover(doc, report, s, pageWidth, margin);
    drawDetailTables(doc, report, snapshots, pageWidth, pageHeight, margin);
  }

  // Page footers.
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...GREY);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin - 50, pageHeight - 20);
  }

  doc.save(`${report.title.replace(/\s+/g, "-")}.pdf`);
}
