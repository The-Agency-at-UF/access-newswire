import { defineConfig } from 'tsup'

// Bundles the worker with the workspace packages (@access/*), which ship as
// TypeScript source; npm dependencies stay external and come from node_modules.
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node22',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  noExternal: [/^@access\//],
})
