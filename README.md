# Middagsplanlegger (fase 1: familieversjon som webapp)

Norsk middagsplanlegger etter planen «Fullstendig plan: norsk middagsplanlegger».

- `src/engine/planner.ts`: deterministisk planmotor (øre, hele pakninger, delte pakninger, beholdning, én vs. to butikker, budsjettsvar, bytteforskjell på hele kurven).
- `src/data/`: **demodata** (oppdiktede butikker, priser, aviser). Ekte prisdata avklares i fase 0.
- Handlelisten og avkrysninger lagres lokalt og virker uten nett (service worker).

`npm run dev` · `npm test` · `npm run build`

Ikke med ennå: konto/deling mellom to voksne, ekte prisimport, KI (fase 3), egne apper (fase 3).
