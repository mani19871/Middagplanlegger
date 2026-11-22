# Middagsplanlegger (fase 1: familieversjon som webapp)

Norsk middagsplanlegger etter planen «Fullstendig plan: norsk middagsplanlegger».

- `src/engine/planner.ts`: deterministisk planmotor (øre, hele pakninger, delte pakninger, beholdning, én vs. to butikker, budsjettsvar, bytteforskjell på hele kurven).
- `src/data/`: **demodata** (oppdiktede butikker, priser, aviser). Ekte prisdata avklares i fase 0.
- Handlelisten og avkrysninger lagres lokalt og virker uten nett (service worker).
- **Delt husstand** (valgfritt): flere voksne enheter deler ukeplan, handleliste (avkrysning per person) og matskap, uten passord og e-post. Alt skrives lokalt først og synkes i bakgrunnen. Se `docs/synk.md`.

`npm run dev` · `npm test` · `npm run build` · `npm run e2e:sync` (to nettleserkontekster mot ekte server, krever Playwright)

Serveren (produksjon): `npm run build && npm run build:server && npm start` bygger appen (`dist/`) og serveren til én JavaScript-fil (`dist-server/index.mjs`, esbuild) og kjører den med `node`, uten tsx og `node_modules`. `npm run server` (tsx) er bare til utvikling. `npm run smoke:server` er en røyktest av produksjonsbygget, og `npm run check:prod` kjører i tillegg CSP-, PWA- og e2e-skriptene mot det (`BUILT_SERVER=1`, krever Playwright).

Ikke med ennå: ekte kontoer (e-post/magisk lenke, se `docs/synk.md`), ekte prisimport, KI (fase 3), egne apper (fase 3).

## Synk og husstand
`npm run build && npm run server` (utvikling; produksjon: `npm run build:server && npm start`) serverer også synk-API-et (`server/sync/api.ts`) med en lokal SQLite-database (`node:sqlite`, innebygd i Node 22) i `data/middag.sqlite` (eller `SYNC_DB` / `DATA_DIR`). Sett `SYNC_SECRET` (hemmelighet for invitasjonskoder) som miljøvariabel, aldri i repoet. I appen: 🏠-knappen øverst → «Opprett husstand» → «Lag invitasjon», og på den andre enheten «Bli med» med koden eller lenken. Kostkrav, allergier og postnummer synkes ikke.

## Live tilbud (Tjek)
`npm run build && npm run server` (bak proxy: `NODE_USE_ENV_PROXY=1`) starter appen og tilbudsserveren på http://localhost:8787.
Under `npm run dev` proxyes `/api` til serveren (start den i en egen terminal). Tilbud holdes bare i minnet i seks timer.

## Drift
Beslutningsguide for hosting: `docs/hosting.md` (utkast). Docker: `docker build -t middagsplanlegger .` og `docker run -p 127.0.0.1:8787:8787 -v middag-data:/data middagsplanlegger` (miljøvariabler i `docs/hosting.md`; imaget har bare `node`, den bygde serveren og appen, ca. 200 MB utpakket). CI (`.github/workflows/ci.yml`) typesjekker, tester, bygger appen og serveren, røyktester produksjonsbygget og kjører `npm audit --omit=dev` (blokkerer ikke); den deployer ikke. Personverndokumenter (utkast, ikke juridisk rådgivning): `docs/personvern/`.
