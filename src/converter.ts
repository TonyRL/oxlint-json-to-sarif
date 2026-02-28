import { SarifBuilder, SarifRunBuilder, SarifRuleBuilder, SarifResultBuilder } from 'node-sarif-builder';
import type { Log, Location, Region } from 'sarif';

import type { OxlintDiagnostic, OxlintLabel, OxlintReport } from './types/oxlint.js';

const SARIF_SCHEMA = 'https://docs.oasis-open.org/sarif/sarif/v2.1.0/cos02/schemas/sarif-schema-2.1.0.json';

/**
 * Maps an oxlint severity string to a SARIF result level.
 */
function mapSeverityToLevel(severity: OxlintDiagnostic['severity']): 'error' | 'warning' {
  switch (severity) {
    case 'error':
      return 'error';
    case 'warning':
      return 'warning';
  }
}

/**
 * Converts a file path to a URI suitable for use in SARIF artifactLocation.
 * Converts backslashes to forward slashes. Absolute paths get a file:// scheme.
 */
function pathToUri(filePath: string): string {
  const normalized = filePath.replaceAll('\\', '/');
  if (/^[a-zA-Z]:\//.test(normalized)) {
    // Windows absolute path
    return `file:///${normalized}`;
  }
  if (normalized.startsWith('/')) {
    // Unix absolute path
    return `file://${normalized}`;
  }
  // Relative path — leave as-is so SARIF consumers can resolve via uriBaseId
  return normalized;
}

/**
 * Builds a SARIF Region from an oxlint span.
 */
function buildRegion(span: OxlintLabel['span']): Region {
  const region: Region = { startLine: span.line };
  if (span.column > 0) {
    region.startColumn = span.column;
  }
  if (span.length > 0) {
    region.endColumn = span.column + span.length;
  }
  return region;
}

/**
 * Builds a SARIF Location object from an oxlint label for use in relatedLocations.
 */
function buildRelatedLocation(label: OxlintLabel, filename: string, id: number): Location {
  const loc: Location = {
    id,
    physicalLocation: {
      artifactLocation: { uri: pathToUri(filename) },
      region: buildRegion(label.span),
    },
  };
  if (label.label) {
    loc.message = { text: label.label };
  }
  return loc;
}

/**
 * Converts an OxlintReport to a SARIF log.
 *
 * @param report - The parsed oxlint report
 * @param toolVersion - Optional version string for the tool driver
 * @returns A structured SARIF log object
 */
export function convertToSarif(report: OxlintReport, toolVersion?: string): Log {
  const sarifBuilder = new SarifBuilder({ $schema: SARIF_SCHEMA });

  const sarifRunBuilder = new SarifRunBuilder();
  sarifRunBuilder.setToolDriverName('oxlint');
  if (toolVersion) {
    sarifRunBuilder.setToolDriverVersion(toolVersion);
  }
  sarifRunBuilder.setToolDriverUri('https://oxc.rs/docs/guide/usage/linter');
  sarifRunBuilder.run.columnKind = 'utf16CodeUnits';

  // Collect unique rules from all diagnostics
  const ruleIndexMap = new Map<string, number>();

  for (const diagnostic of report.diagnostics) {
    const ruleId = diagnostic.code || 'UnknownRule';
    const level = mapSeverityToLevel(diagnostic.severity);
    const fileUri = pathToUri(diagnostic.filename);

    // Register rule if not already seen
    if (!ruleIndexMap.has(ruleId)) {
      const sarifRuleBuilder = new SarifRuleBuilder().initSimple({
        ruleId,
        shortDescriptionText: ruleId,
        ...(diagnostic.url ? { helpUri: diagnostic.url } : {}),
      });
      if (diagnostic.help) {
        sarifRuleBuilder.rule.help = { text: diagnostic.help };
      }
      ruleIndexMap.set(ruleId, ruleIndexMap.size);
      sarifRunBuilder.addRule(sarifRuleBuilder);
    }

    // Build the message text, optionally including help
    let messageText = diagnostic.message;
    if (diagnostic.help) {
      messageText += `\n${diagnostic.help}`;
    }

    // Build result using setters for precise control
    const sarifResultBuilder = new SarifResultBuilder();
    sarifResultBuilder.setLevel(level);
    sarifResultBuilder.setMessageText(messageText);
    sarifResultBuilder.setRuleId(ruleId);
    sarifResultBuilder.setLocationArtifactUri({ uri: fileUri });

    // Build region from the first label span (if available)
    if (diagnostic.labels.length > 0) {
      sarifResultBuilder.setLocationRegion(buildRegion(diagnostic.labels[0].span));
    }

    // Map additional labels to relatedLocations
    if (diagnostic.labels.length > 1) {
      const relatedLocations: Location[] = diagnostic.labels.slice(1).map((lbl, idx) =>
        buildRelatedLocation(lbl, diagnostic.filename, idx + 1),
      );
      sarifResultBuilder.result.relatedLocations = relatedLocations;
    }

    sarifRunBuilder.addResult(sarifResultBuilder);
  }

  sarifBuilder.addRun(sarifRunBuilder);

  return sarifBuilder.buildSarifOutput();
}
