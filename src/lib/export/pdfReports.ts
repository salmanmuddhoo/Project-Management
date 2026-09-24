/**
 * PDF report renderer (jsPDF + autotable) — fully client-side.
 *
 * Produces an executive "one-page project status" cover — an at-a-glance
 * dashboard with the project snapshot, task-status and priority donuts, a
 * budget (planned vs actual) comparison, key highlights and the burndown
 * (work and hours budget, actual vs expected) — followed by the detailed
 * tables (status, time & budget, forecast, resources, risk flags, governance)
 * on the pages after it. The EVM table is Excel-only.
 */

import { jsPDF } from "jspdf";
import autoTable, { type RowInput, type Styles } from "jspdf-autotable";

import { burndownVerdict, formatBurndownValue, type BurndownSeries } from "@/lib/metrics/burndown";
import type { ProjectSnapshot } from "@/lib/metrics/portfolioMetrics";
import { isBlockedBucket, isDoneBucket, isProgressBucket } from "@/lib/metrics/projectMetrics";
import type { Task } from "@/types/project";
import { daysBetween, formatCost, formatDate, formatPct } from "@/lib/utils";
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

// Bucket names come from Settings (the same lists the metrics use).
function classifyTask(t: Task): { label: string; key: StatusKey } {
  const b = t.bucket;
  const status = t.progressStatus.trim().toLowerCase();
  const done =
    isDoneBucket(b) || t.endDate != null || (t.progressPct ?? 0) >= 100 || status.startsWith("termin");
  if (done) return { label: "Closed", key: "done" };
  if (t.overdue) return { label: "Late", key: "late" };
  if (isBlockedBucket(b)) return { label: "On Hold", key: "hold" };
  if (isProgressBucket(b) || (t.progressPct ?? 0) > 0 || status.startsWith("en cours"))
    return { label: "In Progress", key: "wip" };
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
// Burndown card (vector line chart)
// ---------------------------------------------------------------------------

const shortDateFmt = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", timeZone: "UTC" });

/** A "nice" step (1, 2, 2.5, 5 × 10ⁿ) giving roughly `target` intervals. */
function niceStep(range: number, target = 4): number {
  if (!(range > 0)) return 1;
  const raw = range / target;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
  return nice * mag;
}

/** Card with a burndown line chart: dashed expected line, solid actual line to today. */
function drawBurndownCard(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  title: string,
  series: BurndownSeries,
): void {
  const cy = drawCard(doc, x, y, w, h, title);

  if (!series.available || series.points.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...MUTED);
    doc.text(doc.splitTextToSize(series.unavailableReason ?? "No data.", w - 24), x + w / 2, cy + (h - CARD_HEADER_H) / 2, {
      align: "center",
    });
    return;
  }

  // -- Verdict (status label + one-line summary) ------------------------------
  const verdict = burndownVerdict(series);
  const toneColor: RGB = verdict.tone === "bad" ? RED : verdict.tone === "not-started" ? MUTED : GREEN;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.4);
  doc.setTextColor(...toneColor);
  doc.text(verdict.label, x + 10, cy + 13);
  const labelW = doc.getTextWidth(verdict.label);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.4);
  doc.setTextColor(...MUTED);
  const summary = doc.splitTextToSize(verdict.summary, w - 20 - labelW - 6) as string[];
  doc.text(summary.slice(0, 2), x + 10 + labelW + 6, cy + 13);

  // -- Plot geometry -----------------------------------------------------------
  const px = x + 38;
  const pw = w - 38 - 30;
  const py = cy + 36;
  const ph = h - CARD_HEADER_H - 36 - 30;

  const xs = series.points.map((p) => p.date);
  const xMin = xs[0];
  const xMax = Math.max(xs[xs.length - 1], xMin + 1);
  const values = series.points.flatMap((p) => [p.expected, p.actual]).filter((v): v is number => v != null);
  const step = niceStep(Math.max(...values, series.total) - Math.min(0, ...values));
  const yMin = Math.floor(Math.min(0, ...values) / step) * step;
  const yMax = Math.max(step, Math.ceil(Math.max(...values, series.total) / step) * step);
  const sx = (d: number) => px + ((d - xMin) / (xMax - xMin)) * pw;
  const sy = (v: number) => py + ph - ((v - yMin) / (yMax - yMin)) * ph;

  // Grid + y labels (hairline, recessive).
  doc.setFontSize(6.8);
  doc.setFont("helvetica", "normal");
  for (let v = yMin; v <= yMax + step / 1000; v += step) {
    const gy = sy(v);
    doc.setDrawColor(...(v === 0 && yMin < 0 ? GREY : BORDER));
    doc.setLineWidth(0.5);
    doc.line(px, gy, px + pw, gy);
    doc.setTextColor(...MUTED);
    const label = series.unit === "hours" ? `${Math.round(v)}h` : String(Math.round(v * 10) / 10);
    doc.text(label, px - 4, gy + 2.3, { align: "right" });
  }

  // X labels: start and last day; today marker.
  doc.setTextColor(...MUTED);
  doc.text(shortDateFmt.format(xMin), px, py + ph + 10);
  doc.text(shortDateFmt.format(xs[xs.length - 1]), px + pw, py + ph + 10, { align: "right" });
  if (series.today != null) {
    const tx = sx(series.today);
    doc.setDrawColor(...GREY);
    doc.setLineWidth(0.5);
    doc.line(tx, py, tx, py + ph);
    doc.text("Today", tx, py - 3, { align: "center" });
  }

  // Expected: straight dashed line start → end, flat at 0 afterwards.
  doc.setLineCap("round");
  doc.setDrawColor(...MUTED);
  doc.setLineWidth(1.1);
  doc.setLineDashPattern([3.5, 2.5], 0);
  const endX = sx(series.endDate ?? xMax);
  doc.line(sx(xMin), sy(series.total), endX, sy(0));
  if (endX < px + pw - 0.5) doc.line(endX, sy(0), px + pw, sy(0));
  doc.setLineDashPattern([], 0);

  // Actual: solid line through the sampled points up to today.
  const actual = series.points.filter((p) => p.actual != null) as Array<{ date: number; actual: number }>;
  doc.setDrawColor(...BLUE);
  doc.setLineWidth(1.6);
  doc.setLineJoin("round");
  for (let i = 1; i < actual.length; i++) {
    doc.line(sx(actual[i - 1].date), sy(actual[i - 1].actual), sx(actual[i].date), sy(actual[i].actual));
  }
  const last = actual[actual.length - 1];
  if (last) {
    const lx = sx(last.date);
    const ly = sy(last.actual);
    doc.setFillColor(...BLUE);
    doc.circle(lx, ly, 2.4, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...INK);
    doc.text(formatBurndownValue(series, last.actual), lx + 4, ly - 3);
  }
  doc.setLineWidth(0.6);

  // Legend (bottom).
  const lgY = y + h - 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...MUTED);
  doc.setDrawColor(...BLUE);
  doc.setLineWidth(1.6);
  doc.line(x + 10, lgY - 2.5, x + 22, lgY - 2.5);
  doc.text("Actual", x + 26, lgY);
  doc.setDrawColor(...MUTED);
  doc.setLineWidth(1.1);
  doc.setLineDashPattern([3.5, 2.5], 0);
  doc.line(x + 60, lgY - 2.5, x + 72, lgY - 2.5);
  doc.setLineDashPattern([], 0);
  doc.text("Expected", x + 76, lgY);
  doc.setLineWidth(0.6);
}

