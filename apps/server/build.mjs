// Bundles the server and the workspace packages (@sudoku/*, which ship as TypeScript) into
// dist/server.js; npm dependencies stay external and are installed in the image.
import { build } from 'esbuild';
import pkg from './package.json' with { type: 'json' };

const external = Object.keys(pkg.dependencies).filter((name) => !name.startsWith('@sudoku/'));

await build({
  entryPoints: ['src/server.ts'],
  outfile: 'dist/server.js',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  external,
  sourcemap: true,
  logLevel: 'info',
});
