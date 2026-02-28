import type { OxlintDiagnostic, OxlintLabel, OxlintReport, OxlintSeverity } from './types/oxlint.js';

/**
 * Parses a raw label object into a typed OxlintLabel.
 */
function parseLabel(l: Record<string, unknown>): OxlintLabel {
  const parsedLabel: OxlintLabel = {
    span: {
      offset: Number(l.span?.offset ?? 0),
      length: Number(l.span?.length ?? 0),
      line: Number(l.span?.line ?? 1),
      column: Number(l.span?.column ?? 1),
    },
  };
  if (typeof l.label === 'string') {
    parsedLabel.label = l.label;
  }
  return parsedLabel;
}

/**
 * Filters and parses a raw labels array into typed OxlintLabel[].
 */
function parseLabels(raw: unknown): OxlintLabel[] | undefined {
  if (!Array.isArray(raw)) {
    return undefined;
  }
  return raw
    .filter((l): l is Record<string, unknown> => l !== null && l !== undefined && typeof l === 'object')
    .map(parseLabel);
}

/**
 * Type guard to check if parsed JSON is a valid OxlintReport structure
 */
function isOxlintReport(value: unknown): value is OxlintReport {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const diagnostics = Reflect.get(value, 'diagnostics');
  return Array.isArray(diagnostics);
}

/**
 * Type guard to check if a value is a valid OxlintDiagnostic
 */
function isOxlintDiagnostic(value: unknown): value is OxlintDiagnostic {
  return Boolean(
    value &&
    typeof value === 'object' &&
    'message' in value &&
    'code' in value &&
    'severity' in value &&
    'filename' in value,
  );
}

/**
 * Normalizes a severity string to a valid OxlintSeverity.
 */
function normalizeOxlintSeverity(severity: string): OxlintSeverity {
  switch (severity.toLowerCase()) {
    case 'error':
      return 'error';
    case 'warning':
    case 'warn':
      return 'warning';
    default:
      return 'warning';
  }
}

/**
 * Parses an oxlint JSON string into a structured OxlintReport.
 *
 * @param jsonContent - The raw JSON content from oxlint's `--format json` output
 * @returns A structured OxlintReport object
 * @throws {Error} If the JSON is malformed or does not match the expected oxlint format
 */
export function parseOxlintJson(jsonContent: string): OxlintReport {
  const trimmedContent = jsonContent.trim();
  if (trimmedContent === '') {
    throw new Error('Input JSON content is empty');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonContent);
  } catch (err) {
    const message = String(err);
    throw new Error(`Failed to parse JSON: ${message}`, { cause: err });
  }

  if (!isOxlintReport(parsed)) {
    throw new Error('Invalid oxlint JSON: missing "diagnostics" array');
  }

  const diagnostics: OxlintDiagnostic[] = parsed.diagnostics
    .filter((d): d is OxlintDiagnostic => isOxlintDiagnostic(d))
    .map((d) => ({
      message: String(d.message ?? ''),
      code: String(d.code ?? ''),
      severity: normalizeOxlintSeverity(String(d.severity ?? 'warning')),
      causes: Array.isArray(d.causes) ? d.causes.map(String) : [],
      url: d.url === undefined ? undefined : String(d.url),
      help: d.help === undefined ? undefined : String(d.help),
      filename: String(d.filename ?? ''),
      labels: parseLabels(d.labels) ?? [],
      related: Array.isArray(d.related)
        ? d.related
            .filter((r): r is NonNullable<typeof r> => r !== null && r !== undefined && typeof r === 'object')
            .map((r) => ({
              message: r.message === undefined ? undefined : String(r.message),
              labels: parseLabels(r.labels),
            }))
        : [],
    }));

  return {
    diagnostics,
    number_of_files: Number(parsed.number_of_files ?? 0),
    number_of_rules:
      parsed.number_of_rules === null || parsed.number_of_rules === undefined ? null : Number(parsed.number_of_rules),
    threads_count: Number(parsed.threads_count ?? 1),
    start_time: Number(parsed.start_time ?? 0),
  };
}
