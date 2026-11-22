// Testhjelp: synk-serveren på en tilfeldig port med minnedatabase og styrbar klokke.
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { SqliteStorage } from '../storage/sqlite';
import { createSyncApi, type SyncApiOptions } from './api';

export async function startTestServer(opts: Partial<SyncApiOptions> & { storage?: SqliteStorage; port?: number } = {}) {
  const storage = opts.storage ?? new SqliteStorage(':memory:');
  let clock = Date.parse('2026-11-23T10:00:00.000Z');
  const handle = createSyncApi({
    storage, now: () => new Date(clock).toISOString(), secret: 'testhemmelighet',
    limits: { ipPerMin: 100_000, devicePerMin: 100_000, createPerHour: 1000, createGlobalPerHour: 100_000, joinPer10Min: 1000 }, ...opts,
  });
  const server = createServer(async (req, res) => {
    if (!(await handle(req, res))) { res.statusCode = 404; res.end(); }
  });
  await new Promise<void>((r) => server.listen(opts.port ?? 0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return {
    storage, base,
    advance: (ms: number) => { clock += ms; },
    now: () => new Date(clock).toISOString(),
    close: () => new Promise<void>((r) => { server.closeAllConnections(); server.close(() => r()); }),
  };
}
