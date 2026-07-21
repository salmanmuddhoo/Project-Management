/** Import validation result types. */

export type ValidationSeverity = "error" | "warning";

export interface ValidationIssue {
  severity: ValidationSeverity;
  /** Where the issue is ("Board", "Time file", a sheet name…). */
  scope: string;
  message: string;
}

export interface ValidationReport {
  fileName: string;
  kind: "board" | "time" | "unknown";
  issues: ValidationIssue[];
  errorCount: number;
  warningCount: number;
  valid: boolean;
}
