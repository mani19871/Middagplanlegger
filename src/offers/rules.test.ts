import { describe, expect, it } from 'vitest';
import rawRules from '../data/offer-rules.json';
import { ingredients } from '../data/catalog';
import { toHints } from './hints';
import { matchOffer } from './match';
import { OFFER_RULES, parseRules, patternMatches, removeRule, ruleDiff, ruleFileText, suggestPattern, upsertRule, type OfferRule } from './rules';
import type { LiveOffer } from './service';
import type { NormalizedOffer } from './types';

const offer = (heading: string, over: Partial<NormalizedOffer> = {}): NormalizedOffer => ({
  id: 'o1', source: 'tjek', heading, description: null, priceOre: 7990, prePriceOre: 9990, amount: 400, unit: 'g', pieces: null,
  dealerId: 'd', dealerName: 'Butikk', validFrom: '2026-11-23T00:00:00+0100', validUntil: '2026-11-29T23:59:59+0100', observed: 'x', ...over,
});
const ok = (pattern: string, ingredient: string): OfferRule => ({ pattern, decision: 'godkjent', ingredient });
const no = (pattern: string, ingredient?: string): OfferRule => ({ pattern, decision: 'avvist', ...(ingredient ? { ingredient } : {}) });
const m = (heading: string, rules: OfferRule[], over: Partial<NormalizedOffer> = {}) => matchOffer(offer(heading, over), ingredients, '2026-11-24', undefined, rules);

describe('regelfil', () => {
  it('den innsjekkede filen er gyldig og peker bare på kjente ingredienser', () => {
    expect(() => parseRules(rawRules, ingredients.map((i) => i.id))).not.toThrow();
    expect(OFFER_RULES).toEqual(parseRules(rawRules));
  });
  it('avviser ugyldige regler', () => {
    const f = (rules: unknown[]) => () => parseRules({ version: 1, rules }, ['torsk']);
    expect(f([{ pattern: 'torsk', decision: 'godkjent' }])).toThrow('ingrediens');
    expect(f([{ pattern: 't', decision: 'avvist' }])).toThrow('to tegn');
    expect(f([{ pattern: 'torsk', decision: 'kanskje' }])).toThrow('decision');
    expect(f([ok('laks', 'laks')])).toThrow('ukjent ingrediens');
    expect(f([ok('torsk', 'torsk'), ok('Torsk ', 'torsk')])).toThrow('dobbel');
    expect(() => parseRules({ rules: [] })).toThrow('version');
  });
  it('mønsteret er en hel frase uten endelser', () => {
    expect(patternMatches('Torskefilet 400 g', 'torskefilet')).toBe(true);
    expect(patternMatches('Torskefileter', 'torskefilet')).toBe(false);
    expect(patternMatches('KOKOSMELK  LETT', 'kokosmelk lett')).toBe(true);
  });
  it('foreslår mønster uten mengde og pakning', () => {
    expect(suggestPattern('Torskefilet 400 g')).toBe('torskefilet');
    expect(suggestPattern('Kyllingfilet 2 x 450 g')).toBe('kyllingfilet');
    expect(suggestPattern('Hakkede tomater 3x400g')).toBe('hakkede tomater');
  });
});

describe('matching med regler', () => {
  it('søkeordtreff uten regel er bare et forslag', () => {
    const r = m('Torskefilet', []);
    expect(r?.ingredient).toBe('torsk');
    expect(r?.approved).toBe(false);
    expect(r?.rule).toBeNull();
  });
  it('godkjent regel godkjenner koblingen og kan overstyre søkeord og utelukkelsesliste', () => {
    expect(m('Torskefilet', [ok('torskefilet', 'torsk')])).toMatchObject({ ingredient: 'torsk', approved: true, rule: 'torskefilet', needsReview: false });
    // «salat» står på utelukkelseslisten, men redaktøren har godkjent salatløk som løk (og mengden er da i stk).
    expect(m('Salatløk', [])).toBeNull();
    expect(m('Salatløk', [ok('salatløk', 'lok')], { unit: null, amount: null, pieces: 1 })).toMatchObject({ ingredient: 'lok', approved: true });
    // Endre ingrediens: regelen vinner over søkeordet.
    expect(m('Kyllingkjøttdeig', [ok('kyllingkjøttdeig', 'kylling')])?.ingredient).toBe('kylling');
  });
  it('avvist regel uten ingrediens stopper tilbudet; med ingrediens stopper den bare den koblingen', () => {
    expect(m('Torskefilet med saus', [ok('torskefilet', 'torsk'), no('med saus')])).toBeNull();
    expect(m('Kjøttdeig av svin', [no('kjøttdeig av svin', 'kjottdeig')])).toBeNull();
    expect(m('Laks og torsk', [no('laks og torsk', 'laks')])?.ingredient).toBe('torsk');
  });
  it('avvisning vinner over godkjenning', () => {
    expect(m('Kjøttdeig av svin', [ok('kjøttdeig', 'kjottdeig'), no('av svin', 'kjottdeig')])).toBeNull();
  });
  it('like lange godkjente mønstre for ulike ingredienser er ikke godkjent', () => {
    const r = m('Laks mais', [ok('laks', 'laks'), ok('mais', 'mais')])!; // begge fire tegn
    expect(r.approved).toBe(false);
    expect(r.reasons).toContain('tvetydig');
  });
  it('godkjent kobling må fortsatt ha pris, mengde i samme enhet og ingen vilkår', () => {
    const rules = [ok('torskefilet', 'torsk')];
    expect(m('Torskefilet', rules, { priceOre: null })?.reasons).toEqual(['pris ukjent']);
    expect(m('Torskefilet', rules, { unit: 'ml' })?.reasons).toEqual(['mengde ukjent']);
    expect(m('Torskefilet', rules, { description: 'Gjelder Coop-medlemmer' })?.reasons).toEqual(['vilkår']);
    expect(m('Torskefilet 3 for 2', rules)?.reasons).toEqual(['vilkår']);
    expect(m('Torskefilet', rules, { pieces: 2 })?.reasons).toEqual(['flerpakning']);
  });
  it('utløpt tilbud gir ingen treff selv med godkjent regel', () => {
    expect(matchOffer(offer('Torskefilet'), ingredients, '2026-11-30', undefined, [ok('torskefilet', 'torsk')])).toBeNull();
  });
});

