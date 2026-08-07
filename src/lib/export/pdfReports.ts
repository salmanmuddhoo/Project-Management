/** PDF report renderer (jsPDF + autotable) — fully client-side. */

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import type { ProjectSnapshot } from "@/lib/metrics/portfolioMetrics";
import type { ReportDefinition } from "./reportDefinitions";

const BRAND: [number, number, number] = [31, 58, 95];

export function exportReportToPdf(
  report: ReportDefinition,
  snapshots: ProjectSnapshot[],
): void {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;
  const usableWidth = pageWidth - margin * 2;
  // Cap each table's width by its column count so short key/value tables stop
  // stretching across the whole page (which left large empty value columns).
  const COL_BUDGET = 190;

  doc.setFontSize(20);
  doc.setTextColor(...BRAND);
  doc.text(report.title, margin, 50);
  doc.setFontSize(11);
  doc.setTextColor(110);
  doc.text(
    `Generated ${new Date().toLocaleString()} — Portfolio PPM (in-browser, no data stored)`,
    margin,
    68,
  );

  let cursorY = 94;
  for (const table of report.build(snapshots)) {
    doc.setFontSize(14);
    doc.setTextColor(20);
    doc.text(table.title, margin, cursorY);
    // Key/value tables (2 cols) get a compact bold label column; wider tables
    // keep the label column readable but flexible.
    const labelCol: Record<string, Partial<{ cellWidth: number; fontStyle: "bold" }>> =
      table.headers.length <= 2 ? { 0: { cellWidth: 150, fontStyle: "bold" } } : {};
    autoTable(doc, {
      startY: cursorY + 12,
      head: [table.headers],
      body: table.rows.map((r) => r.map((c) => String(c))),
      styles: { fontSize: 10, cellPadding: { top: 3.5, bottom: 3.5, left: 6, right: 6 }, overflow: "linebreak", valign: "middle" },
      headStyles: { fillColor: BRAND, textColor: 255, fontStyle: "bold", fontSize: 10 },
      alternateRowStyles: { fillColor: [245, 246, 248] },
      columnStyles: labelCol,
      tableWidth: Math.min(usableWidth, table.headers.length * COL_BUDGET),
      margin: { left: margin, right: margin },
    });
    cursorY =
      (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
        .finalY + 32;
    if (cursorY > doc.internal.pageSize.getHeight() - 110) {
      doc.addPage();
      cursorY = 60;
    }
  }

  // Page footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `Page ${i} of ${pageCount}`,
      pageWidth - 90,
      doc.internal.pageSize.getHeight() - 24,
    );
  }

  doc.save(`${report.title.replace(/\s+/g, "-")}.pdf`);
}
