import { describe, expect, it } from 'vitest';
import { ingredients, recipes } from '../data/catalog';
import { EMOJI, ING_EMOJI } from './art';

describe('emoji-miniatyrer', () => {
  it('alle retter og alle ingredienser har en emoji, og rettene er ikke like', () => {
    for (const r of recipes) expect(EMOJI[r.id], `rett ${r.id}`).toBeTruthy();
    for (const i of ingredients) expect(ING_EMOJI[i.id], `ingrediens ${i.id}`).toBeTruthy();
    expect(Object.values(EMOJI)).not.toContain('🍽️');
  });
});
