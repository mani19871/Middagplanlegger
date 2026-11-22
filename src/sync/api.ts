// HTTP-klient for synk-API-et (server/sync/api.ts). `fetch` settes inn, så den kan testes mot en ekte server.
import type { DocBody, DocName } from './docs';
import type {
  DocVersion, Envelope, HouseholdResponse, InviteResponse, JoinResponse, MemberInfo, PushResponse, SyncResponse,
} from './protocol';
import type { EventTransport } from './queue';

export type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

/** Feil fra synk-API-et. status 0 betyr at serveren ikke kunne nås (ingen nett). */
export class SyncError extends Error {
  constructor(public status: number, public code: string, message?: string, public current?: DocVersion | null) { super(message ?? code); }
  get offline() { return this.status === 0 || this.status >= 500 || this.status === 429; }
  get unauthorized() { return this.status === 401; }
}

export const ERROR_TEXT: Record<string, string> = {
  nett: 'Fikk ikke kontakt med serveren.', ugyldig_kode: 'Koden er ugyldig, brukt eller utløpt.',
  enhet_finnes: 'Denne enheten er allerede med i husstanden.', ingen_tilgang: 'Bare eieren av husstanden kan gjøre dette.',
  for_mange_forespørsler: 'For mange forsøk. Vent litt og prøv igjen.', ikke_autentisert: 'Enheten er ikke lenger med i husstanden.',
};

export class SyncApi {
  constructor(private base: string, private fetchFn: Fetch, private token: string | null = null) {}
  withToken(token: string) { return new SyncApi(this.base, this.fetchFn, token); }

  private async call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    let res: Response;
    try {
      res = await this.fetchFn(`${this.base}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store' });
    } catch {
      throw new SyncError(0, 'nett', ERROR_TEXT.nett);
    }
    if (res.status === 204) return undefined as T;
    let data: Record<string, unknown> = {};
    try { data = await res.json(); } catch { if (res.ok) throw new SyncError(502, 'ugyldig_svar'); }
    if (!res.ok) {
      const code = typeof data.error === 'string' ? data.error : 'ukjent';
      throw new SyncError(res.status, code, ERROR_TEXT[code] ?? (typeof data.message === 'string' ? data.message : code), data.current as DocVersion | null | undefined);
    }
    return data as T;
  }

  createHousehold(deviceId: string, label?: string) { return this.call<JoinResponse>('POST', '/api/household', { deviceId, label }); }
  join(code: string, deviceId: string, label?: string) { return this.call<JoinResponse>('POST', '/api/household/join', { code, deviceId, label }); }
  household() { return this.call<HouseholdResponse>('GET', '/api/household'); }
  setLabel(label: string) { return this.call<{ member: MemberInfo }>('PATCH', '/api/household/me', { label }); }
  invite() { return this.call<InviteResponse>('POST', '/api/household/invites', {}); }
  deleteInvite(id: string) { return this.call<void>('DELETE', `/api/household/invites/${encodeURIComponent(id)}`); }
  removeMember(id: string) { return this.call<void>('DELETE', `/api/household/members/${encodeURIComponent(id)}`); }
  leave() { return this.call<void>('POST', '/api/household/leave', {}); }
  deleteHousehold() { return this.call<void>('DELETE', '/api/household'); }
  push(events: Envelope[]) { return this.call<PushResponse>('POST', '/api/sync/events', { events }); }
  pull(after: number) { return this.call<SyncResponse>('GET', `/api/sync?after=${after}`); }
  putDoc(name: DocName, baseVersion: number, body: DocBody) { return this.call<{ version: number }>('PUT', `/api/sync/docs/${name}`, { baseVersion, body }); }
}

/** Utboks-transport mot serveren. Avviste hendelser regnes som levert (de vil aldri bli godtatt) og telles separat. */
export class HttpTransport implements EventTransport<Envelope & { id: string }> {
  rejected: { id: string; code: string }[] = [];
  constructor(private api: SyncApi) {}
  async push(events: (Envelope & { id: string })[]): Promise<string[]> {
    const r = await this.api.push(events.map(({ stream, event }) => ({ stream, event }) as Envelope));
    this.rejected.push(...r.rejected);
    return [...r.accepted, ...r.rejected.map((x) => x.id)];
  }
}
