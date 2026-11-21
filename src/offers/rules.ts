// Kuraterte regler for tilbudsmatching (src/data/offer-rules.json). Reglene lagrer mønstre, aldri tilbud.
// «godkjent»: overskrifter som inneholder mønsteret er ingrediensen (redaktøren har kontrollert koblingen).
// «avvist»: mønsteret er ikke ingrediensen (eller, uten ingrediens, ikke noe vi planlegger med). Avvisning vinner alltid.
// «tillatt»: unntak fra utelukkelseslisten (f.eks. «soyasaus» selv om «saus» er utelukket). Resten av overskriften
// sjekkes fortsatt, og treffet er bare et forslag til kontrollkøen, ikke en godkjenning.
import rawRules from '../data/offer-rules.json';

export type RuleDecision = 'godkjent' | 'avvist' | 'tillatt';
export interface OfferRule { pattern: string; decision: RuleDecision; ingredient?: string; note?: string }
export interface RuleFile { version: 1; description?: string; rules: OfferRule[] }

const L = 'a-zæøåäö0-9';
/** Små bokstaver og enkle mellomrom. Mønstre og overskrifter sammenlignes i denne formen. */
export const normText = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Mønsteret som hel frase (ingen endelser): «torskefilet» treffer «Torskefilet 400 g», ikke «torskefileter». */
export const patternMatches = (text: string, pattern: string) =>
  new RegExp(`(^|[^${L}])${esc(normText(pattern))}($|[^${L}])`).test(normText(text));

/** Forslag til mønster: overskriften uten mengder og pakningsangivelser. Redaktøren kan korte det ned. */
export function suggestPattern(heading: string): string {
  return normText(heading)
    .replace(/\b\d+\s*x\s*\d+([.,]\d+)?\s*(g|kg|hg|ml|cl|dl|l|stk)\b/g, ' ')
    .replace(/\b\d+([.,]\d+)?\s*(g|gram|kg|hg|ml|cl|dl|l|liter|stk|pk|pakk|pakning)\b\.?/g, ' ')
    .replace(/[,()/–-]+\s*$/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Sjekker og normaliserer en regelfil. Kaster ved ugyldig regel, så en feil i filen stopper bygget/testene. */
export function parseRules(x: unknown, ingredientIds?: string[]): OfferRule[] {
  const file = x as Partial<RuleFile> | null;
  if (!file || file.version !== 1 || !Array.isArray(file.rules)) throw new Error('Regelfil: mangler version 1 eller rules[]');
  const out: OfferRule[] = [];
  for (const [i, r] of file.rules.entries()) {
    const where = `Regel ${i + 1}`;
    if (!r || typeof r.pattern !== 'string' || normText(r.pattern).length < 2) throw new Error(`${where}: mønsteret må ha minst to tegn`);
    if (!['godkjent', 'avvist', 'tillatt'].includes(r.decision)) throw new Error(`${where}: decision må være «godkjent», «avvist» eller «tillatt»`);
    if (r.decision !== 'avvist' && !r.ingredient) throw new Error(`${where}: ${r.decision} regel må ha ingrediens`);
    if (r.ingredient !== undefined && ingredientIds && !ingredientIds.includes(r.ingredient)) throw new Error(`${where}: ukjent ingrediens «${r.ingredient}»`);
    out.push(clean(r));
  }
  const keys = out.map(ruleKey);
  const dup = keys.find((k, i) => keys.indexOf(k) !== i);
  if (dup) throw new Error(`Regelfil: dobbel regel ${dup}`);
  return sortRules(out);
}

const clean = (r: OfferRule): OfferRule => ({
  pattern: normText(r.pattern), decision: r.decision,
  ...(r.ingredient ? { ingredient: r.ingredient } : {}), ...(r.note ? { note: r.note } : {}),
});
export const ruleKey = (r: OfferRule) => `${r.decision}:${normText(r.pattern)}:${r.ingredient ?? '*'}`;
export const sortRules = (rules: OfferRule[]) =>
  [...rules].sort((a, b) => a.pattern.localeCompare(b.pattern) || (a.ingredient ?? '').localeCompare(b.ingredient ?? '') || a.decision.localeCompare(b.decision));

/** To regler for samme mønster som ikke kan gjelde samtidig (den nye erstatter den gamle). */
function conflicts(a: OfferRule, b: OfferRule): boolean {
  if (a.pattern !== b.pattern) return false;
  if (a.decision === 'godkjent' && b.decision === 'godkjent') return true; // ett mønster, én ingrediens
  return !a.ingredient || !b.ingredient || a.ingredient === b.ingredient;
}

/** Legger til eller erstatter en regel. Idempotent: samme regel to ganger gir én rad. */
export function upsertRule(rules: OfferRule[], rule: OfferRule): OfferRule[] {
  const r = clean(rule);
  return sortRules([...rules.filter((x) => !conflicts(x, r)), r]);
}
export const removeRule = (rules: OfferRule[], rule: OfferRule) => rules.filter((x) => ruleKey(x) !== ruleKey(rule));

export interface RuleDiff { added: OfferRule[]; removed: OfferRule[] }
export function ruleDiff(base: OfferRule[], draft: OfferRule[]): RuleDiff {
  const b = new Set(base.map(ruleKey));
  const d = new Set(draft.map(ruleKey));
  return { added: sortRules(draft.filter((r) => !b.has(ruleKey(r)))), removed: sortRules(base.filter((r) => !d.has(ruleKey(r)))) };
}

/** Hele regelfilen som tekst, klar til å lime inn i src/data/offer-rules.json. */
export function ruleFileText(rules: OfferRule[], description = (rawRules as RuleFile).description): string {
  const file: RuleFile = { version: 1, ...(description ? { description } : {}), rules: sortRules(rules.map(clean)) };
  return `${JSON.stringify(file, null, 2)}\n`;
}

/** Reglene som er sjekket inn. */
export const OFFER_RULES: OfferRule[] = parseRules(rawRules);
