/** Timorc time-tracking entries (global pool, matched to projects by code). */

export interface TimeEntry {
  /** Full "Projet" value, e.g. "MAURITIUS9 - PILOTAGE INFOMIL MAURITIUS". */
  projet: string;
  /** Segment before " - " (e.g. "MAURITIUS9"). */
  projectPrefix: string;
  person: string; // Intervenant
  /** "Code tâche", e.g. "MAURITIUS9 - 100.004". */
  code: string;
  task: string; // Tâche
  subTask: string; // Sous-tâche
  date: Date | null; // Jour
  /** Temps passé, in man-days (0.25 = ¼ day). */
  days: number;
  comment: string;
  sourceFile: string;
}

export interface TimeImport {
  fileName: string;
  entries: TimeEntry[];
  /** Rows skipped (cumulative summary rows, blank rows). */
  skipped: number;
}
