/**
 * Import flow: drop/choose .xlsx workbooks → parse & validate in the browser
 * → review the validation report → import error-free workbooks into the
 * in-memory portfolio. Also hosts the template & sample downloads.
 */

import { useCallback, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileUp,
  FlaskConical,
  Trash2,
  XCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  buildProject,
  emptyTables,
  readWorkbook,
  type RawWorkbook,
} from "@/lib/excel/parseWorkbook";
import { downloadBlankTemplate } from "@/lib/excel/template";
import {
  buildSampleFiles,
  downloadSampleWorkbook,
  SAMPLE_PROJECTS,
} from "@/lib/excel/sampleData";
import { validateWorkbook } from "@/lib/validation/validateWorkbook";
import { cn } from "@/lib/utils";
import { usePortfolioStore } from "@/store/portfolioStore";
import type { ValidationReport } from "@/types/validation";

interface QueuedFile {
  raw: RawWorkbook;
  report: ValidationReport;
}

export function UploadPage() {
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const addProjects = usePortfolioStore((s) => s.addProjects);
  const navigate = useNavigate();

  const processFiles = useCallback(async (files: File[]) => {
    setBusy(true);
    const next: QueuedFile[] = [];
    for (const file of files) {
      if (!/\.(xlsx|xlsm)$/i.test(file.name)) continue;
      try {
        const raw = await readWorkbook(file);
        next.push({ raw, report: validateWorkbook(raw) });
      } catch (err) {
        next.push({
          raw: {
            fileName: file.name,
            presentSheets: [],
            charter: {},
            scope: {},
            tables: emptyTables(),
            coercionIssues: [],
          },
          report: {
            fileName: file.name,
            issues: [
              {
                severity: "error",
                sheet: "Workbook",
                message: `File could not be read as an Excel workbook (${err instanceof Error ? err.message : "unknown error"}).`,
              },
            ],
            errorCount: 1,
            warningCount: 0,
            valid: false,
          },
        });
      }
    }
    setQueue((q) => [
      ...q.filter((f) => !next.some((n) => n.raw.fileName === f.raw.fileName)),
      ...next,
    ]);
    setBusy(false);
  }, []);

  const importValid = () => {
    const valid = queue.filter((f) => f.report.valid);
    addProjects(
      valid.map((f) => buildProject(f.raw, f.report.warningCount)),
    );
    setQueue((q) => q.filter((f) => !f.report.valid));
    navigate("/");
  };

  const loadSamples = async () => {
    setBusy(true);
    await processFiles(await buildSampleFiles());
    setBusy(false);
  };

  const validCount = queue.filter((f) => f.report.valid).length;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Import project workbooks</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Workbooks are parsed and validated entirely in your browser. Nothing
          is uploaded to a server and nothing is stored — closing or
          refreshing the tab clears the session.
        </p>
      </div>

      {/* Dropzone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Choose or drop Excel workbooks"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void processFiles([...e.dataTransfer.files]);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-14 text-center transition-colors",
          dragging
            ? "border-primary bg-accent"
            : "hover:border-primary/50 hover:bg-muted/50",
        )}
      >
        <FileUp className="h-9 w-9 text-muted-foreground" />
        <p className="mt-3 text-sm font-medium">
          Drop .xlsx workbooks here, or click to choose
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Multiple files supported — one workbook per project
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xlsm"
          multiple
          hidden
          onChange={(e) => {
            void processFiles([...(e.target.files ?? [])]);
            e.target.value = "";
          }}
        />
      </div>

      {/* Template & samples */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => void downloadBlankTemplate()}>
          <Download /> Download blank template
        </Button>
        <Button variant="outline" size="sm" onClick={() => void loadSamples()} disabled={busy}>
          <FlaskConical /> Load sample portfolio (3 projects)
        </Button>
        {SAMPLE_PROJECTS.map((s, i) => (
          <Button
            key={s.file}
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground"
            onClick={() => void downloadSampleWorkbook(i)}
          >
            <FileSpreadsheet /> {s.file}
          </Button>
        ))}
      </div>

      {/* Validation reports */}
      {queue.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">
              Validation report — {queue.length} file(s)
            </h2>
            <Button onClick={importValid} disabled={validCount === 0}>
              Import {validCount} valid workbook{validCount === 1 ? "" : "s"}
            </Button>
          </div>

          {queue.map((f) => (
            <Card key={f.raw.fileName}>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="flex items-center gap-2">
                  {f.report.valid ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600" />
                  )}
                  {f.raw.fileName}
                </CardTitle>
                <div className="flex items-center gap-2">
                  {f.report.errorCount > 0 && (
                    <Badge variant="outline" className="border-red-600/30 bg-red-600/10 text-red-700 dark:text-red-400">
                      {f.report.errorCount} error(s)
                    </Badge>
                  )}
                  {f.report.warningCount > 0 && (
                    <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400">
                      {f.report.warningCount} warning(s)
                    </Badge>
                  )}
                  {f.report.issues.length === 0 && (
                    <Badge variant="outline" className="border-green-600/30 bg-green-600/10 text-green-700 dark:text-green-400">
                      Clean
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${f.raw.fileName}`}
                    onClick={() =>
                      setQueue((q) => q.filter((x) => x.raw.fileName !== f.raw.fileName))
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              {f.report.issues.length > 0 && (
                <CardContent>
                  <ul className="max-h-56 space-y-1 overflow-y-auto text-xs">
                    {f.report.issues.map((issue, i) => (
                      <li key={i} className="flex items-start gap-2">
                        {issue.severity === "error" ? (
                          <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-600" />
                        ) : (
                          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                        )}
                        <span>
                          <span className="font-medium">{issue.sheet}</span>
                          {issue.row != null && ` · row ${issue.row}`}
                          {issue.column && ` · ${issue.column}`}
                          {" — "}
                          {issue.message}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {!f.report.valid && (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Fix the errors in the workbook and drop it again —
                      workbooks with errors cannot be imported.
                    </p>
                  )}
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
