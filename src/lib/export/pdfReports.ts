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
  // Portrait so the many key/value tables stay dense; every table fills the
  // same margin box, so they are all the same width and stack left-aligned.
  const doc = new jsPDF({ orientation: "portrait", unit: "pt" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const usableWidth = pageWidth - margin * 2;

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
    // 2-column key/value tables get a fixed bold label column so labels line up;
    // wider tables (e.g. Tasks) let autoTable size columns to their content.
    const columnStyles: Record<string, Partial<{ cellWidth: number; fontStyle: "bold" }>> =
      table.headers.length <= 2 ? { 0: { cellWidth: 150, fontStyle: "bold" } } : {};
    autoTable(doc, {
      startY: cursorY + 12,
      head: [table.headers],
      body: table.rows.map((r) => r.map((c) => String(c))),
      // Fixed full width for EVERY table → identical size, left-aligned, stacked.
      tableWidth: usableWidth,
      styles: {
        fontSize: 9.5,
        cellPadding: { top: 4, bottom: 4, left: 6, right: 6 },
        overflow: "linebreak",
        valign: "middle",
        lineColor: [222, 226, 230],
        lineWidth: 0.5,
      },
      headStyles: { fillColor: BRAND, textColor: 255, fontStyle: "bold", fontSize: 9.5 },
      alternateRowStyles: { fillColor: [245, 246, 248] },
      columnStyles,
      margin: { left: margin, right: margin },
    });
    cursorY =
      (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
        .finalY + 26;
    if (cursorY > pageHeight - 90) {
      doc.addPage();
      cursorY = 56;
    }
  }

  // Page footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin - 50, pageHeight - 24);
  }

  doc.save(`${report.title.replace(/\s+/g, "-")}.pdf`);
}
