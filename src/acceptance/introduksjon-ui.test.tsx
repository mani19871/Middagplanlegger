// Introduksjon (onboarding) og «Gi tilbakemelding» for den lukkede piloten, server-rendret.
// Introduksjonen vises første gang appen åpnes på en enhet (lokal markør `introSeen` i AppState, synkes aldri), blokkerer
// ikke appen, kan hoppes over og åpnes igjen fra Husstand → Hjelp. Tekstene lover ikke mer enn koden gjør (regel 4 og 5).
// Tilbakemelding åpner brukerens egen e-postapp via mailto, uten persondata i teksten og uten å sende noe selv.
import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import App from '../App';
import { closeIntro, initialState, showIntro, type AppState } from '../store';
import Intro, { INTRO_STEPS } from '../views/Intro';
import HouseholdView from '../views/HouseholdView';
import PrivacySheet from '../views/PrivacySheet';
import { CONTACT_EMAIL, FEEDBACK_BODY, FEEDBACK_SUBJECT, feedbackMailto } from '../views/feedback';
import { buildExport } from '../sync/export';
import { docBody, pendingCount } from '../sync/engine';

const html = (C: unknown, props: Record<string, unknown> = {}) => renderToStaticMarkup(createElement(C as ComponentType<Record<string, unknown>>, props));
const text = (h: string) => h.replace(/<[^>]*>/g, ' ').replace(/&#x27;|&quot;|&amp;/g, ' ').replace(/\s+/g, ' ');
const noop = () => {};
const promisesAreNegated = (t: string) => {
  for (const x of t.split(/(?<=[.!?])\s+/).filter((s) => /garant|allergenfri|fri for allergener|sluttpris/i.test(s))) expect(x).toMatch(/\b(ikke|aldri|uten)\b/i);
};
/** Ingen svarfrist eller løfte om svar (postkassen er ikke bekreftet i drift; hvem som svarer er ikke avgjort). */
const noDeadline = (t: string) => expect(t).not.toMatch(/innen \d+|innen (en|to|tre) (dag|uke|måned)|svarer vi|du får svar/i);

// App leser lagret tilstand fra localStorage i første gjengivelse. I node finnes den ikke, så testene setter inn en enkel kopi.
const KEY = 'middag-state-v1';
function withStorage(stored: Partial<AppState> | null) {
  const map = new Map<string, string>(stored ? [[KEY, JSON.stringify({ ...initialState, ...stored })]] : []);
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => { map.set(k, v); },
    removeItem: (k: string) => { map.delete(k); }, clear: () => map.clear(),
  };
}
afterEach(() => { delete (globalThis as { localStorage?: unknown }).localStorage; });

const REGION = 'aria-label="Introduksjon til Husvett"';

describe('introduksjonen vises én gang per enhet', () => {
  it('første gang (ingenting lagret): introduksjonen står øverst, og resten av appen er der og kan brukes (ingen modal)', () => {
    withStorage(null);
    const h = html(App);
    expect(h).toContain(REGION);
    const intro = h.slice(h.indexOf(REGION) - 200, h.indexOf('</section>', h.indexOf(REGION)));
    expect(intro).not.toMatch(/aria-modal|role="dialog"/);
    expect(text(h)).toContain(`Steg 1 av ${INTRO_STEPS.length}`);
    expect(text(h)).toMatch(/Hopp over/);
    expect(h).toContain('role="tablist"'); // fanene er der
    expect(text(h)).toContain('Lag ukeplan'); // og skjemaet under
  });

  it('når den er lukket på enheten, vises den ikke igjen av seg selv', () => {
    withStorage({ introSeen: true });
    const h = html(App);
    expect(h).not.toContain(REGION);
    expect(h).toMatch(/<footer[^>]*>[\s\S]*>Hjelp<\/button>[\s\S]*<\/footer>/); // lenken nederst på hver side
  });

  it('eldre lagret tilstand uten markør får introduksjonen én gang (ny funksjon for eksisterende enheter)', () => {
    withStorage({ approved: true });
    expect(html(App)).toContain(REGION);
  });

  it('markøren: vis til den er lukket, lukking er idempotent, og «åpne igjen» viser den uten å endre markøren', () => {
    expect(showIntro(initialState)).toBe(true);
    const closed = closeIntro(initialState);
    expect(closed.introSeen).toBe(true);
    expect(showIntro(closed)).toBe(false);
    expect(closeIntro(closed)).toBe(closed);
    expect(showIntro(closed, true)).toBe(true);
  });
});

