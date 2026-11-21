import { describe, expect, it } from 'vitest';
import { initialState, migrateState, recordEvent } from './store';
import { deriveStock, type InventoryEvent } from './engine/inventory';

describe('lagring: beholdningshendelser', () => {
  it('gammel pantry flyttes til tellinger én gang, også ved ny innlasting', () => {
    const old = { ...initialState, settings: { ...initialState.settings, pantry: { pasta: 400, ris: 0 } }, inventory: undefined, outbox: undefined } as never;
    const once = migrateState(old);
    expect(once.settings.pantry).toEqual({});
    expect(deriveStock(once.inventory).total).toEqual({ pasta: 400 });
    const again = migrateState({ ...once, settings: { ...once.settings, pantry: { pasta: 400 } } });
    expect(again.inventory).toHaveLength(1);
    expect(again.outbox).toHaveLength(1);
  });
  it('en hendelse som finnes fra før gir ingen endring i logg eller utboks', () => {
    const e: InventoryEvent = { type: 'telling', id: 'x', at: '2026-11-23T10:00:00.000Z', by: 'A', ingredient: 'pasta', amount: 100 };
    const a = recordEvent(initialState, e);
    expect(recordEvent(a, e)).toBe(a);
    expect(a.inventory).toHaveLength(1);
    expect(a.outbox).toHaveLength(1);
  });
});
