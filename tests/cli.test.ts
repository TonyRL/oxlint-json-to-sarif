import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, it, expect } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, 'fixtures');
const projectRoot = join(__dirname, '..');

function loadFixture(name: string): string {
  return readFileSync(join(fixturesDir, name), 'utf-8');
}

// ─── CLI Integration Tests ────────────────────────────────────────────────────
// These tests use child_process.execFile to test the built CLI
import { execFile as execFileCb } from 'node:child_process';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import * as os from 'node:os';
import { promisify } from 'node:util';

import { beforeAll } from 'vitest';

const execFile = promisify(execFileCb);

async function runBuiltCli(
  args: string[],
  stdinContent?: string,
): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve) => {
    const cliPath = join(projectRoot, 'dist', 'cli.js');
    const proc = execFileCb(
      'node',
      [cliPath, ...args],
      { encoding: 'utf-8', timeout: 10000 },
      (err, stdout, stderr) => {
        const exitCode =
          err && typeof err === 'object' && 'code' in err && typeof err.code === 'number' ? err.code : err ? 1 : 0;
        resolve({
          stdout: stdout ?? '',
          stderr: stderr ?? '',
          code: exitCode,
        });
      },
    );
    if (stdinContent !== undefined && proc.stdin) {
      proc.stdin.write(stdinContent);
      proc.stdin.end();
    }
  });
}

describe('CLI integration (built)', () => {
  beforeAll(() => {
    execFileSync('pnpm', ['build'], {
      cwd: projectRoot,
      stdio: 'pipe',
      encoding: 'utf-8',
    });
  });

  it('--input: converts oxlint JSON file to SARIF on stdout', async () => {
    const inputFile = join(fixturesDir, 'single-error.json');
    const { stdout, stderr, code } = await runBuiltCli(['--input', inputFile]);

    expect(code).toBe(0);
    expect(stderr).toBe('');

    const sarif = JSON.parse(stdout);
    expect(sarif.version).toBe('2.1.0');
    expect(sarif.runs[0].results).toHaveLength(1);
  });

  it('-i: short alias for --input works', async () => {
    const inputFile = join(fixturesDir, 'single-error.json');
    const { stdout, stderr, code } = await runBuiltCli(['-i', inputFile]);

    expect(code).toBe(0);
    const sarif = JSON.parse(stdout);
    expect(sarif.version).toBe('2.1.0');
  });

  it('--output: writes SARIF to file', async () => {
    const tmpDir = mkdtempSync(join(os.tmpdir(), 'sarif-test-'));
    const outputFile = join(tmpDir, 'out.sarif');
    const inputFile = join(fixturesDir, 'single-error.json');

    try {
      const { code } = await runBuiltCli(['--input', inputFile, '--output', outputFile]);
      expect(code).toBe(0);

      const content = readFileSync(outputFile, 'utf-8');
      const sarif = JSON.parse(content);
      expect(sarif.version).toBe('2.1.0');
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('-o: short alias for --output works', async () => {
    const tmpDir = mkdtempSync(join(os.tmpdir(), 'sarif-test-'));
    const outputFile = join(tmpDir, 'out.sarif');
    const inputFile = join(fixturesDir, 'single-error.json');

    try {
      const { code } = await runBuiltCli(['-i', inputFile, '-o', outputFile]);
      expect(code).toBe(0);

      const content = readFileSync(outputFile, 'utf-8');
      const sarif = JSON.parse(content);
      expect(sarif.version).toBe('2.1.0');
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('stdin: reads from stdin when --input is not specified', async () => {
    const json = loadFixture('single-error.json');
    const { stdout, code } = await runBuiltCli([], json);

    expect(code).toBe(0);
    const sarif = JSON.parse(stdout);
    expect(sarif.version).toBe('2.1.0');
    expect(sarif.runs[0].results).toHaveLength(1);
  });

  it('stdin + --output: reads from stdin and writes to file', async () => {
    const tmpDir = mkdtempSync(join(os.tmpdir(), 'sarif-test-'));
    const outputFile = join(tmpDir, 'out.sarif');
    const json = loadFixture('multiple-diagnostics.json');

    try {
      const { code } = await runBuiltCli(['--output', outputFile], json);
      expect(code).toBe(0);

      const content = readFileSync(outputFile, 'utf-8');
      const sarif = JSON.parse(content);
      expect(sarif.version).toBe('2.1.0');
      expect(sarif.runs[0].results).toHaveLength(5);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('exits with code 1 when --input file does not exist', async () => {
    const { stderr, code } = await runBuiltCli(['--input', '/nonexistent/path/file.json']);

    expect(code).toBe(1);
    expect(stderr).toContain('Cannot read input file');
  });

  it('exits with code 1 for invalid JSON', async () => {
    const tmpDir = mkdtempSync(join(os.tmpdir(), 'sarif-test-'));
    const badFile = join(tmpDir, 'bad.json');

    try {
      writeFileSync(badFile, '{"not": "oxlint"}', 'utf-8');
      const { stderr, code } = await runBuiltCli(['--input', badFile]);

      expect(code).toBe(1);
      expect(stderr).toContain('Conversion failed');
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('--version flag prints version', async () => {
    const { stdout, code } = await runBuiltCli(['--version']);
    expect(code).toBe(0);
    expect(stdout.trim()).toMatch(/\d+\.\d+\.\d+/);
  });

  it('--help flag prints usage information', async () => {
    const { stdout, code } = await runBuiltCli(['--help']);
    expect(code).toBe(0);
    expect(stdout).toContain('oxlint-json-to-sarif');
    expect(stdout).toContain('--input');
    expect(stdout).toContain('--output');
  });
});
