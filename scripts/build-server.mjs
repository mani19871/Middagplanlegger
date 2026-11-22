// Bygger serveren til én ren JavaScript-fil: dist-server/index.mjs (kjøres med `node`, uten tsx og uten node_modules).
// esbuild følger importene fra server/ inn i src/ (src/offers, src/data, src/sync …) og slår alt sammen. `node:`-moduler
// (inkl. node:sqlite) blir stående som importer og leses av Node ved kjøring. Serveren har ingen npm-avhengigheter
// ved kjøring, så imaget trenger ikke node_modules.
// Kjør: npm run build:server   Start: npm start   (npm run server = tsx, for utvikling)
import { build } from 'esbuild';
import { rmSync } from 'node:fs';

rmSync('dist-server', { recursive: true, force: true });
const r = await build({
  entryPoints: ['server/index.ts'],
  outfile: 'dist-server/index.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  sourcemap: 'linked',      // for lesbare feilsøk-stakker: node --enable-source-maps
  legalComments: 'none',
  logLevel: 'info',
  metafile: true,
});
// Sikkerhetsnett: ingen npm-pakker skal ha havnet utenfor pakken (alt som ikke er node:-modul er bundlet).
const external = r.metafile.outputs['dist-server/index.mjs'].imports.filter((i) => i.external && !i.path.startsWith('node:'));
if (external.length) { console.error('Uventede eksterne importer:', external.map((i) => i.path)); process.exit(1); }
