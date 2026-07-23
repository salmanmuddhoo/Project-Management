/**
 * Report centre — the standard reports, downloadable as Excel or PDF.
 * Generation is fully client-side (ExcelJS / jsPDF).
 */

import { useState } from "react";
import { FileSpreadsheet, FileText, Info, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";

import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { exportReportToExcel } from "@/lib/export/excelReports";
import { exportReportToPdf } from "@/lib/export/pdfReports";
import { REPORTS } from "@/lib/export/reportDefinitions";
import { useActiveSnapshot } from "@/store/portfolioStore";

export function ReportsPage() {
  const snapshot = useActiveSnapshot();
  const [generating, setGenerating] = useState<string | null>(null);

  if (!snapshot) return <EmptyState />;
  const snapshots = [snapshot];

  const run = async (key: string, format: "excel" | "pdf") => {
    const report = REPORTS.find((r) => r.key === key);
    if (!report) return;
    setGenerating(`${key}-${format}`);
    try {
      if (format === "excel") await exportReportToExcel(report, snapshots);
      else exportReportToPdf(report, snapshots);
    } finally {
      setGenerating(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Report</h1>
          <p className="text-sm text-muted-foreground">
            One combined project report — details and charter, status, time &amp; budget, EVM, tasks,
            resources and governance in a single file. Generated in your browser; nothing leaves it.
          </p>
        </div>
        {/* Discreet link to the internal EVM analysis (not in the sidebar). */}
        <Button
          asChild
          variant="ghost"
          size="icon"
          aria-label="Earned Value Management"
          title="Earned Value Management"
          className="h-7 w-7 shrink-0 text-muted-foreground/60 hover:text-foreground"
        >
          <Link to="/evm"><Info className="h-4 w-4" /></Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {REPORTS.map((report) => (
          <Card key={report.key} className="flex flex-col">
            <CardHeader>
              <CardTitle>{report.title}</CardTitle>
              <CardDescription>{report.description}</CardDescription>
            </CardHeader>
            <CardContent className="mt-auto flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={generating !== null || snapshots.length === 0}
                onClick={() => void run(report.key, "excel")}
              >
                {generating === `${report.key}-excel` ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <FileSpreadsheet />
                )}
                Excel
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={generating !== null || snapshots.length === 0}
                onClick={() => void run(report.key, "pdf")}
              >
                {generating === `${report.key}-pdf` ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <FileText />
                )}
                PDF
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
