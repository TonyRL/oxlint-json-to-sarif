import { describe, it, expect } from 'vitest';

import { convertToSarif } from '../src/converter.js';
import type { OxlintReport } from '../src/types/oxlint.js';

function makeReport(overrides?: Partial<OxlintReport>): OxlintReport {
  return {
    diagnostics: [],
    number_of_files: 1,
    number_of_rules: 2,
    threads_count: 1,
    start_time: 0,
    ...overrides,
  };
}

describe('convertToSarif', () => {
  describe('root SARIF structure', () => {
    it('produces a valid SARIF v2.1.0 root structure', () => {
      const sarif = convertToSarif(makeReport());

      expect(sarif.version).toBe('2.1.0');
      expect(sarif.$schema).toContain('sarif-schema-2.1.0');
      expect(Array.isArray(sarif.runs)).toBe(true);
      expect(sarif.runs).toHaveLength(1);
    });

    it('run contains required tool.driver.name', () => {
      const sarif = convertToSarif(makeReport());
      const run = sarif.runs[0];

      expect(run.tool).toBeDefined();
      expect(run.tool.driver).toBeDefined();
      expect(run.tool.driver.name).toBe('oxlint');
    });

    it('run contains results array', () => {
      const sarif = convertToSarif(makeReport());
      const run = sarif.runs[0];

      expect(Array.isArray(run.results)).toBe(true);
    });

    it('run specifies columnKind', () => {
      const sarif = convertToSarif(makeReport());
      const run = sarif.runs[0];

      expect(run.columnKind).toBe('utf16CodeUnits');
    });

    it('run includes informationUri', () => {
      const sarif = convertToSarif(makeReport());
      expect(sarif.runs[0].tool.driver.informationUri).toBe('https://oxc.rs/docs/guide/usage/linter');
    });
  });

  describe('empty results', () => {
    it('produces empty results array when report has no diagnostics', () => {
      const sarif = convertToSarif(makeReport({ diagnostics: [] }));
      expect(sarif.runs[0].results).toHaveLength(0);
    });
  });

  describe('severity → level mapping', () => {
    const severityCases: Array<[OxlintReport['diagnostics'][0]['severity'], string]> = [
      ['error', 'error'],
      ['warning', 'warning'],
    ];

    for (const [oxlintSeverity, expectedLevel] of severityCases) {
      it(`maps '${oxlintSeverity}' to SARIF level '${expectedLevel}'`, () => {
        const report = makeReport({
          diagnostics: [
            {
              message: 'Test',
              code: 'eslint(test)',
              severity: oxlintSeverity,
              causes: [],
              filename: 'test.ts',
              labels: [{ span: { offset: 0, length: 5, line: 1, column: 1 } }],
              related: [],
            },
          ],
        });
        const sarif = convertToSarif(report);
        expect(sarif.runs[0].results[0].level).toBe(expectedLevel);
      });
    }
  });

  describe('result location', () => {
    it('maps line and column to SARIF region', () => {
      const report = makeReport({
        diagnostics: [
          {
            message: 'Test',
            code: 'eslint(test)',
            severity: 'error',
            causes: [],
            filename: 'test.ts',
            labels: [{ span: { offset: 100, length: 10, line: 42, column: 7 } }],
            related: [],
          },
        ],
      });
      const sarif = convertToSarif(report);
      const location = sarif.runs[0].results[0].locations?.[0];
      const region = location?.physicalLocation?.region;

      expect(region?.startLine).toBe(42);
      expect(region?.startColumn).toBe(7);
      expect(region?.endColumn).toBe(17);
    });

    it('omits startColumn when column is 0', () => {
      const report = makeReport({
        diagnostics: [
          {
            message: 'Test',
            code: 'eslint(test)',
            severity: 'error',
            causes: [],
            filename: 'test.ts',
            labels: [{ span: { offset: 0, length: 5, line: 10, column: 0 } }],
            related: [],
          },
        ],
      });
      const sarif = convertToSarif(report);
      const region = sarif.runs[0].results[0].locations?.[0]?.physicalLocation?.region;

      expect(region?.startLine).toBe(10);
      expect(region?.startColumn).toBeUndefined();
      expect(region?.endColumn).toBe(5);
    });

    it('does not include region when labels are empty', () => {
      const report = makeReport({
        diagnostics: [
          {
            message: 'Test',
            code: 'eslint(test)',
            severity: 'warning',
            causes: [],
            filename: 'test.ts',
            labels: [],
            related: [],
          },
        ],
      });
      const sarif = convertToSarif(report);
      const region = sarif.runs[0].results[0].locations?.[0]?.physicalLocation?.region;
      expect(region).toBeUndefined();
    });

    it('omits endColumn when length is 0', () => {
      const report = makeReport({
        diagnostics: [
          {
            message: 'Test',
            code: 'eslint(test)',
            severity: 'error',
            causes: [],
            filename: 'test.ts',
            labels: [{ span: { offset: 0, length: 0, line: 5, column: 3 } }],
            related: [],
          },
        ],
      });
      const sarif = convertToSarif(report);
      const region = sarif.runs[0].results[0].locations?.[0]?.physicalLocation?.region;

      expect(region?.startLine).toBe(5);
      expect(region?.startColumn).toBe(3);
      expect(region?.endColumn).toBeUndefined();
    });

    it('converts absolute Unix path to file:// URI', () => {
      const report = makeReport({
        diagnostics: [
          {
            message: 'Test',
            code: 'eslint(test)',
            severity: 'error',
            causes: [],
            filename: '/home/user/project/test.ts',
            labels: [{ span: { offset: 0, length: 5, line: 1, column: 1 } }],
            related: [],
          },
        ],
      });
      const sarif = convertToSarif(report);
      const uri = sarif.runs[0].results[0].locations?.[0]?.physicalLocation?.artifactLocation?.uri;
      expect(uri).toBe('file:///home/user/project/test.ts');
    });

    it('keeps relative paths as-is', () => {
      const report = makeReport({
        diagnostics: [
          {
            message: 'Test',
            code: 'eslint(test)',
            severity: 'error',
            causes: [],
            filename: 'src/test.ts',
            labels: [{ span: { offset: 0, length: 5, line: 1, column: 1 } }],
            related: [],
          },
        ],
      });
      const sarif = convertToSarif(report);
      const uri = sarif.runs[0].results[0].locations?.[0]?.physicalLocation?.artifactLocation?.uri;
      expect(uri).toBe('src/test.ts');
    });
  });

  describe('ruleId handling', () => {
    it('uses code as ruleId', () => {
      const report = makeReport({
        diagnostics: [
          {
            message: 'Test',
            code: 'eslint(no-debugger)',
            severity: 'error',
            causes: [],
            filename: 'test.ts',
            labels: [{ span: { offset: 0, length: 5, line: 1, column: 1 } }],
            related: [],
          },
        ],
      });
      const sarif = convertToSarif(report);
      expect(sarif.runs[0].results[0].ruleId).toBe('eslint(no-debugger)');
    });

    it('uses UnknownRule when code is empty', () => {
      const report = makeReport({
        diagnostics: [
          {
            message: 'Test',
            code: '',
            severity: 'error',
            causes: [],
            filename: 'test.ts',
            labels: [{ span: { offset: 0, length: 5, line: 1, column: 1 } }],
            related: [],
          },
        ],
      });
      const sarif = convertToSarif(report);
      expect(sarif.runs[0].results[0].ruleId).toBe('UnknownRule');
    });

    it('deduplicates rules with the same code', () => {
      const report = makeReport({
        diagnostics: [
          {
            message: 'First',
            code: 'eslint(no-debugger)',
            severity: 'error',
            causes: [],
            filename: 'a.ts',
            labels: [{ span: { offset: 0, length: 5, line: 1, column: 1 } }],
            related: [],
          },
          {
            message: 'Second',
            code: 'eslint(no-debugger)',
            severity: 'error',
            causes: [],
            filename: 'b.ts',
            labels: [{ span: { offset: 0, length: 5, line: 2, column: 1 } }],
            related: [],
          },
        ],
      });
      const sarif = convertToSarif(report);
      const rules = sarif.runs[0].tool.driver.rules;
      const debuggerRules = rules?.filter((r) => r.id === 'eslint(no-debugger)') ?? [];
      expect(debuggerRules).toHaveLength(1);
    });

    it('produces correct ruleIndex pointing to rules array', () => {
      const report = makeReport({
        diagnostics: [
          {
            message: 'Check A',
            code: 'eslint(check-a)',
            severity: 'error',
            causes: [],
            filename: 'test.ts',
            labels: [{ span: { offset: 0, length: 5, line: 1, column: 1 } }],
            related: [],
          },
          {
            message: 'Check B',
            code: 'eslint(check-b)',
            severity: 'warning',
            causes: [],
            filename: 'test.ts',
            labels: [{ span: { offset: 10, length: 5, line: 2, column: 1 } }],
            related: [],
          },
        ],
      });
      const sarif = convertToSarif(report);
      const rules = sarif.runs[0].tool.driver.rules ?? [];
      const results = sarif.runs[0].results;

      expect(rules[results[0].ruleIndex ?? -1].id).toBe('eslint(check-a)');
      expect(rules[results[1].ruleIndex ?? -1].id).toBe('eslint(check-b)');
    });

    it('includes helpUri from diagnostic url', () => {
      const report = makeReport({
        diagnostics: [
          {
            message: 'Test',
            code: 'eslint(no-debugger)',
            severity: 'error',
            causes: [],
            url: 'https://oxc.rs/docs/guide/usage/linter/rules/eslint/no-debugger.html',
            filename: 'test.ts',
            labels: [{ span: { offset: 0, length: 5, line: 1, column: 1 } }],
            related: [],
          },
        ],
      });
      const sarif = convertToSarif(report);
      const rule = sarif.runs[0].tool.driver.rules?.[0];
      expect(rule?.helpUri).toBe('https://oxc.rs/docs/guide/usage/linter/rules/eslint/no-debugger.html');
    });

    it('includes help.text from diagnostic help property', () => {
      const report = makeReport({
        diagnostics: [
          {
            message: 'Test',
            code: 'eslint(test-rule)',
            severity: 'error',
            causes: [],
            help: 'Remove the debug statement',
            filename: 'test.ts',
            labels: [{ span: { offset: 0, length: 5, line: 1, column: 1 } }],
            related: [],
          },
        ],
      });
      const sarif = convertToSarif(report);
      const rule = sarif.runs[0].tool.driver.rules?.[0];
      expect(rule?.help?.text).toBe('Remove the debug statement');
    });

    it('includes both helpUri and help.text', () => {
      const report = makeReport({
        diagnostics: [
          {
            message: 'Test',
            code: 'eslint(combined)',
            severity: 'error',
            causes: [],
            url: 'https://example.com/rule',
            help: 'Fix this issue',
            filename: 'test.ts',
            labels: [{ span: { offset: 0, length: 5, line: 1, column: 1 } }],
            related: [],
          },
        ],
      });
      const sarif = convertToSarif(report);
      const rule = sarif.runs[0].tool.driver.rules?.[0];
      expect(rule?.helpUri).toBe('https://example.com/rule');
      expect(rule?.help?.text).toBe('Fix this issue');
    });
  });

  describe('message', () => {
    it('includes message.text in result', () => {
      const report = makeReport({
        diagnostics: [
          {
            message: 'Something went wrong',
            code: 'eslint(test)',
            severity: 'error',
            causes: [],
            filename: 'test.ts',
            labels: [{ span: { offset: 0, length: 5, line: 1, column: 1 } }],
            related: [],
          },
        ],
      });
      const sarif = convertToSarif(report);
      expect(sarif.runs[0].results[0].message.text).toContain('Something went wrong');
    });

    it('appends help text to message', () => {
      const report = makeReport({
        diagnostics: [
          {
            message: 'Error occurred',
            code: 'eslint(test)',
            severity: 'error',
            causes: [],
            help: 'Fix by doing X',
            filename: 'test.ts',
            labels: [{ span: { offset: 0, length: 5, line: 1, column: 1 } }],
            related: [],
          },
        ],
      });
      const sarif = convertToSarif(report);
      expect(sarif.runs[0].results[0].message.text).toBe('Error occurred\nFix by doing X');
    });
  });

  describe('multiple diagnostics', () => {
    it('maps all diagnostics into results array', () => {
      const report = makeReport({
        diagnostics: [
          {
            message: 'A error',
            code: 'eslint(a)',
            severity: 'error',
            causes: [],
            filename: 'a.ts',
            labels: [{ span: { offset: 0, length: 5, line: 1, column: 1 } }],
            related: [],
          },
          {
            message: 'B warning',
            code: 'eslint(b)',
            severity: 'warning',
            causes: [],
            filename: 'b.ts',
            labels: [{ span: { offset: 0, length: 5, line: 2, column: 1 } }],
            related: [],
          },
          {
            message: 'C warning',
            code: 'eslint(c)',
            severity: 'warning',
            causes: [],
            filename: 'c.ts',
            labels: [{ span: { offset: 0, length: 5, line: 3, column: 1 } }],
            related: [],
          },
        ],
      });
      const sarif = convertToSarif(report);
      expect(sarif.runs[0].results).toHaveLength(3);
    });
  });

  describe('relatedLocations from multiple labels', () => {
    it('maps extra labels to relatedLocations with message', () => {
      const report = makeReport({
        diagnostics: [
          {
            message: 'Function does not capture any variables',
            code: 'eslint-plugin-unicorn(consistent-function-scoping)',
            severity: 'warning',
            causes: [],
            url: 'https://example.com',
            help: 'Move function to outer scope',
            filename: 'src/test.ts',
            labels: [
              { label: 'Outer scope where this function is defined', span: { offset: 509, length: 7, line: 26, column: 16 } },
              { label: 'This function does not use any variables', span: { offset: 6342, length: 10, line: 179, column: 11 } },
            ],
            related: [],
          },
        ],
      });
      const sarif = convertToSarif(report);
      const result = sarif.runs[0].results[0];

      expect(result.relatedLocations).toHaveLength(1);
      const relLoc = result.relatedLocations![0];
      expect(relLoc.id).toBe(1);
      expect(relLoc.message?.text).toBe('This function does not use any variables');
      expect(relLoc.physicalLocation?.artifactLocation?.uri).toBe('src/test.ts');
      expect(relLoc.physicalLocation?.region?.startLine).toBe(179);
      expect(relLoc.physicalLocation?.region?.startColumn).toBe(11);
      expect(relLoc.physicalLocation?.region?.endColumn).toBe(21);
    });

    it('omits relatedLocations when only one label', () => {
      const report = makeReport({
        diagnostics: [
          {
            message: 'Test',
            code: 'eslint(test)',
            severity: 'error',
            causes: [],
            filename: 'test.ts',
            labels: [{ span: { offset: 0, length: 5, line: 1, column: 1 } }],
            related: [],
          },
        ],
      });
      const sarif = convertToSarif(report);
      expect(sarif.runs[0].results[0].relatedLocations).toBeUndefined();
    });

    it('omits message on relatedLocation when label has no text', () => {
      const report = makeReport({
        diagnostics: [
          {
            message: 'Test',
            code: 'eslint(test)',
            severity: 'error',
            causes: [],
            filename: 'test.ts',
            labels: [
              { span: { offset: 0, length: 5, line: 1, column: 1 } },
              { span: { offset: 10, length: 3, line: 5, column: 8 } },
            ],
            related: [],
          },
        ],
      });
      const sarif = convertToSarif(report);
      const relLoc = sarif.runs[0].results[0].relatedLocations![0];
      expect(relLoc.message).toBeUndefined();
      expect(relLoc.physicalLocation?.region?.startLine).toBe(5);
    });

    it('handles three or more labels', () => {
      const report = makeReport({
        diagnostics: [
          {
            message: 'Test',
            code: 'eslint(test)',
            severity: 'error',
            causes: [],
            filename: 'test.ts',
            labels: [
              { label: 'Primary', span: { offset: 0, length: 5, line: 1, column: 1 } },
              { label: 'Second', span: { offset: 10, length: 3, line: 5, column: 8 } },
              { label: 'Third', span: { offset: 20, length: 2, line: 10, column: 4 } },
            ],
            related: [],
          },
        ],
      });
      const sarif = convertToSarif(report);
      expect(sarif.runs[0].results[0].relatedLocations).toHaveLength(2);
      expect(sarif.runs[0].results[0].relatedLocations![0].id).toBe(1);
      expect(sarif.runs[0].results[0].relatedLocations![0].message?.text).toBe('Second');
      expect(sarif.runs[0].results[0].relatedLocations![1].id).toBe(2);
      expect(sarif.runs[0].results[0].relatedLocations![1].message?.text).toBe('Third');
    });

    it('omits startColumn and endColumn on relatedLocation when column is 0 and length is 0', () => {
      const report = makeReport({
        diagnostics: [
          {
            message: 'Test',
            code: 'eslint(test)',
            severity: 'error',
            causes: [],
            filename: 'test.ts',
            labels: [
              { span: { offset: 0, length: 5, line: 1, column: 1 } },
              { span: { offset: 10, length: 0, line: 5, column: 0 } },
            ],
            related: [],
          },
        ],
      });
      const sarif = convertToSarif(report);
      const relLoc = sarif.runs[0].results[0].relatedLocations![0];
      expect(relLoc.physicalLocation?.region?.startLine).toBe(5);
      expect(relLoc.physicalLocation?.region?.startColumn).toBeUndefined();
      expect(relLoc.physicalLocation?.region?.endColumn).toBeUndefined();
    });
  });

  describe('Windows path conversion', () => {
    it('converts Windows absolute path to file:// URI', () => {
      const report = makeReport({
        diagnostics: [
          {
            message: 'Test',
            code: 'eslint(test)',
            severity: 'error',
            causes: [],
            filename: 'C:\\Users\\foo\\test.ts',
            labels: [{ span: { offset: 0, length: 5, line: 1, column: 1 } }],
            related: [],
          },
        ],
      });
      const sarif = convertToSarif(report);
      const uri = sarif.runs[0].results[0].locations?.[0]?.physicalLocation?.artifactLocation?.uri;
      expect(uri).toBe('file:///C:/Users/foo/test.ts');
    });
  });

  describe('toolVersion parameter', () => {
    it('toolVersion parameter sets version on driver', () => {
      const report = makeReport();
      const sarif = convertToSarif(report, '1.0.0');
      expect(sarif.runs[0].tool.driver.version).toBe('1.0.0');
    });

    it('omits version when toolVersion is not provided', () => {
      const report = makeReport();
      const sarif = convertToSarif(report);
      expect(sarif.runs[0].tool.driver.version).toBeUndefined();
    });
  });
});
