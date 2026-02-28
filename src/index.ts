import { convertToSarif } from './converter.js';
import { parseOxlintJson } from './parser.js';

export { convertToSarif } from './converter.js';
export { parseOxlintJson } from './parser.js';
export type * from './types/oxlint.js';
export type { Log } from 'sarif';

/**
 * Converts an oxlint JSON string to a SARIF v2.1.0 JSON.
 *
 * @param jsonContent - Raw JSON content from oxlint's `--format json` output
 * @param indent - Number of spaces for JSON indentation (default: 2)
 * @returns A formatted SARIF v2.1.0 JSON
 * @throws {Error} If the JSON content is invalid or cannot be parsed
 *
 * @example
 * ```ts
 * import { convertOxlintToSarif } from 'oxlint-json-to-sarif'
 *
 * const json = await fs.readFile('oxlint-output.json', 'utf-8')
 * const sarif = convertOxlintToSarif(json)
 * await fs.writeFile('results.sarif', sarif, 'utf-8')
 * ```
 */
export function convertOxlintToSarif(jsonContent: string, indent = 2): string {
  const report = parseOxlintJson(jsonContent);
  const sarif = convertToSarif(report);
  return JSON.stringify(sarif, null, indent);
}