describe('introduksjonen: innhold og tilgjengelighet', () => {
  const steps = INTRO_STEPS.map((_, i) => html(Intro, { initialStep: i, onClose: noop, goFilter: noop, goHousehold: noop, openPrivacy: noop }));
  const all = text(steps.join(' '));

  it('høyst fem korte steg, hvert med overskrift, «Steg n av N» og en knapp for å hoppe over eller bli ferdig', () => {
    expect(INTRO_STEPS.length).toBeGreaterThanOrEqual(4);
    expect(INTRO_STEPS.length).toBeLessThanOrEqual(5);
    steps.forEach((h, i) => {
      expect(text(h)).toContain(`Steg ${i + 1} av ${INTRO_STEPS.length}`);
      expect(h).toMatch(/<h2[^>]*id="intro-tittel"[^>]*tabindex="-1"/i);
      expect(h).toContain(REGION);
      expect(text(h).length).toBeLessThan(1400); // kort: ett skjermbilde på mobil
    });
    expect(text(steps[0])).not.toMatch(/Forrige/);
    expect(text(steps[0])).toMatch(/Neste/);
    expect(text(steps.at(-1)!)).toMatch(/Ferdig/);
    expect(text(steps.at(-1)!)).not.toMatch(/Neste/);
    for (const h of steps.slice(0, -1)) expect(text(h)).toMatch(/Hopp over/);
  });

  it('hva Husvett er', () => {
    expect(text(steps[0])).toMatch(/Husvett/);
    expect(text(steps[0])).toMatch(/ukeplan/i);
    expect(text(steps[0])).toMatch(/handleliste/i);
    expect(text(steps[0])).toMatch(/uten nett/);
  });

  it('pilot og demodata er tydelig merket; tilbud fra Tjek vises med kilde og dato; prisene er anslått (regel 5 og 2)', () => {
    expect(all).toMatch(/pilot/i);
    expect(all).toMatch(/DEMODATA/);
    expect(all).toMatch(/prisene|priser/i);
    expect(all).toMatch(/oppskrift/i);
    expect(all).toContain('Kilde: Tjek');
    expect(all).toMatch(/dato/);
    expect(all).toMatch(/anslått/);
  });

  it('allergier: aldri garanti, filtre bare på denne enheten og på hver enhet, utkast skjules ved filter (regel 4)', () => {
    expect(all).toMatch(/aldri garantere/);
    expect(all).toMatch(/varedeklarasjon/);
    expect(all).toMatch(/bare på denne enheten/);
    expect(all).toMatch(/hver enhet/);
    expect(all).toMatch(/ikke kontrollert av en person/);
    expect(all).toMatch(/skjul/);
    promisesAreNegated(all);
  });

  it('husstand: opprette eller bli med med invitasjon, og bare eieren inviterer', () => {
    expect(all).toMatch(/Opprett husstand/);
    expect(all).toMatch(/Bli med/);
    expect(all).toMatch(/invitasjonskode/i);
    expect(all).toMatch(/Bare eieren/);
    expect(all).toMatch(/24 timer/);
  });

  it('personvern: hvor «Personvern», «Last ned mine data» og «Slett alt på denne enheten» står, og at arket er et utkast', () => {
    expect(all).toContain('Personvern');
    expect(all).toContain('Last ned mine data');
    expect(all).toContain('Slett alt på denne enheten');
    expect(all).toMatch(/utkast/i);
    expect(all).toMatch(/Hjelp/);
  });

  it('lover ikke mer enn koden gjør: ingen svarfrist, ingen EØS, ingen kryptering, ingen anonymitet', () => {
    noDeadline(all);
    expect(all).not.toMatch(/EØS|kryptert|anonym/i);
  });

  it('knappene har tekst (tilgjengelig navn), og navigasjonen er vanlige knapper', () => {
    for (const h of steps) for (const b of h.match(/<button[^>]*>[\s\S]*?<\/button>/g) ?? []) expect(text(b).trim().length).toBeGreaterThan(1);
  });
});

