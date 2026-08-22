import type { OxlintDiagnostic, OxlintLabel, OxlintReport, OxlintSeverity } from './types/oxlint.js';

interface RawSpan {
  offset?: number | null;
  length?: number | null;
  line?: number | null;
  column?: number | null;
}

interface RawLabel {
  label?: string | null;
  span?: RawSpan | null;
}

interface RawRelated {
  message?: string | null;
  labels?: (RawLabel | null)[] | null;
}

interface RawDiagnostic {
  message?: string | null;
  code?: string | null;
  severity?: string | null;
  causes?: string[] | null;
  url?: string | null;
  help?: string | null;
  filename?: string | null;
  labels?: (RawLabel | null)[] | null;
  related?: (RawRelated | null)[] | null;
}

interface RawReport {
  diagnostics: (RawDiagnostic | null)[];
  number_of_files?: number | null;
  number_of_rules?: number | null;
  threads_count?: number | null;
  start_time?: number | null;
}

/**
 * Parses a raw label object into a typed OxlintLabel.
 */
function parseLabel(l: RawLabel): OxlintLabel {
  const span = l.span ?? {};
  const parsedLabel: OxlintLabel = {
    span: {
      offset: span.offset ?? 0,
      length: span.length ?? 0,
      line: span.line ?? 1,
      column: span.column ?? 1,
    },
  };
  if (l.label !== null && l.label !== undefined) {
    parsedLabel.label = l.label;
  }
  return parsedLabel;
}

/**
 * Filters and parses a raw labels array into typed OxlintLabel[].
 */
function parseLabels(labels: (RawLabel | null)[] | null | undefined): OxlintLabel[] | undefined {
  if (!Array.isArray(labels)) {
    return undefined;
  }
  return labels.filter((l) => l !== null && l !== undefined).map(parseLabel);
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

  if (trimmedContent.startsWith('Failed to parse oxlint configuration file')) {
    throw new Error(
      'The input does not appear to be oxlint JSON output. It looks like oxlint encountered a configuration error. ' +
        'Please fix the oxlint configuration and re-run with `--format json`.',
    );
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(jsonContent);
  } catch (err) {
    const message = String(err);
    throw new Error(`Failed to parse JSON: ${message}`, { cause: err });
  }

  if (!(parsedJson instanceof Object) || !('diagnostics' in parsedJson) || !Array.isArray(parsedJson.diagnostics)) {
    throw new Error('Invalid oxlint JSON: missing "diagnostics" array');
  }
  const parsed = parsedJson as RawReport;

  const diagnostics: OxlintDiagnostic[] = parsed.diagnostics
    .filter((d) => d !== null && d !== undefined)
    .map((d) => ({
      message: d.message ?? '',
      code: d.code ?? '',
      severity: normalizeOxlintSeverity(d.severity ?? 'warning'),
      causes: Array.isArray(d.causes) ? d.causes.map(String) : [],
      url: d.url ?? undefined,
      help: d.help ?? undefined,
      filename: d.filename ?? '',
      labels: parseLabels(d.labels) ?? [],
      related: Array.isArray(d.related)
        ? d.related
            .filter((r) => r !== null && r !== undefined)
            .map((r) => ({
              message: r.message ?? undefined,
              labels: parseLabels(r.labels),
            }))
        : [],
    }));

  return {
    diagnostics,
    number_of_files: parsed.number_of_files ?? 0,
    number_of_rules:
      parsed.number_of_rules === null || parsed.number_of_rules === undefined ? null : parsed.number_of_rules,
    threads_count: parsed.threads_count ?? 1,
    start_time: parsed.start_time ?? 0,
  };
}
