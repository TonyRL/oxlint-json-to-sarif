/**
 * Represents the root oxlint JSON output
 */
export interface OxlintReport {
  /** Array of diagnostic results */
  diagnostics: OxlintDiagnostic[];
  /** Number of files linted */
  number_of_files: number;
  /** Number of rules used */
  number_of_rules: number | null;
  /** Number of threads used */
  threads_count: number;
  /** Start time in seconds */
  start_time: number;
}

/**
 * Represents a single diagnostic from oxlint
 */
export interface OxlintDiagnostic {
  /** Human-readable description of the violation */
  message: string;
  /** Rule identifier, e.g. "eslint(no-debugger)" */
  code: string;
  /** Severity of the violation */
  severity: OxlintSeverity;
  /** Array of cause messages */
  causes: string[];
  /** URL to the rule documentation */
  url?: string;
  /** Help text for fixing the violation */
  help?: string;
  /** File path where the diagnostic was found */
  filename: string;
  /** Labels indicating specific spans in the source */
  labels: OxlintLabel[];
  /** Related diagnostic information */
  related: OxlintRelated[];
}

/**
 * Represents a labeled span in the source code
 */
export interface OxlintLabel {
  /** Optional text describing what this label highlights */
  label?: string;
  /** The source span */
  span: OxlintSpan;
}

/**
 * Represents a span location in the source code
 */
export interface OxlintSpan {
  /** Byte offset from the start of the file */
  offset: number;
  /** Length of the span in bytes */
  length: number;
  /** 1-based line number */
  line: number;
  /** 1-based column number */
  column: number;
}

/**
 * Represents related diagnostic information
 */
export interface OxlintRelated {
  /** Related message */
  message?: string;
  /** Labels for the related information */
  labels?: OxlintLabel[];
}

export type OxlintSeverity = 'error' | 'warning';
