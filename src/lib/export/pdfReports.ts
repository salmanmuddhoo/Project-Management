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

  doc.setFontSize(18);
  doc.setTextColor(...BRAND);
  doc.text(report.title, 40, 48);
  doc.setFontSize(10);
  doc.setTextColor(110);
  doc.text(
    `Generated ${new Date().toLocaleString()} — Portfolio PPM (in-browser, no data stored)`,
    40,
    66,
  );

  let cursorY = 90;
  for (const table of report.build(snapshots)) {
    doc.setFontSize(13);
    doc.setTextColor(20);
    doc.text(table.title, 40, cursorY);
    autoTable(doc, {
      startY: cursorY + 10,
      head: [table.headers],
      body: table.rows.map((r) => r.map((c) => String(c))),
      styles: { fontSize: 8, cellPadding: 4, overflow: "linebreak" },
      headStyles: { fillColor: BRAND, textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 246, 248] },
      margin: { left: 40, right: 40 },
    });
    cursorY =
      (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
        .finalY + 36;
    if (cursorY > doc.internal.pageSize.getHeight() - 120) {
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
