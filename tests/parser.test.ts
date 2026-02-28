import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, it, expect } from 'vitest';

import { parseOxlintJson } from '../src/parser.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, 'fixtures');

function loadFixture(name: string): string {
  return readFileSync(join(fixturesDir, name), 'utf-8');
}

describe('parseOxlintJson', () => {
  describe('valid input', () => {
    it('parses a valid oxlint JSON report', () => {
      const json = loadFixture('multiple-diagnostics.json');
      const report = parseOxlintJson(json);

      expect(report.number_of_files).toBe(3);
      expect(report.diagnostics).toHaveLength(5);
    });

    it('parses diagnostic fields correctly', () => {
      const json = loadFixture('single-error.json');
      const report = parseOxlintJson(json);
      const diagnostic = report.diagnostics[0];

      expect(diagnostic.message).toBe('`debugger` statement is not allowed');
      expect(diagnostic.code).toBe('eslint(no-debugger)');
      expect(diagnostic.severity).toBe('error');
      expect(diagnostic.causes).toEqual([]);
      expect(diagnostic.url).toBe('https://oxc.rs/docs/guide/usage/linter/rules/eslint/no-debugger.html');
      expect(diagnostic.help).toBe('Remove the debugger statement');
      expect(diagnostic.filename).toBe('test.js');
    });

    it('parses label spans correctly', () => {
      const json = loadFixture('single-error.json');
      const report = parseOxlintJson(json);
      const span = report.diagnostics[0].labels[0].span;

      expect(span.offset).toBe(38);
      expect(span.length).toBe(9);
      expect(span.line).toBe(5);
      expect(span.column).toBe(1);
    });

    it('parses metadata fields correctly', () => {
      const json = loadFixture('single-error.json');
      const report = parseOxlintJson(json);

      expect(report.number_of_files).toBe(1);
      expect(report.number_of_rules).toBe(2);
      expect(report.threads_count).toBe(1);
      expect(report.start_time).toBeCloseTo(0.018611917);
    });

    it('parses label text on label objects', () => {
      const json = JSON.stringify({
        diagnostics: [
          {
            message: 'Function does not capture any variables',
            code: 'eslint-plugin-unicorn(consistent-function-scoping)',
            severity: 'warning',
            causes: [],
            filename: 'test.ts',
            labels: [
              { label: 'Outer scope where this function is defined', span: { offset: 509, length: 7, line: 26, column: 16 } },
              { label: 'This function does not use any variables from the parent function', span: { offset: 6342, length: 10, line: 179, column: 11 } },
            ],
            related: [],
          },
        ],
        number_of_files: 1,
        number_of_rules: 1,
        threads_count: 1,
        start_time: 0,
      });
      const report = parseOxlintJson(json);
      const labels = report.diagnostics[0].labels;
      expect(labels).toHaveLength(2);
      expect(labels[0].label).toBe('Outer scope where this function is defined');
      expect(labels[1].label).toBe('This function does not use any variables from the parent function');
    });

    it('omits label text when not present', () => {
      const json = JSON.stringify({
        diagnostics: [
          {
            message: 'Prefer async/await',
            code: 'github(no-then)',
            severity: 'warning',
            causes: [],
            filename: 'test.ts',
            labels: [{ span: { offset: 1700, length: 5, line: 52, column: 20 } }],
            related: [],
          },
        ],
        number_of_files: 1,
        number_of_rules: 1,
        threads_count: 1,
        start_time: 0,
      });
      const report = parseOxlintJson(json);
      const labels = report.diagnostics[0].labels;
      expect(labels).toHaveLength(1);
      expect(labels[0].label).toBeUndefined();
    });

    it('parses empty diagnostics array', () => {
      const json = loadFixture('empty-diagnostics.json');
      const report = parseOxlintJson(json);

      expect(report.diagnostics).toHaveLength(0);
      expect(report.number_of_files).toBe(5);
    });

    it('parses multiple diagnostics across files', () => {
      const json = loadFixture('multiple-diagnostics.json');
      const report = parseOxlintJson(json);
      const filenames = report.diagnostics.map((d) => d.filename);

      expect(filenames).toContain('/home/user/project/src/main.js');
      expect(filenames).toContain('/home/user/project/src/utils.ts');
      expect(filenames).toContain('/home/user/project/src/config.ts');
    });

    it('parses diagnostic without url or help', () => {
      const json = loadFixture('multiple-diagnostics.json');
      const report = parseOxlintJson(json);
      const diagnostic = report.diagnostics[3]; // typescript rule without help

      expect(diagnostic.url).toBeDefined();
      expect(diagnostic.help).toBeUndefined();
    });

    it('handles null number_of_rules', () => {
      const json = JSON.stringify({
        diagnostics: [],
        number_of_files: 1,
        number_of_rules: null,
        threads_count: 1,
        start_time: 0,
      });
      const report = parseOxlintJson(json);
      expect(report.number_of_rules).toBeNull();
    });
  });

  it('handles diagnostic with missing optional span fields (fallback defaults)', () => {
    const json = JSON.stringify({
      diagnostics: [
        {
          message: 'Test',
          code: 'test-rule',
          severity: 'error',
          causes: [],
          filename: 'test.ts',
          labels: [{ span: {} }],
          related: [
            {
              message: 'Related',
              labels: [{ span: {} }],
            },
          ],
        },
      ],
      number_of_files: 1,
      number_of_rules: 1,
      threads_count: 1,
      start_time: 0,
    });
    const report = parseOxlintJson(json);
    const span = report.diagnostics[0].labels[0].span;

    expect(span.offset).toBe(0);
    expect(span.length).toBe(0);
    expect(span.line).toBe(1);
    expect(span.column).toBe(1);

    const relatedSpan = report.diagnostics[0].related[0].labels![0].span;
    expect(relatedSpan.offset).toBe(0);
    expect(relatedSpan.length).toBe(0);
    expect(relatedSpan.line).toBe(1);
    expect(relatedSpan.column).toBe(1);
  });

  it('handles diagnostic with missing metadata fields (fallback defaults)', () => {
    const json = JSON.stringify({
      diagnostics: [],
    });
    const report = parseOxlintJson(json);

    expect(report.number_of_files).toBe(0);
    expect(report.number_of_rules).toBeNull();
    expect(report.threads_count).toBe(1);
    expect(report.start_time).toBe(0);
  });

  it('parses related field with nested labels', () => {
    const json = JSON.stringify({
      diagnostics: [
        {
          message: 'Test',
          code: 'eslint(test)',
          severity: 'error',
          causes: [],
          filename: 'test.ts',
          labels: [{ span: { offset: 0, length: 5, line: 1, column: 1 } }],
          related: [
            {
              message: 'Related info',
              labels: [
                { span: { offset: 10, length: 3, line: 2, column: 5 } },
                { label: 'annotated span', span: { offset: 20, length: 7, line: 3, column: 10 } },
              ],
            },
          ],
        },
      ],
      number_of_files: 1,
      number_of_rules: 1,
      threads_count: 1,
      start_time: 0,
    });
    const report = parseOxlintJson(json);
    const related = report.diagnostics[0].related;

    expect(related).toHaveLength(1);
    expect(related[0].message).toBe('Related info');
    expect(related[0].labels).toHaveLength(2);
    expect(related[0].labels![0].span.offset).toBe(10);
    expect(related[0].labels![0].span.length).toBe(3);
    expect(related[0].labels![0].span.line).toBe(2);
    expect(related[0].labels![0].span.column).toBe(5);
    expect(related[0].labels![0].label).toBeUndefined();
    expect(related[0].labels![1].span.offset).toBe(20);
    expect(related[0].labels![1].span.line).toBe(3);
    expect(related[0].labels![1].label).toBe('annotated span');
  });

  it('parses related field without labels', () => {
    const json = JSON.stringify({
      diagnostics: [
        {
          message: 'Test',
          code: 'eslint(test)',
          severity: 'error',
          causes: [],
          filename: 'test.ts',
          labels: [],
          related: [
            {
              message: 'Related without labels',
            },
          ],
        },
      ],
      number_of_files: 1,
      number_of_rules: 1,
      threads_count: 1,
      start_time: 0,
    });
    const report = parseOxlintJson(json);
    const related = report.diagnostics[0].related;

    expect(related).toHaveLength(1);
    expect(related[0].message).toBe('Related without labels');
    expect(related[0].labels).toBeUndefined();
  });

  it('handles diagnostic with null field values (nullish coalescing fallbacks)', () => {
    // Construct JSON where fields exist but are null, triggering ?? fallbacks
    const json = JSON.stringify({
      diagnostics: [
        {
          message: null,
          code: null,
          severity: null,
          causes: 'not-an-array',
          filename: null,
          labels: 'not-an-array',
          related: 'not-an-array',
        },
      ],
      number_of_files: 1,
      number_of_rules: 1,
      threads_count: 1,
      start_time: 0,
    });
    const report = parseOxlintJson(json);
    const d = report.diagnostics[0];

    expect(d.message).toBe('');
    expect(d.code).toBe('');
    expect(d.severity).toBe('warning');
    expect(d.causes).toEqual([]);
    expect(d.filename).toBe('');
    expect(d.labels).toEqual([]);
    expect(d.related).toEqual([]);
  });

  it('handles related entry without message (undefined branch)', () => {
    const json = JSON.stringify({
      diagnostics: [
        {
          message: 'Test',
          code: 'eslint(test)',
          severity: 'error',
          causes: [],
          filename: 'test.ts',
          labels: [],
          related: [
            {
              labels: [{ span: { offset: 5, length: 2, line: 3, column: 4 } }],
            },
          ],
        },
      ],
      number_of_files: 1,
      number_of_rules: 1,
      threads_count: 1,
      start_time: 0,
    });
    const report = parseOxlintJson(json);
    const related = report.diagnostics[0].related;

    expect(related).toHaveLength(1);
    expect(related[0].message).toBeUndefined();
    expect(related[0].labels).toHaveLength(1);
  });

  describe('inline JSON', () => {
    it('parses inline JSON string', () => {
      const json = JSON.stringify({
        diagnostics: [
          {
            message: 'Test error',
            code: 'eslint(test-rule)',
            severity: 'error',
            causes: [],
            filename: 'test.ts',
            labels: [{ span: { offset: 0, length: 5, line: 1, column: 1 } }],
            related: [],
          },
        ],
        number_of_files: 1,
        number_of_rules: 1,
        threads_count: 1,
        start_time: 0,
      });
      const report = parseOxlintJson(json);

      expect(report.diagnostics).toHaveLength(1);
      expect(report.diagnostics[0].message).toBe('Test error');
      expect(report.diagnostics[0].code).toBe('eslint(test-rule)');
    });
  });

  describe('error handling', () => {
    it('throws on empty input', () => {
      expect(() => parseOxlintJson('')).toThrow('empty');
    });

    it('throws on whitespace-only input', () => {
      expect(() => parseOxlintJson('   \n   ')).toThrow('empty');
    });

    it('throws on missing diagnostics array', () => {
      expect(() => parseOxlintJson('{"foo": "bar"}')).toThrow('Invalid oxlint JSON');
    });

    it('throws on malformed JSON', () => {
      expect(() => parseOxlintJson('{')).toThrow('Failed to parse JSON');
    });

    it('throws on non-object JSON', () => {
      expect(() => parseOxlintJson('"hello"')).toThrow('Invalid oxlint JSON');
    });
  });

  describe('severity normalization', () => {
    it('normalizes "error" severity', () => {
      const json = JSON.stringify({
        diagnostics: [
          {
            message: 'Test',
            code: 'test',
            severity: 'error',
            causes: [],
            filename: 'test.ts',
            labels: [],
            related: [],
          },
        ],
        number_of_files: 1,
        number_of_rules: 1,
        threads_count: 1,
        start_time: 0,
      });
      const report = parseOxlintJson(json);
      expect(report.diagnostics[0].severity).toBe('error');
    });

    it('normalizes "warning" severity', () => {
      const json = JSON.stringify({
        diagnostics: [
          {
            message: 'Test',
            code: 'test',
            severity: 'warning',
            causes: [],
            filename: 'test.ts',
            labels: [],
            related: [],
          },
        ],
        number_of_files: 1,
        number_of_rules: 1,
        threads_count: 1,
        start_time: 0,
      });
      const report = parseOxlintJson(json);
      expect(report.diagnostics[0].severity).toBe('warning');
    });

    it('maps unknown severity to warning', () => {
      const json = JSON.stringify({
        diagnostics: [
          {
            message: 'Test',
            code: 'test',
            severity: 'CUSTOM',
            causes: [],
            filename: 'test.ts',
            labels: [],
            related: [],
          },
        ],
        number_of_files: 1,
        number_of_rules: 1,
        threads_count: 1,
        start_time: 0,
      });
      const report = parseOxlintJson(json);
      expect(report.diagnostics[0].severity).toBe('warning');
    });
  });
});
