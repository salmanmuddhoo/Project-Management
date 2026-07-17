/**
 * Report centre — the ten standard reports, downloadable as Excel or PDF.
 * Reports respect the active portfolio filters; generation is fully
 * client-side (ExcelJS / jsPDF).
 */

import { useState } from "react";
import { FileSpreadsheet, FileText, Loader2 } from "lucide-react";

import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FilterBar } from "@/features/dashboard/FilterBar";
import { exportReportToExcel } from "@/lib/export/excelReports";
import { exportReportToPdf } from "@/lib/export/pdfReports";
import { REPORTS } from "@/lib/export/reportDefinitions";
import {
  useFilteredSnapshots,
  usePortfolioStore,
} from "@/store/portfolioStore";

export function ReportsPage() {
  const snapshots = useFilteredSnapshots();
  const hasProjects = usePortfolioStore((s) => s.projects.length > 0);
  const [generating, setGenerating] = useState<string | null>(null);

  if (!hasProjects) return <EmptyState />;

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
      <div>
        <h1 className="text-xl font-semibold">Reports</h1>
        <p className="text-sm text-muted-foreground">
          Generated on demand from the {snapshots.length} project(s) currently
          in scope. Files download directly — nothing leaves the browser.
        </p>
      </div>

      <FilterBar />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
