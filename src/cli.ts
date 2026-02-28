import { readFile, writeFile } from 'node:fs/promises';
import process from 'node:process';

import { program } from 'commander';

import { convertOxlintToSarif } from './index.js';

const cliVersion = '0.1.0';

async function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    process.stdin.on('data', (chunk: Buffer) => chunks.push(chunk));
    process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    process.stdin.on('error', reject);
  });
}

async function main(): Promise<void> {
  program
    .name('oxlint-json-to-sarif')
    .description('Convert oxlint JSON output to SARIF format')
    .version(cliVersion)
    .option('-i, --input <path>', 'path to the oxlint JSON input file')
    .option('-o, --output <path>', 'path to write the SARIF output file (defaults to stdout)');

  program.parse();

  const opts = program.opts<{ input?: string; output?: string }>();

  let jsonContent: string;

  // Determine input source
  if (opts.input) {
    try {
      jsonContent = await readFile(opts.input, 'utf-8');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(`Error: Cannot read input file "${opts.input}": ${message}\n`);
      process.exit(1);
    }
  } else if (process.stdin.isTTY) {
    process.stderr.write(
      'Error: No input provided. Use --input <path> or pipe input via stdin.\n' +
        'Example: npx oxlint-json-to-sarif --input oxlint-output.json\n' +
        '         oxlint --format json | npx oxlint-json-to-sarif\n',
    );
    process.exit(1);
  } else {
    // Reading from piped stdin
    try {
      jsonContent = await readStdin();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(`Error: Failed to read from stdin: ${message}\n`);
      process.exit(1);
    }
  }

  // Convert
  let sarifOutput: string;
  try {
    sarifOutput = convertOxlintToSarif(jsonContent);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Error: Conversion failed: ${message}\n`);
    process.exit(1);
  }

  // Determine output destination
  if (opts.output) {
    try {
      await writeFile(opts.output, sarifOutput, 'utf-8');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(`Error: Cannot write output file "${opts.output}": ${message}\n`);
      process.exit(1);
    }
  } else {
    process.stdout.write(sarifOutput + '\n');
  }
}

await main();
