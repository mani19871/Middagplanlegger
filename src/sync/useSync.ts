// Bakgrunnssynk i appen: polling hvert 10. sekund når appen er synlig, rett etter lokale endringer, og når nettet
// kommer tilbake. Feil gir eksponentiell backoff (2 s → 5 min). Ingen WebSocket eller SSE.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AppState } from '../store';
import { SyncApi } from './api';
import { pendingCount, syncOnce, type SyncIO } from './engine';

const POLL_MS = 10_000;
const MAX_BACKOFF_MS = 5 * 60_000;

export interface SyncRuntime { offline: boolean; busy: boolean; lastError: string | null; syncNow: () => void }

export function useSync(state: AppState, update: (f: (s: AppState) => AppState) => void, api: SyncApi = defaultApi): SyncRuntime {
  const ref = useRef(state);
  ref.current = state;
  const [offline, setOffline] = useState(() => typeof navigator !== 'undefined' && navigator.onLine === false);
  const [busy, setBusy] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const running = useRef(false);
  const again = useRef(false);
  const failures = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateRef = useRef(update);
  updateRef.current = update;
  const io: SyncIO = useMemo(() => ({
    get: () => ref.current,
    // Oppdaterer speilet med en gang (så neste steg i runden ser endringen) og React-tilstanden.
    set: (f) => { ref.current = f(ref.current); updateRef.current(f); },
  }), []);

  const schedule = useCallback((ms: number, run: () => void) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(run, ms);
  }, []);

  const run = useCallback(async () => {
    if (!ref.current.sync) return;
    if (running.current) { again.current = true; return; }
    running.current = true; setBusy(true);
    const r = await syncOnce(io, api, () => new Date().toISOString());
    running.current = false; setBusy(false);
    if (r.ok) {
      failures.current = 0; setOffline(false); setLastError(r.error ?? null);
    } else {
      failures.current += 1; setOffline(r.offline); setLastError(r.error ?? null);
    }
    if (again.current) { again.current = false; schedule(0, () => void run()); return; }
    if (!ref.current.sync) return;
    const delay = r.ok ? POLL_MS
      : Math.min(MAX_BACKOFF_MS, 2000 * 2 ** Math.min(failures.current - 1, 10)) * (0.75 + Math.random() * 0.5);
    schedule(delay, () => { if (document.visibilityState === 'visible') void run(); else schedule(POLL_MS, () => void run()); });
  }, [io, api, schedule]);

  // Lokale endringer (utboks eller dokumenter) synkes etter en kort pause.
  const pending = pendingCount(state);
  const connected = !!state.sync;
  const token = state.sync?.token;
  useEffect(() => {
    if (connected) { failures.current = 0; schedule(0, () => void run()); }
  }, [connected, token, run, schedule]);
  useEffect(() => {
    // Under backoff venter vi; nettstatus-hendelser eller neste forsøk tar det med.
    if (connected && pending > 0 && failures.current === 0) schedule(400, () => void run());
  }, [pending, connected, run, schedule]);

  useEffect(() => {
    const online = () => { failures.current = 0; setOffline(false); void run(); };
    const off = () => setOffline(true);
    const vis = () => { if (document.visibilityState === 'visible') void run(); };
    window.addEventListener('online', online);
    window.addEventListener('offline', off);
    document.addEventListener('visibilitychange', vis);
    return () => {
      window.removeEventListener('online', online); window.removeEventListener('offline', off);
      document.removeEventListener('visibilitychange', vis);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [run]);

  return { offline, busy, lastError, syncNow: () => { failures.current = 0; void run(); } };
}

export const defaultApi = new SyncApi('', (url, init) => fetch(url, init));
