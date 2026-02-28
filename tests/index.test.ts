import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Log as SarifLog } from 'sarif';
import { describe, it, expect } from 'vitest';

import { convertOxlintToSarif, parseOxlintJson, convertToSarif } from '../src/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, 'fixtures');

function loadFixture(name: string): string {
  return readFileSync(join(fixturesDir, name), 'utf-8');
}

describe('convertOxlintToSarif', () => {
  it('returns a valid JSON string', () => {
    const json = loadFixture('multiple-diagnostics.json');
    const result = convertOxlintToSarif(json);

    expect(typeof result).toBe('string');
    expect(() => JSON.parse(result)).not.toThrow();
  });

  it('output is valid SARIF v2.1.0 JSON', () => {
    const json = loadFixture('multiple-diagnostics.json');
    const result = convertOxlintToSarif(json);
    const sarif: SarifLog = JSON.parse(result);

    expect(sarif.version).toBe('2.1.0');
    expect(Array.isArray(sarif.runs)).toBe(true);
    expect(sarif.runs.length).toBeGreaterThan(0);
  });

  it('converts empty diagnostics to SARIF with empty results', () => {
    const json = loadFixture('empty-diagnostics.json');
    const result = convertOxlintToSarif(json);
    const sarif: SarifLog = JSON.parse(result);

    expect(sarif.runs[0].results).toHaveLength(0);
  });

  it('preserves all diagnostics from input', () => {
    const json = loadFixture('multiple-diagnostics.json');
    const result = convertOxlintToSarif(json);
    const sarif: SarifLog = JSON.parse(result);

    expect(sarif.runs[0].results).toHaveLength(5);
  });

  it('uses 2-space indentation by default', () => {
    const json = loadFixture('single-error.json');
    const result = convertOxlintToSarif(json);
    expect(result).toMatch(/^{\n  "/);
  });

  it('allows custom indentation', () => {
    const json = loadFixture('single-error.json');
    const result = convertOxlintToSarif(json, 4);
    expect(result).toMatch(/^{\n    "/);
  });

  it('propagates parser errors', () => {
    expect(() => convertOxlintToSarif('')).toThrow();
    expect(() => convertOxlintToSarif('{"foo": "bar"}')).toThrow();
  });

  it('exports are all accessible', () => {
    expect(typeof convertOxlintToSarif).toBe('function');
    expect(typeof parseOxlintJson).toBe('function');
    expect(typeof convertToSarif).toBe('function');
  });
});
