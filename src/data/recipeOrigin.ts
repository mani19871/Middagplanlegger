// Kontroll av oppskriftenes opphav (regel 6). Brukes av catalog.test.ts; en lisensiert oppskrift kan ikke sjekkes inn
// uten kreditering, lenke, vilkår og en oppføring for rettighetshaveren i THIRD_PARTY.md.
import type { Recipe } from '../engine/types';

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Feil i opphavet til en oppskrift, tom liste hvis alt er i orden. `thirdParty` er innholdet i THIRD_PARTY.md. */
export function originProblems(r: Recipe, thirdParty: string): string[] {
  const o = r.origin;
  if (!o) return [`${r.id}: mangler opphav`];
  const out: string[] = [];
  if (!['demo', 'egen', 'lisensiert'].includes(o.kind)) out.push(`${r.id}: ukjent type ${o.kind}`);
  if (!['utkast', 'testkokt', 'godkjent'].includes(o.status)) out.push(`${r.id}: ukjent status ${o.status}`);
  if (!ISO.test(o.date)) out.push(`${r.id}: dato må være ÅÅÅÅ-MM-DD`);
  if (!o.by.trim()) out.push(`${r.id}: mangler hvem som skrev den`);
  if (o.kind === 'lisensiert') {
    if (!o.credit?.trim()) out.push(`${r.id}: lisensiert uten kreditering`);
    if (!o.license?.trim()) out.push(`${r.id}: lisensiert uten vilkår`);
    if (!o.url || !/^https:\/\/[^\s/]+\.[^\s]+$/.test(o.url)) out.push(`${r.id}: lisensiert uten gyldig https-lenke`);
    if (!thirdParty.includes(o.by)) out.push(`${r.id}: rettighetshaver «${o.by}» står ikke i THIRD_PARTY.md`);
  } else if (o.credit || o.url || o.license) out.push(`${r.id}: ${o.kind} skal ikke ha kilde, lenke eller vilkår`);
  return out;
}