describe('Husstand → Hjelp: introduksjonen igjen og «Gi tilbakemelding»', () => {
  const runtime = { offline: false, busy: false, lastError: null, syncNow: noop };
  const props = (state: AppState) => ({ state, update: noop, runtime, status: 'lokal', statusText: '', purchaseConflicts: 0, initialCode: '', openList: noop, openIntro: noop });
  const personal: AppState = {
    ...initialState, postal: '0150',
    settings: { ...initialState.settings, avoid: ['melk'], avoidFoods: ['svin'], vegetarian: true },
    sync: {
      token: ['T', 'E', 'S', 'T'].join(''), cursor: 0, docs: {}, conflicts: {}, rejected: 0, lastSync: null,
      me: { id: 'enhet-aaaa1111', label: 'Voksen Testetikett', role: 'eier', createdAt: '2026-11-23T10:00:00.000Z', lastSeen: null, me: true },
      members: [],
    },
  };

  it.each([['uten husstand', initialState], ['i en husstand', personal]])('%s: knappene finnes, adressen står som tekst med kopier-knapp', (_n, state) => {
    const h = html(HouseholdView, props(state));
    const t = text(h);
    expect(t).toContain('Hjelp og tilbakemelding');
    expect(t).toContain('Vis introduksjonen igjen');
    expect(h).toMatch(/<a[^>]*href="mailto:/);
    expect(t).toMatch(/Gi tilbakemelding/);
    expect(t).toContain(CONTACT_EMAIL);
    expect(t).toMatch(/Kopier adressen/);
    expect(t).toMatch(/din egen e-postapp/);
    expect(t).toMatch(/sender ingenting/);
    noDeadline(t);
  });

  it('mailto: forhåndsutfylt emne og mal, ingen enhets-id, etikett, allergier, postnummer eller nøkkel', () => {
    const h = html(HouseholdView, props(personal));
    const href = /<a[^>]*href="(mailto:[^"]+)"/.exec(h)![1].replace(/&amp;/g, '&');
    expect(href).toBe(feedbackMailto());
    expect(href.startsWith(`mailto:${CONTACT_EMAIL}?subject=`)).toBe(true);
    const decoded = decodeURIComponent(href).replace(/\r\n/g, '\n');
    expect(decoded).toContain(FEEDBACK_SUBJECT);
    expect(decoded).toContain(FEEDBACK_BODY);
    for (const q of ['Hva gjorde du', 'Hva skjedde', 'Hva forventet du']) expect(FEEDBACK_BODY).toContain(q);
    for (const bad of ['enhet-', 'Testetikett', '0150', 'melk', 'svin', 'vegetar', 'TEST', 'token']) expect(decoded).not.toContain(bad);
    // Malen ber brukeren selv om å holde persondata utenfor
    expect(FEEDBACK_BODY).toMatch(/navn/);
    expect(FEEDBACK_BODY).toMatch(/allergi/);
    noDeadline(FEEDBACK_BODY);
  });

  it('kontaktadressen er én konstant (samme i personvern-arket), lett å bytte', () => {
    expect(CONTACT_EMAIL).toBe('kontakt@husvett.no');
    expect(text(html(PrivacySheet, { state: initialState, onClose: noop }))).toContain(CONTACT_EMAIL);
  });
});

describe('introduksjonsmarkøren synkes ikke og forklares i «Last ned mine data» og personvern-arket', () => {
  const seen = closeIntro(initialState);
  it('dokumentene som synkes (plan, innstillinger) og utboksene er de samme med og uten markør', () => {
    for (const n of ['plan', 'innstillinger'] as const) {
      expect(JSON.stringify(docBody(seen, n))).toBe(JSON.stringify(docBody(initialState, n)));
      expect(JSON.stringify(docBody(seen, n))).not.toMatch(/intro/i);
    }
    expect(pendingCount(seen)).toBe(pendingCount(initialState));
  });

  it('eksporten tar den med under enheten (ikke serveren), og forklaringen sier hva den er og at den ikke deles', () => {
    const x = buildExport(seen, 'enhet-x', '2026-11-26T12:00:00.000Z', null);
    expect(x.enhet.lagretPåEnheten.introSeen).toBe(true);
    expect(x.server).toBeNull();
    expect(x.forklaring).toMatch(/introSeen/);
    expect(x.forklaring).toMatch(/introduksjonen/i);
    expect(x.forklaring).toMatch(/deles ikke/);
  });

  it('personvern-arket nevner markøren under «Bare på denne enheten» og at tilbakemelding går fra din egen e-postapp', () => {
    const t = text(html(PrivacySheet, { state: initialState, onClose: noop }));
    const local = t.slice(t.indexOf('Bare på denne enheten'), t.indexOf('Delt med husstanden'));
    expect(local).toMatch(/introduksjonen/i);
    expect(t).toMatch(/egen e-postapp/);
    noDeadline(t);
  });
});