describe('«tillatt»: unntak fra utelukkelseslisten', () => {
  const allow = (pattern: string, ingredient: string): OfferRule => ({ pattern, decision: 'tillatt', ingredient });
  it('soyasaus, fiskekaker og hvetenudler stoppes uten unntak, og slipper gjennom som forslag med', () => {
    expect(m('Soyasaus 150 ml', [], { unit: 'ml', amount: 150 })).toBeNull();
    expect(m('Fiskekaker', [])).toBeNull();
    expect(m('Soyasaus 150 ml', [allow('soyasaus', 'soyasaus')], { unit: 'ml', amount: 150 })).toMatchObject({ ingredient: 'soyasaus', approved: false, rule: 'soyasaus', needsReview: false });
    expect(m('Fiskekaker', [allow('fiskekaker', 'fiskekaker')])).toMatchObject({ ingredient: 'fiskekaker', approved: false });
  });
  it('resten av overskriften sjekkes fortsatt mot utelukkelseslisten', () => {
    expect(m('Fiskekaker i hvit saus', [allow('fiskekaker', 'fiskekaker')])).toBeNull();
    expect(m('Soyasaus kyllingnudler', [allow('soyasaus', 'soyasaus')])).toBeNull(); // «nudler» står igjen
  });
  it('avvisning vinner over unntak, og unntaket krever ingrediens', () => {
    expect(m('Soyasaus søt', [allow('soyasaus', 'soyasaus'), no('søt')])).toBeNull();
    expect(() => parseRules({ version: 1, rules: [{ pattern: 'soyasaus', decision: 'tillatt' }] })).toThrow('ingrediens');
  });
  it('regelfilen har unntak for alle søkeord som ellers ville blitt utelukket', () => {
    for (const [id, term] of [['soyasaus', 'Soyasaus'], ['fiskekaker', 'Fiskekaker'], ['nudler', 'Hvetenudler']]) {
      const unit = ingredients.find((i) => i.id === id)!.unit;
      expect(m(term, OFFER_RULES, { unit, amount: 100 })?.ingredient, term).toBe(id);
    }
  });
});

describe('redigering og eksport av regler', () => {
  it('samme regel to ganger gir én rad', () => {
    const r = upsertRule(upsertRule([], ok('Torskefilet', 'torsk')), ok('torskefilet ', 'torsk'));
    expect(r).toEqual([ok('torskefilet', 'torsk')]);
  });
  it('ny ingrediens for samme mønster erstatter den gamle, og avvisning erstatter godkjenning', () => {
    let r = upsertRule([], ok('kyllingkjøttdeig', 'kjottdeig'));
    r = upsertRule(r, ok('kyllingkjøttdeig', 'kylling'));
    expect(r).toEqual([ok('kyllingkjøttdeig', 'kylling')]);
    r = upsertRule(r, no('kyllingkjøttdeig'));
    expect(r).toEqual([no('kyllingkjøttdeig')]);
  });
  it('avvisning for én ingrediens beholder godkjenning for en annen', () => {
    const r = upsertRule(upsertRule([], ok('laks og torsk', 'torsk')), no('laks og torsk', 'laks'));
    expect(r).toHaveLength(2);
  });
  it('regeldiff og eksportert fil kan leses inn igjen', () => {
    const base = [ok('torskefilet', 'torsk'), no('med saus')];
    const draft = upsertRule(removeRule(base, no('med saus')), ok('kyllingfilet', 'kylling'));
    expect(ruleDiff(base, draft)).toEqual({ added: [ok('kyllingfilet', 'kylling')], removed: [no('med saus')] });
    const text = ruleFileText(draft);
    expect(parseRules(JSON.parse(text), ingredients.map((i) => i.id))).toEqual(draft);
    expect(text).not.toMatch(/priceOre|validUntil|dealer/); // regler lagrer mønstre, ikke tilbud
  });
});

describe('hint til planmotoren', () => {
  const live = (o: NormalizedOffer): LiveOffer => ({ ...matchOffer(o, ingredients, '2026-11-24', undefined, [])!, phase: 'nå' });
  it('godkjenning følger appens regler, ikke serverens', () => {
    const l = live(offer('Torskefilet'));
    expect(toHints([l], ingredients, [])[0].approved).toBe(false);
    expect(toHints([l], ingredients, [ok('torskefilet', 'torsk')])[0]).toMatchObject({ approved: true, ingredient: 'torsk', validFrom: '2026-11-23', validUntil: '2026-11-29' });
    expect(toHints([l], ingredients, [no('torskefilet')])).toEqual([]);
  });
  it('treff som må kontrolleres blir ikke hint', () => {
    expect(toHints([live(offer('Torskefilet', { description: '3 for 2' }))], ingredients, [ok('torskefilet', 'torsk')])).toEqual([]);
  });
});
