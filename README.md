# Middagsplanlegger (fase 1: familieversjon som webapp)

Norsk middagsplanlegger etter planen «Fullstendig plan: norsk middagsplanlegger».

- `src/engine/planner.ts`: deterministisk planmotor (øre, hele pakninger, delte pakninger, beholdning, én vs. to butikker, budsjettsvar, bytteforskjell på hele kurven).
- `src/data/`: **demodata** (oppdiktede butikker, priser, aviser). Ekte prisdata avklares i fase 0.
- Handlelisten og avkrysninger lagres lokalt og virker uten nett (service worker).

`npm run dev` · `npm test` · `npm run build`

Ikke med ennå: konto/deling mellom to voksne, ekte prisimport, KI (fase 3), egne apper (fase 3).

## Live tilbud (Tjek)
`npm run build && npm run server` (bak proxy: `NODE_USE_ENV_PROXY=1`) starter appen og tilbudsserveren på http://localhost:8787.
Under `npm run dev` proxyes `/api` til serveren (start den i en egen terminal). Tilbud holdes bare i minnet i seks timer.

## Drift
Beslutningsguide for hosting: `docs/hosting.md` (utkast). Docker: `docker build -t middagsplanlegger .` og `docker run -p 127.0.0.1:8787:8787 -v middag-data:/data middagsplanlegger` (miljøvariabler i `docs/hosting.md`). CI (`.github/workflows/ci.yml`) typesjekker, tester og bygger; den deployer ikke. Personverndokumenter (utkast, ikke juridisk rådgivning): `docs/personvern/`.