// ---------------------------------------------------------------------------
// Executive one-page cover
// ---------------------------------------------------------------------------

/** Schedule slippage between a planned and an actual date, in plain English. */
function scheduleVariance(planned: Date | null, actual: Date | null): string {
  if (!planned || !actual) return "—";
  const diff = daysBetween(planned, actual);
  if (diff === 0) return "On time";
  return diff > 0 ? `${diff}d late` : `${Math.abs(diff)}d early`;
}

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
      ["Project Name", c.projectName || "—"],
      ["Code", c.projectCode || "—"],
      ["Project Manager", c.manager || "—"],
      ["Department", c.department || "—"],
      ["Communication", c.communication || "—"],
      ["Timorc Code(s)", s.project.timorcCodes.map((t) => t.code).join(", ") || "—"],
      ["Health", `${s.health.score} (${s.health.rag})`],
      ["Source File", s.project.meta.sourceFileName || "—"],
    ];
    const rowH2 = 13.5;
    let ry = cy + 4;
    const labelX = leftX + 10;
    const valueX = leftX + 100;
    const valueW = cardW - 100 - 12;
    doc.setFontSize(8.4);
    rows.forEach(([label, value], i) => {
      if (i % 2 === 1) {
        doc.setFillColor(...[245, 247, 249] as RGB);
        doc.rect(leftX + 1, ry - 1, cardW - 2, rowH2, "F");
      }
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...MUTED);
      doc.text(label, labelX, ry + 9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...INK);
      const v = doc.splitTextToSize(value, valueW);
      doc.text(v[0] ?? "—", valueX, ry + 9);
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

  // ---- Card 6 & 7: Burndown (work | hours budget) ---------------------------
  const row4Y = row3Y + row3H + 12;
  const row4H = 186;
  drawBurndownCard(doc, leftX, row4Y, cardW, row4H, "Burndown — Work", s.burndown.work);
  drawBurndownCard(doc, rightX, row4Y, cardW, row4H, "Burndown — Hours Budget", s.burndown.budget);

  // ---- Flowing lower section: Schedule, Charter, Task & Issue status --------
  const pageHeight = doc.internal.pageSize.getHeight();
  const tableStyles = {
    fontSize: 8.5,
    cellPadding: { top: 4, bottom: 4, left: 6, right: 6 },
    overflow: "linebreak" as const,
    valign: "middle" as const,
    lineColor: BORDER,
    lineWidth: 0.5,
  };
  const finalY = () =>
    (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  // Section heading, guarding against an orphaned title at the page bottom.
  const sectionHeading = (title: string, y: number): number => {
    let ny = y;
    if (ny > pageHeight - 96) {
      doc.addPage();
      ny = 56;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...NAVY);
    doc.text(title, margin, ny);
    return ny;
  };

  let flowY = row4Y + row4H + 24;

  // ---- Schedule (planned vs actual, with variance) -------------------------
  flowY = sectionHeading("Schedule", flowY);
  autoTable(doc, {
    startY: flowY + 8,
    head: [["Milestone", "Planned", "Actual", "Variance"]],
    body: [
      ["Start", formatDate(c.plannedStartDate), formatDate(c.startDate), scheduleVariance(c.plannedStartDate, c.startDate)],
      ["End", formatDate(c.plannedEndDate), formatDate(c.endDate), scheduleVariance(c.plannedEndDate, c.endDate)],
    ],
    tableWidth: usableWidth,
    styles: tableStyles,
    headStyles: { fillColor: NAVY, textColor: 255, fontStyle: "bold", fontSize: 8.5 },
    alternateRowStyles: { fillColor: [246, 247, 249] },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 120 } },
    margin: { left: margin, right: margin },
  });
  flowY = finalY() + 26;

  // ---- Charter (narrative sections) ----------------------------------------
  if (c.sections.length > 0) {
    flowY = sectionHeading("Charter", flowY);
    autoTable(doc, {
      startY: flowY + 8,
      head: [["Section", "Content"]],
      body: c.sections.map((sec) => [sec.title, sec.body]),
      tableWidth: usableWidth,
      styles: tableStyles,
      headStyles: { fillColor: NAVY, textColor: 255, fontStyle: "bold", fontSize: 8.5 },
      alternateRowStyles: { fillColor: [246, 247, 249] },
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 120 } },
      margin: { left: margin, right: margin },
    });
    flowY = finalY() + 26;
  }

  // ---- Risks, Issues & PM Recommendation (manual inputs) -------------------
  const pmNotes: Array<[string, string]> = [];
  if (c.risksIssues.trim()) pmNotes.push(["Risks & Issues", c.risksIssues.trim()]);
  if (c.pmRecommendation.trim()) pmNotes.push(["PM Decision / Recommendation", c.pmRecommendation.trim()]);
  if (pmNotes.length > 0) {
    flowY = sectionHeading("Risks, Issues & PM Recommendation", flowY);
    autoTable(doc, {
      startY: flowY + 8,
      head: [["Section", "Content"]],
      body: pmNotes,
      tableWidth: usableWidth,
      styles: tableStyles,
      headStyles: { fillColor: NAVY, textColor: 255, fontStyle: "bold", fontSize: 8.5 },
      alternateRowStyles: { fillColor: [246, 247, 249] },
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 120 } },
      margin: { left: margin, right: margin },
    });
    flowY = finalY() + 26;
  }

  // ---- Task & Issue status (Task / Issue, Owner, Status) --------------------
  flowY = sectionHeading("Task & Issue Status", flowY);
  const body: RowInput[] = s.project.tasks.map((t) => {
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
    return [t.title, t.assignee || "—", statusCell];
  });

  autoTable(doc, {
    startY: flowY + 8,
    head: [["Task / Issue", "Owner", "Status"]],
    body:
      body.length > 0
        ? body
        : [[{ content: "No tasks on the board.", colSpan: 3, styles: { halign: "center", textColor: MUTED } }]],
    tableWidth: usableWidth,
    styles: tableStyles,
    headStyles: { fillColor: NAVY, textColor: 255, fontStyle: "bold", fontSize: 8.5 },
    alternateRowStyles: { fillColor: [246, 247, 249] },
    columnStyles: {
      1: { cellWidth: 110 },
      2: { cellWidth: 80, halign: "center" },
    },
    margin: { left: margin, right: margin },
  });
}

// ---------------------------------------------------------------------------
// Detailed tables (the full report body)
// ---------------------------------------------------------------------------

/** Report tables left out of the PDF (see drawDetailTables). */
const PDF_SKIPPED_TABLES = new Set(["Tasks", "Project Details", "Charter", "EVM"]);

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
    // Skip tables already shown on the executive cover to avoid duplication:
    // "Project Details" (Project Snapshot card + Schedule), "Charter" (Charter
    // section) and "Tasks" (colour-coded "Task & Issue Status" table). EVM is
    // not part of the PDF. All of them are still emitted in the Excel export.
    if (PDF_SKIPPED_TABLES.has(table.title)) continue;
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

  const fileName = s.project.charter.projectName || report.title;
  doc.save(`${fileName.replace(/\s+/g, "-")}.pdf`);
}
