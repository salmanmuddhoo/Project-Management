/**
 * Import orchestration: classify each dropped file as a Planner board or a
 * Timorc time export, parse it, and expose the time↔project matching used to
 * gather time spent per project.
 */

import * as XLSX from "xlsx";

import type { Project, TimorcCode } from "@/types/project";
import type { TimeEntry, TimeImport } from "@/types/time";
import type { ValidationReport } from "@/types/validation";
import { looksLikePlannerBoard, parsePlannerBoard } from "./parsePlanner";
import { looksLikeTimeGrid, parseTimeFile } from "./parseTime";

export interface ImportedBoard {
  project: Project;
  report: ValidationReport;
}
export interface ImportedTime {
  timeImport: TimeImport;
  report: ValidationReport;
}

export interface ImportResult {
  boards: ImportedBoard[];
  times: ImportedTime[];
  unknown: ValidationReport[];
}

const norm = (v: string) => v.trim().toLowerCase().replace(/\s+/g, " ");

/** Read one file and route it to the right parser. */
export async function importFile(file: File): Promise<
  | { type: "board"; board: ImportedBoard }
  | { type: "time"; time: ImportedTime }
  | { type: "unknown"; report: ValidationReport }
> {
  const buffer = await file.arrayBuffer();
  const isCsv = /\.(csv|tsv|txt)$/i.test(file.name);

  if (isCsv) {
    return { type: "time", time: parseTimeFile(file.name, buffer) };
  }

  // .xlsx could be either a Planner board or a time export.
  try {
    const wb = XLSX.read(buffer, { type: "array", cellDates: true });
    if (looksLikePlannerBoard(wb)) {
      return { type: "board", board: parsePlannerBoard(file.name, buffer) };
    }
    const grid = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], {
      header: 1,
      defval: null,
      blankrows: false,
    });
    if (looksLikeTimeGrid(grid)) {
      return { type: "time", time: parseTimeFile(file.name, buffer) };
    }
  } catch {
    /* fall through to unknown */
  }

  return {
    type: "unknown",
    report: {
      fileName: file.name,
      kind: "unknown",
      issues: [
        {
          severity: "error",
          scope: "File",
          message:
            "Unrecognised file — expected a Microsoft Planner board export or a Timorc time export.",
        },
      ],
      errorCount: 1,
      warningCount: 0,
      valid: false,
    },
  };
}

export async function importFiles(files: File[]): Promise<ImportResult> {
  const result: ImportResult = { boards: [], times: [], unknown: [] };
  for (const file of files) {
    const parsed = await importFile(file);
    if (parsed.type === "board") result.boards.push(parsed.board);
    else if (parsed.type === "time") result.times.push(parsed.time);
    else result.unknown.push(parsed.report);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Time ↔ project matching
// ---------------------------------------------------------------------------

/**
 * A time entry belongs to a project when its Code tâche starts with one of the
 * project's Timorc codes (exact task or a finer sub-code), or — when a code is
 * given as a bare project prefix — when its Projet prefix matches.
 */
export function entryMatchesCodes(entry: TimeEntry, codes: TimorcCode[]): boolean {
  const entryCode = norm(entry.code);
  const entryPrefix = norm(entry.projectPrefix);
  return codes.some((c) => {
    const code = norm(c.code);
    if (!code) return false;
    const hasSub = /\s*-\s*/.test(c.code);
    if (hasSub) return entryCode.startsWith(code) || entryCode === code;
    // bare prefix → match the whole Timorc project
    return entryPrefix === code || entryCode.startsWith(code);
  });
}

export function entriesForProject(
  project: Project,
  entries: TimeEntry[],
): TimeEntry[] {
  if (project.timorcCodes.length === 0) return [];
  return entries.filter((e) => entryMatchesCodes(e, project.timorcCodes));
}
