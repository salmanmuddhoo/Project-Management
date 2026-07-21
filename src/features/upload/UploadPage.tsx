/**
 * Import flow: drop Microsoft Planner board exports (.xlsx) and Timorc time
 * exports (.csv/.xlsx). Everything is parsed and matched in the browser;
 * nothing is uploaded or stored. Board Timorc codes are matched against the
 * time entries to gather hours consumed per project.
 */

import { useCallback, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  FileSpreadsheet,
  FileUp,
  FlaskConical,
  KanbanSquare,
  Trash2,
  XCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HOURS_PER_DAY } from "@/lib/config";
import {
  entriesForProject,
  importFiles,
  type ImportedBoard,
  type ImportedTime,
} from "@/lib/import/importFiles";
import { buildSampleFiles, downloadSampleFile, SAMPLE_BOARDS } from "@/lib/import/sampleData";
import { cn, formatNumber } from "@/lib/utils";
import { usePortfolioStore } from "@/store/portfolioStore";
import type { ValidationReport } from "@/types/validation";

export function UploadPage() {
  const [boards, setBoards] = useState<ImportedBoard[]>([]);
  const [times, setTimes] = useState<ImportedTime[]>([]);
  const [unknown, setUnknown] = useState<ValidationReport[]>([]);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const addProjects = usePortfolioStore((s) => s.addProjects);
  const addTimeEntries = usePortfolioStore((s) => s.addTimeEntries);
  const navigate = useNavigate();

  const process = useCallback(async (files: File[]) => {
    setBusy(true);
    const result = await importFiles(files);
    setBoards((prev) => dedupe([...prev, ...result.boards], (b) => b.project.id + b.report.fileName));
    setTimes((prev) => dedupe([...prev, ...result.times], (t) => t.report.fileName));
    setUnknown((prev) => [...prev, ...result.unknown]);
    setBusy(false);
  }, []);

  const commit = () => {
    const validBoards = boards.filter((b) => b.report.valid);
    const validTimes = times.filter((t) => t.report.valid);
    addProjects(validBoards.map((b) => b.project));
    for (const t of validTimes) addTimeEntries(t.timeImport.fileName, t.timeImport.entries);
    navigate("/");
  };

  const loadSamples = async () => {
    setBusy(true);
    await process(buildSampleFiles());
    setBusy(false);
  };

  // All time entries currently queued, for match previews.
  const queuedEntries = times.flatMap((t) => t.timeImport.entries);
  const validBoardCount = boards.filter((b) => b.report.valid).length;
  const validTimeCount = times.filter((t) => t.report.valid).length;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Import project data</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Drop your <strong>Microsoft Planner</strong> board export(s) and your{" "}
          <strong>Timorc</strong> time export. Time is matched to each project by its Timorc code
          (converted at {HOURS_PER_DAY}h per day). Everything is processed in your browser — nothing
          is uploaded or stored.
        </p>
      </div>

      <div
        role="button"
        tabIndex={0}
        aria-label="Choose or drop files"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); void process([...e.dataTransfer.files]); }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-14 text-center transition-colors",
          dragging ? "border-primary bg-accent" : "hover:border-primary/50 hover:bg-muted/50",
        )}
      >
        <FileUp className="h-9 w-9 text-muted-foreground" />
        <p className="mt-3 text-sm font-medium">Drop Planner (.xlsx) and Timorc (.csv/.xlsx) files here, or click to choose</p>
        <p className="mt-1 text-xs text-muted-foreground">The app detects each file type automatically</p>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xlsm,.csv,.tsv,.txt"
          multiple
          hidden
          onChange={(e) => { void process([...(e.target.files ?? [])]); e.target.value = ""; }}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => void loadSamples()} disabled={busy}>
          <FlaskConical /> Load sample portfolio
        </Button>
        {SAMPLE_BOARDS.map((s, i) => (
          <Button key={s.file} variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => downloadSampleFile(i)}>
            <Download /> {s.file}
          </Button>
        ))}
        <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => downloadSampleFile(SAMPLE_BOARDS.length)}>
          <Download /> Sample-TimeTracking.csv
        </Button>
      </div>

      {(boards.length > 0 || times.length > 0 || unknown.length > 0) && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Ready to import</h2>
            <Button onClick={commit} disabled={validBoardCount === 0 && validTimeCount === 0}>
              Import {validBoardCount} project{validBoardCount === 1 ? "" : "s"}
              {validTimeCount > 0 && ` + ${validTimeCount} time file${validTimeCount === 1 ? "" : "s"}`}
            </Button>
          </div>

          {boards.map((b) => {
            const matched = entriesForProject(b.project, queuedEntries);
            const days = matched.reduce((n, e) => n + e.days, 0);
            return (
              <Card key={b.project.id + b.report.fileName}>
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <CardTitle className="flex items-center gap-2">
                    <KanbanSquare className="h-4 w-4 text-primary" />
                    {b.project.charter.projectName}
                    <Badge variant="muted">Board</Badge>
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="muted">{b.project.tasks.length} tasks</Badge>
                    <Badge variant="muted">{b.project.resources.length} resources</Badge>
                    <Badge variant="outline" className={cn(matched.length > 0 ? "border-green-600/30 bg-green-600/10 text-green-700 dark:text-green-400" : "text-muted-foreground")}>
                      <Clock className="h-3 w-3" /> {Math.round(days * HOURS_PER_DAY)}h matched
                    </Badge>
                    <Button variant="ghost" size="icon" aria-label="Remove" onClick={() => setBoards((q) => q.filter((x) => x !== b))}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                {b.report.issues.length > 0 && <IssueList report={b.report} />}
              </Card>
            );
          })}

          {times.map((t) => (
            <Card key={t.report.fileName}>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-primary" />
                  {t.report.fileName}
                  <Badge variant="muted">Time file</Badge>
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="muted">{formatNumber(t.timeImport.entries.length)} entries</Badge>
                  <Button variant="ghost" size="icon" aria-label="Remove" onClick={() => setTimes((q) => q.filter((x) => x !== t))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              {t.report.issues.length > 0 && <IssueList report={t.report} />}
            </Card>
          ))}

          {unknown.map((u, i) => (
            <Card key={i}>
              <CardHeader className="flex-row items-center gap-2 space-y-0">
                <XCircle className="h-4 w-4 text-red-600" />
                <CardTitle>{u.fileName}</CardTitle>
              </CardHeader>
              <IssueList report={u} />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function IssueList({ report }: { report: ValidationReport }) {
  return (
    <CardContent>
      <ul className="space-y-1 text-xs">
        {report.issues.map((issue, i) => (
          <li key={i} className="flex items-start gap-2">
            {issue.severity === "error" ? (
              <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-600" />
            ) : (
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
            )}
            <span><span className="font-medium">{issue.scope}</span> — {issue.message}</span>
          </li>
        ))}
      </ul>
      {report.valid && report.issues.length > 0 && (
        <p className="mt-2 flex items-center gap-1 text-xs text-green-700 dark:text-green-400">
          <CheckCircle2 className="h-3.5 w-3.5" /> Importable — warnings only.
        </p>
      )}
    </CardContent>
  );
}

function dedupe<T>(items: T[], keyOf: (t: T) => string): T[] {
  const seen = new Map<string, T>();
  for (const item of items) seen.set(keyOf(item), item);
  return [...seen.values()];
}
