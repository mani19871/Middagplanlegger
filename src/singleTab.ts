// Én aktiv fane (V7 i docs/kodegjennomgang.md). Hver fane skriver hele AppState til samme localStorage-nøkkel, så to åpne
// faner kan slette hverandres usendte utboks. Med Web Locks holder bare én fane låsen og viser appen; de andre viser
// «Husvett er åpen i en annen fane» og skriver ingenting. «Bruk her» tar låsen (steal), og den andre fanen stopper.
// Lukkes den aktive fanen, tar en ventende fane over av seg selv. Uten Web Locks (eldre nettleser) virker appen som før.

export const TAB_LOCK = 'middag-aktiv-fane';

export type TabRole = 'sjekker' | 'aktiv' | 'passiv';

/** Den delen av LockManager vi bruker (navigator.locks). Injiseres i tester. */
export interface Locks {
  request(name: string, options: { ifAvailable?: boolean; steal?: boolean; signal?: AbortSignal },
    callback: (lock: unknown) => unknown): Promise<unknown>;
}

export function browserLocks(): Locks | null {
  const l = typeof navigator === 'undefined' ? undefined : (navigator as unknown as { locks?: Locks }).locks;
  return l && typeof l.request === 'function' ? l : null;
}

/**
 * Starter vaktposten for fanen. `onRole` kalles hver gang fanen blir aktiv eller passiv.
 * Gir `takeOver` (gjør denne fanen aktiv, den andre blir passiv) og `stop` (slipper låsen og alle ventende forespørsler).
 */
export function startTabGuard(locks: Locks | null, onRole: (r: TabRole) => void): { takeOver(): void; stop(): void } {
  if (!locks) { onRole('aktiv'); return { takeOver() {}, stop() {} }; }
  let stopped = false;
  let waiting: AbortController | null = null; // ventende forespørsel i kø
  let release: (() => void) | null = null; // slipper låsen vi holder
  const set = (r: TabRole) => { if (!stopped) onRole(r); };

  /** Låsen er vår: hold den til fanen lukkes, til den blir tatt, eller til stop(). */
  const hold = () => {
    set('aktiv');
    return new Promise<void>((res) => { release = res; });
  };
  /** Låsen ble tatt av en annen fane (eller forespørselen ble avbrutt): bli passiv og vent i kø. */
  const lost = () => { release = null; if (!stopped) { set('passiv'); queue(); } };
  const queue = () => {
    if (stopped || waiting) return;
    const ctrl = new AbortController();
    waiting = ctrl;
    locks.request(TAB_LOCK, { signal: ctrl.signal }, () => { if (waiting === ctrl) waiting = null; return hold(); })
      .then(() => {}, () => { if (waiting === ctrl) { waiting = null; } if (!ctrl.signal.aborted) lost(); });
  };

  locks.request(TAB_LOCK, { ifAvailable: true }, (lock) => {
    if (!lock) { set('passiv'); queue(); return undefined; }
    return hold();
  }).then(() => {}, lost);

  return {
    takeOver() {
      if (stopped || release) return;
      waiting?.abort(); waiting = null;
      locks.request(TAB_LOCK, { steal: true }, () => hold()).then(() => {}, lost);
    },
    stop() {
      stopped = true;
      waiting?.abort(); waiting = null;
      release?.(); release = null;
    },
  };
}

/** Teksten i fanen som ikke er aktiv. */
export function otherTabText(): string {
  return 'Husvett er åpen i en annen fane eller et annet vindu. Appen brukes i én fane om gangen, så ingen endringer går tapt.';
}
