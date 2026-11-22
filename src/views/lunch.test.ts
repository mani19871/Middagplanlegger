import { describe, expect, it } from 'vitest';
import { isValidDoc } from '../sync/docs';
import { initialState, migrateState } from '../store';
import { lunchDay } from './lunch';

const slot = (day: number) => ({ day, recipeId: 'bolognese', locked: false });

describe('matpakke: dagen den ekstra porsjonen er til', () => {
  it('er neste planlagte dag, ellers dagen etter, men aldri utenfor uka (0–6)', () => {
    expect(lunchDay([slot(0), slot(2)], 0)).toBe(2);
    expect(lunchDay([slot(0), slot(2)], 2)).toBe(3);
    expect(lunchDay([slot(0), slot(6)], 6)).toBeUndefined(); // søndag: «Senere», ikke dag 7
  });
  it('eldre lagret plan med matpakke til dag 7 ryddes ved innlasting, så planen kan synkes igjen', () => {
    const old = { ...initialState, slots: [{ ...slot(6), extra: 1, extraFor: 7 }] };
    const s = migrateState(old);
    expect(s.slots[0]).toMatchObject({ day: 6, extra: 1 });
    expect(s.slots[0].extraFor).toBeUndefined();
    expect(isValidDoc('plan', { slots: s.slots, approved: s.approved, option: s.option })).toBe(true);
  });
});
