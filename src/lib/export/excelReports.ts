/** Excel report renderer (ExcelJS) — one worksheet per report table. */

import ExcelJS from "exceljs";

import type { ProjectSnapshot } from "@/lib/metrics/portfolioMetrics";
import { downloadWorkbook } from "@/lib/excel/template";
import type { ReportDefinition } from "./reportDefinitions";

const TITLE_FONT: Partial<ExcelJS.Font> = { bold: true, size: 14 };
const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF1F3A5F" },
};

export async function exportReportToExcel(
  report: ReportDefinition,
  snapshots: ProjectSnapshot[],
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Portfolio PPM";
  wb.created = new Date();

  for (const table of report.build(snapshots)) {
    // Worksheet names: ≤31 chars, no []:*?/\ characters.
    const name = table.title.replace(/[[\]:*?/\\]/g, " ").slice(0, 31);
    const ws = wb.addWorksheet(name);

    const titleRow = ws.addRow([table.title]);
    titleRow.font = TITLE_FONT;
    ws.addRow([`Generated ${new Date().toLocaleString()} — Portfolio PPM`]);
    ws.addRow([]);

    const headerRow = ws.addRow(table.headers);
    headerRow.eachCell((cell) => {
      cell.fill = HEADER_FILL;
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    });
    for (const row of table.rows) ws.addRow(row);

    ws.columns.forEach((col, i) => {
      const headerLen = table.headers[i]?.length ?? 10;
      const maxData = table.rows.reduce(
        (max, r) => Math.max(max, String(r[i] ?? "").length),
        0,
      );
      col.width = Math.max(12, Math.min(60, Math.max(headerLen, maxData) + 2));
    });
    ws.views = [{ state: "frozen", ySplit: 4 }];
  }

  await downloadWorkbook(wb, `${report.title.replace(/\s+/g, "-")}.xlsx`);
}
