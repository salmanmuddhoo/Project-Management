/** Validation engine result types. */

export type ValidationSeverity = "error" | "warning";

export interface ValidationIssue {
  severity: ValidationSeverity;
  /** Sheet the issue belongs to ("Workbook" for structural issues). */
  sheet: string;
  /** 1-based Excel row, when the issue points at a specific row. */
  row?: number;
  column?: string;
  message: string;
}

export interface ValidationReport {
  fileName: string;
  issues: ValidationIssue[];
  errorCount: number;
  warningCount: number;
  /** Import is allowed only when no errors exist. */
  valid: boolean;
}
