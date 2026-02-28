import { defineConfig } from 'tsdown';

const outExtensions = () => ({ js: '.js' as const, dts: '.d.ts' as const });

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm'],
    dts: true,
    clean: true,
    outDir: 'dist',
    outExtensions,
  },
  {
    entry: ['src/cli.ts'],
    format: ['esm'],
    dts: false,
    outDir: 'dist',
    outExtensions,
    banner: {
      js: '#!/usr/bin/env node',
    },
  },
]);
