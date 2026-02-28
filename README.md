# oxlint-json-to-sarif

Convert oxlint JSON output to Static Analysis Results Interchange Format (SARIF) for [Github Code Scanning](https://docs.github.com/en/code-security/reference/code-scanning/sarif-files/sarif-support-for-code-scanning).

## Usage

### File Input

```bash
npx oxlint-json-to-sarif --input oxlint-output.json --output results.sarif
```

### stdin

```bash
oxlint --format json | npx oxlint-json-to-sarif --output results.sarif
```

### stdout

```bash
npx oxlint-json-to-sarif --input oxlint-output.json > results.sarif
```

### Aliases

```bash
npx oxlint-json-to-sarif -i oxlint-output.json -o results.sarif
```

## CLI Options

- --input <path>, -i <path>: path to the oxlint JSON input file
- --output <path>, -o <path>: path to write SARIF output (defaults to stdout)
- --help: show help
- --version: show version

## Node.js Usage

```ts
import { convertOxlintToSarif } from 'oxlint-json-to-sarif';
import { readFile, writeFile } from 'node:fs/promises';

const json = await readFile('oxlint-output.json', 'utf-8');
const sarif = convertOxlintToSarif(json);
await writeFile('results.sarif', sarif, 'utf-8');
```

## Development

```bash
pnpm install
pnpm build
pnpm test
```

## License

MIT
