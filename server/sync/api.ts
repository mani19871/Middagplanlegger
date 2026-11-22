// Synk-API for delt husstand. Uten passord og e-post: hver voksen enhet har et eget enhetstoken (bare sha256 lagres).
// Alle kall etter opprettelse/innmelding er autentisert med «Authorization: Bearer <token>» og avgrenset til
// enhetens husstand. Ratebegrensning, størrelsesgrenser og validering på alle endepunkter. Tydelige feilkoder.
//
//  POST   /api/household                {deviceId, label?}           → 201 {token, member}
//  POST   /api/household/join           {code, deviceId, label?}     → 200 {token, member}
//  GET    /api/household                                             → {members, invites}
//  PATCH  /api/household/me             {label}                      → {member}
//  POST   /api/household/invites                                     → 201 {code, expiresAt}
//  DELETE /api/household/invites/:id                                 → 204
//  DELETE /api/household/members/:id    (eier; id = offentlig id)    → 204
//  POST   /api/household/leave                                       → 204
//  DELETE /api/household                (eier; sletter alt)          → 204
//  POST   /api/sync/events              {events: Envelope[]}         → {accepted, rejected}
//  GET    /api/sync?after=<cursor>                                   → SyncResponse
//  PUT    /api/sync/docs/:name          {baseVersion, body}          → {version} | 409 {error:'konflikt', current}
import { createHash, createHmac, randomBytes as nodeRandomBytes, randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { DOC_NAMES, isValidDoc, stable, type DocName } from '../../src/sync/docs';
import {
  checkEnvelope, cleanLabel, DEVICE_ID, LIMITS, type DocVersion, type ErrorCode, type MemberInfo, type StoredEnvelope, type Stream,
} from '../../src/sync/protocol';
import { QuotaExceededError, type DeviceRow, type DocOut, type SyncStorage } from '../storage/types';
import { ipKey, RateLimiter } from './rateLimit';

export interface SyncApiOptions {
  storage: SyncStorage;
  /** Klokke (ISO). Kan settes i tester. */
  now?: () => string;
  randomBytes?: (n: number) => Buffer;
  /** Hemmelighet for HMAC av invitasjonskoder. Fra miljøvariabelen SYNC_SECRET; mangler den, lages en per prosess. */
  secret?: string;
  /**
   * Les klientens IP fra X-Forwarded-For (bare bak én kjent proxy). Siste adresse i hodet brukes: den har proxyen selv
   * lagt til, mens adresser lenger til venstre kan være satt av klienten.
   */
  trustProxy?: boolean;
  inviteTtlMs?: number;
  limits?: Partial<typeof DEFAULT_RATES>;
  quotas?: Partial<typeof DEFAULT_QUOTAS>;
  /** Et enhetstoken som ikke er brukt på så lenge, slutter å virke (enheten forlater husstanden). Standard: av. */
  tokenIdleMs?: number;
  /** Hvor langt fram i tid en hendelses `at` kan ligge før serveren setter den til mottakstidspunktet. */
  maxFutureSkewMs?: number;
  /** Feillogg. Får bare feilens navn, aldri token, kode, etikett, kropp eller URL. */
  log?: (msg: string) => void;
}
const DEFAULT_RATES = {
  /** Per IP: alle kall. */ ipPerMin: 600,
  /** Per enhet: autentiserte kall. */ devicePerMin: 240,
  /** Per IP: nye husstander per time. */ createPerHour: 20,
  /** Per IP: forsøk på å bli med per 10 min (mot gjetting av koder). */ joinPer10Min: 20,
  /** Alle IP-er samlet: feilede forsøk på å bli med per 10 min (mot gjetting fra mange adresser). */ joinFailGlobalPer10Min: 1000,
};
/** Kvoter per husstand. En familie bruker en brøkdel; de stopper et medlem eller et stjålet token fra å fylle disken. */
export const DEFAULT_QUOTAS = {
  /** Aktive medlemmer (voksne enheter). */ activeMembers: 12,
  /** Alle medlemsrader, også fjernede (hver ny enhet som blir med, gir en rad). */ totalMembers: 50,
  /** Aktive invitasjoner samtidig. */ activeInvites: 5,
  /** Lagrede hendelser. */ events: 100_000,
  /** Samlet størrelse på lagrede hendelser (byte). */ eventBytes: 64 * 1024 * 1024,
};

const MESSAGES: Record<ErrorCode, string> = {
  ugyldig_forespørsel: 'Ugyldig forespørsel.', for_stor: 'Forespørselen er for stor.',
  ikke_autentisert: 'Enheten er ikke (lenger) med i en husstand.', ingen_tilgang: 'Bare eieren av husstanden kan gjøre dette.',
  ikke_funnet: 'Fant ikke det du ba om.', for_mange_forespørsler: 'For mange forespørsler. Vent litt og prøv igjen.',
  ugyldig_kode: 'Koden er ugyldig, brukt eller utløpt.', enhet_finnes: 'Denne enheten er allerede med i husstanden.',
  kvote_full: 'Husstanden har nådd en grense (antall medlemmer, invitasjoner eller lagrede endringer).',
  konflikt: 'Dokumentet er endret på en annen enhet.', ugyldig_dokument: 'Dokumentet har ugyldig innhold.', serverfeil: 'Noe gikk galt på serveren.',
};
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

class HttpError extends Error { constructor(public status: number, public code: ErrorCode) { super(code); } }

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
export const normalizeCode = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');

export function createSyncApi(opts: SyncApiOptions) {
  const storage = opts.storage;
  const now = opts.now ?? (() => new Date().toISOString());
  const rnd = opts.randomBytes ?? nodeRandomBytes;
  const secret = opts.secret ?? nodeRandomBytes(32).toString('hex');
  const rates = { ...DEFAULT_RATES, ...opts.limits };
  const quotas = { ...DEFAULT_QUOTAS, ...opts.quotas };
  const skew = opts.maxFutureSkewMs ?? 10 * 60_000;
  const log = opts.log ?? ((m: string) => console.error(m));
  const ttl = opts.inviteTtlMs ?? 24 * 60 * 60 * 1000;
  const limiter = new RateLimiter();
  const codeHash = (code: string) => createHmac('sha256', secret).update(normalizeCode(code)).digest('hex');
  const newToken = () => rnd(32).toString('base64url');
  const newCode = () => {
    const b = rnd(10);
    const s = [...b].map((x) => CODE_ALPHABET[x % 32]).join(''); // 10 tegn × 5 bit = 50 bit
    return `${s.slice(0, 5)}-${s.slice(5)}`;
  };

  const clientIp = (req: IncomingMessage) => {
    const fwd = opts.trustProxy ? String(req.headers['x-forwarded-for'] ?? '').split(',').map((x) => x.trim()).filter(Boolean).pop() ?? '' : '';
    return ipKey(fwd || req.socket.remoteAddress || 'ukjent');
  };
  const limit = (key: string, max: number, windowMs: number) => {
    if (!limiter.hit(key, max, windowMs, Date.parse(now()))) throw new HttpError(429, 'for_mange_forespørsler');
  };

  async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
    const type = String(req.headers['content-type'] ?? '');
    if (!type.startsWith('application/json')) throw new HttpError(415, 'ugyldig_forespørsel');
    const declared = Number(req.headers['content-length'] ?? 0);
    if (declared > LIMITS.bodyBytes) throw new HttpError(413, 'for_stor');
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const c of req) {
      size += (c as Buffer).length;
      if (size > LIMITS.bodyBytes) throw new HttpError(413, 'for_stor');
      chunks.push(c as Buffer);
    }
    try {
      const v = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
      if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error();
      return v;
    } catch { throw new HttpError(400, 'ugyldig_forespørsel'); }
  }

  async function auth(req: IncomingMessage): Promise<DeviceRow> {
    const h = String(req.headers.authorization ?? '');
    const m = /^Bearer ([A-Za-z0-9_-]{20,100})$/.exec(h);
    if (!m) throw new HttpError(401, 'ikke_autentisert');
    const idleBefore = opts.tokenIdleMs ? new Date(Date.parse(now()) - opts.tokenIdleMs).toISOString() : undefined;
    const d = await storage.authenticate(sha256(m[1]), now(), idleBefore);
    if (!d) throw new HttpError(401, 'ikke_autentisert');
    limit(`dev:${d.id}`, rates.devicePerMin, 60_000);
    return d;
  }

  const memberInfo = (d: DeviceRow, me: DeviceRow): MemberInfo => ({
    id: d.publicId, label: d.label, role: d.role, createdAt: d.createdAt, lastSeen: d.lastSeen, me: d.id === me.id,
    ...(d.revokedAt ? { removed: true } : {}),
  });
  const docOut = (d: DocOut): DocVersion => ({ name: d.name, version: d.version, body: JSON.parse(d.body), updatedBy: d.updatedBy, updatedAt: d.updatedAt });
  const nextLabel = (members: DeviceRow[]) => `Voksen ${members.length + 1}`;
  const deviceIdOf = (body: Record<string, unknown>) => {
    if (typeof body.deviceId !== 'string' || !DEVICE_ID.test(body.deviceId)) throw new HttpError(400, 'ugyldig_forespørsel');
    return body.deviceId;
  };

  async function route(req: IncomingMessage, res: ServerResponse, url: URL): Promise<[number, unknown]> {
    const ip = clientIp(req);
    limit(`ip:${ip}`, rates.ipPerMin, 60_000);
    const method = req.method ?? 'GET';
    const path = url.pathname.replace(/\/+$/, '');
    const parts = path.split('/').slice(1); // ['api', 'household', ...]

    if (path === '/api/household' && method === 'POST') {
      limit(`create:${ip}`, rates.createPerHour, 3_600_000);
      const body = await readJson(req);
      const token = newToken();
      const d = await storage.createHousehold(randomUUID(), {
        id: randomUUID(), publicId: deviceIdOf(body), label: cleanLabel(body.label) ?? 'Voksen 1', tokenHash: sha256(token),
      }, now());
      return [201, { token, member: memberInfo(d, d) }];
    }
    if (path === '/api/household/join' && method === 'POST') {
      limit(`join:${ip}`, rates.joinPer10Min, 600_000);
      const t = Date.parse(now());
      if (limiter.count('joinfail', 600_000, t) >= rates.joinFailGlobalPer10Min) throw new HttpError(429, 'for_mange_forespørsler');
      const body = await readJson(req);
      if (typeof body.code !== 'string' || body.code.length > 40 || normalizeCode(body.code).length !== 10) throw new HttpError(400, 'ugyldig_kode');
      const token = newToken();
      const r = await storage.join(codeHash(body.code), {
        id: randomUUID(), publicId: deviceIdOf(body), label: cleanLabel(body.label) ?? '', tokenHash: sha256(token),
      }, now(), { active: quotas.activeMembers, total: quotas.totalMembers });
      if (!r.ok) {
        if (r.code === 'ugyldig_kode') limiter.hit('joinfail', Number.MAX_SAFE_INTEGER, 600_000, t);
        throw new HttpError(r.code === 'enhet_finnes' ? 409 : 403, r.code);
      }
      let device = r.device;
      if (!device.label) {
        const members = await storage.members(device.householdId);
        const label = nextLabel(members.filter((m) => m.id !== device.id));
        await storage.setLabel(device.householdId, device.id, label);
        device = { ...device, label };
      }
      return [200, { token, member: memberInfo(device, device) }];
    }

    if (parts[0] !== 'api' || (parts[1] !== 'household' && parts[1] !== 'sync')) throw new HttpError(404, 'ikke_funnet');
    const me = await auth(req);
    const hh = me.householdId;

    if (path === '/api/household' && method === 'GET') {
      const members = await storage.members(hh);
      return [200, { members: members.filter((m) => !m.revokedAt).map((m) => memberInfo(m, me)), invites: await storage.activeInvites(hh, now()) }];
    }
    if (path === '/api/household/me' && method === 'PATCH') {
      const body = await readJson(req);
      const label = cleanLabel(body.label);
      if (!label) throw new HttpError(400, 'ugyldig_forespørsel');
      await storage.setLabel(hh, me.id, label);
      return [200, { member: memberInfo({ ...me, label }, me) }];
    }
    if (path === '/api/household/invites' && method === 'POST') {
      if ((await storage.activeInvites(hh, now())).length >= quotas.activeInvites) throw new HttpError(403, 'kvote_full');
      const code = newCode();
      const expiresAt = new Date(Date.parse(now()) + ttl).toISOString();
      await storage.createInvite(hh, { id: randomUUID(), codeHash: codeHash(code), createdBy: me.id, expiresAt }, now());
      return [201, { code, expiresAt }];
    }
    if (parts[2] === 'invites' && parts.length === 4 && method === 'DELETE') {
      if (!(await storage.deleteInvite(hh, parts[3]))) throw new HttpError(404, 'ikke_funnet');
      return [204, null];
    }
    if (parts[2] === 'members' && parts.length === 4 && method === 'DELETE') {
      if (me.role !== 'eier') throw new HttpError(403, 'ingen_tilgang');
      let id: string;
      try { id = decodeURIComponent(parts[3]); } catch { throw new HttpError(400, 'ugyldig_forespørsel'); }
      const target = (await storage.members(hh)).find((m) => m.publicId === id && !m.revokedAt);
      if (!target) throw new HttpError(404, 'ikke_funnet');
      if (target.id === me.id) throw new HttpError(400, 'ugyldig_forespørsel'); // bruk «forlat»
      await storage.revoke(hh, target.id, now());
      return [204, null];
    }
    if (path === '/api/household/leave' && method === 'POST') {
      await storage.leave(hh, me.id, now());
      return [204, null];
    }
    if (path === '/api/household' && method === 'DELETE') {
      if (me.role !== 'eier') throw new HttpError(403, 'ingen_tilgang');
      await storage.deleteHousehold(hh);
      return [204, null];
    }

    if (path === '/api/sync/events' && method === 'POST') {
      const body = await readJson(req);
      const list = body.events;
      if (!Array.isArray(list) || list.length > LIMITS.batch) throw new HttpError(400, 'ugyldig_forespørsel');
      // Hendelser kan ikke utgi seg for å være fra et annet medlem av husstanden.
      const others = new Set((await storage.members(hh)).filter((m) => m.id !== me.id).map((m) => m.publicId));
      const ok: { stream: Stream; id: string; by: string; body: string }[] = [];
      const rejected: { id: string; code: string }[] = [];
      const received = Date.parse(now());
      for (const x of list) {
        const id = typeof x?.event?.id === 'string' ? (x.event.id as string).slice(0, 100) : '';
        const err = checkEnvelope(x) ?? (others.has(x.event.by) ? 'feil_identitet' : null);
        if (err) { rejected.push({ id, code: err }); continue; }
        // Klientens klokke bestemmer rekkefølgen (inventory.ts sorterer på at, id). Et ugyldig tidspunkt avvises; et
        // tidspunkt langt fram i tid (feil klokke eller med vilje) ville ligget sist i loggen for alltid og overstyrt
        // senere tellinger og valg, så det settes til mottakstidspunktet. Tilbakedatering er lov (frakoblede enheter og
        // migrerte data med tid 1970).
        const at = Date.parse(x.event.at);
        if (!Number.isFinite(at) || new Date(at).toISOString().slice(0, 19) !== x.event.at.slice(0, 19)) {
          rejected.push({ id, code: 'ugyldig_hendelse' }); continue;
        }
        const event = at > received + skew ? { ...x.event, at: new Date(received).toISOString() } : x.event;
        ok.push({ stream: x.stream, id: event.id, by: event.by, body: JSON.stringify(event) });
      }
      let accepted: string[] = [];
      try {
        accepted = ok.length ? await storage.appendEvents(hh, me.id, ok, now(), { events: quotas.events, bytes: quotas.eventBytes }) : [];
      } catch (e) {
        // Hele kallet avvises, så hendelsene blir liggende i enhetens utboks til det er plass.
        if (e instanceof QuotaExceededError) throw new HttpError(403, 'kvote_full');
        throw e;
      }
      return [200, { accepted, rejected }];
    }
    if (path === '/api/sync' && method === 'GET') {
      const raw = url.searchParams.get('after') ?? '0';
      if (!/^\d{1,15}$/.test(raw)) throw new HttpError(400, 'ugyldig_forespørsel');
      const r = await storage.readSince(hh, Number(raw), LIMITS.pullPage);
      const members = await storage.members(hh);
      const events: StoredEnvelope[] = r.events.map((e) => ({ seq: e.seq, stream: e.stream, event: JSON.parse(e.body) }));
      return [200, { cursor: r.cursor, more: r.more, events, docs: r.docs.map(docOut), members: members.map((m) => memberInfo(m, me)) }];
    }
    if (parts[2] === 'docs' && parts.length === 4 && method === 'PUT') {
      const name = parts[3] as DocName;
      if (!DOC_NAMES.includes(name)) throw new HttpError(404, 'ikke_funnet');
      const body = await readJson(req);
      if (!Number.isInteger(body.baseVersion) || (body.baseVersion as number) < 0) throw new HttpError(400, 'ugyldig_forespørsel');
      if (!isValidDoc(name, body.body)) throw new HttpError(400, 'ugyldig_dokument');
      const text = stable(body.body);
      if (text.length > LIMITS.docBytes) throw new HttpError(413, 'for_stor');
      const r = await storage.putDoc(hh, name, body.baseVersion as number, text, me.publicId, now());
      if (!r.ok) {
        res.setHeader('X-Conflict', '1');
        return [409, { error: 'konflikt', message: MESSAGES.konflikt, current: r.current ? docOut(r.current) : null }];
      }
      return [200, { version: r.version }];
    }
    throw new HttpError(404, 'ikke_funnet');
  }

  /** Håndterer /api/household* og /api/sync*. Returnerer false for andre stier. */
  return async function handle(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    let url: URL;
    try { url = new URL(req.url ?? '/', 'http://localhost'); } catch { return false; }
    if (!/^\/api\/(household|sync)(\/|$)/.test(url.pathname)) return false;
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    let status = 500;
    let payload: unknown;
    try {
      [status, payload] = await route(req, res, url);
    } catch (e) {
      if (e instanceof HttpError) { status = e.status; payload = { error: e.code, message: MESSAGES[e.code] }; }
      else {
        // Bare navnet på feilen: meldinger kan inneholde verdier fra forespørselen.
        status = 500; payload = { error: 'serverfeil', message: MESSAGES.serverfeil };
        log(`synk-feil: ${e instanceof Error ? e.name : typeof e}`);
      }
    }
    res.statusCode = status;
    if (status === 204) { res.end(); return true; }
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(payload));
    return true;
  };
}
