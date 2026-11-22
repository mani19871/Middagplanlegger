import { describe, expect, it } from 'vitest';
import { applyListEvent, applyListEvents, checks, isValidListEvent, manualLines, toggleEvent, type ListEvent } from './list';

const W = '2026-11-23';
const s = (id: string, by = 'A', at = `2026-11-23T10:00:0${id.length % 10}.000Z`) => ({ id, at, by });
describe('delt handleliste', () => {
  it('samme hendelse to ganger gir én rad', () => {
    const e: ListEvent = { type: 'kryss', ...s('k1'), week: W, key: 'x' };
    const once = applyListEvent([], e);
    expect(applyListEvent(once, e)).toBe(once);
  });
  it('tilstanden er uavhengig av rekkefølgen hendelsene kommer i', () => {
    const evs: ListEvent[] = [
      { type: 'kryss', ...s('k1', 'A'), week: W, key: 'x' },
      { type: 'kryss', ...s('k2', 'B'), week: W, key: 'x' },
      { type: 'avkryss', ...s('u1', 'A'), week: W, key: 'x', seen: ['k1'] },
      { type: 'manuell', ...s('m1'), line: { id: 'l1', text: 'Torsk', note: '' } },
      { type: 'manuell-fjern', ...s('m2'), lineId: 'l1' },
    ];
    const fwd = applyListEvents([], evs), rev = applyListEvents([], [...evs].reverse());
    expect(checks(fwd, W)).toEqual(checks(rev, W));
    expect(checks(fwd, W).get('x')!.map((m) => m.by)).toEqual(['B']);
    expect(manualLines(fwd)).toEqual([]);
    expect(manualLines(rev)).toEqual([]);
  });
  it('trykk på avkrysset linje fjerner alle synlige kryss; avkrysninger gjelder én uke', () => {
    let log = applyListEvents([], [{ type: 'kryss', ...s('k1', 'A'), week: W, key: 'x' }, { type: 'kryss', ...s('k2', 'B'), week: W, key: 'x' }]);
    const t = toggleEvent(log, W, 'x', s('t1', 'A'));
    expect(t).toMatchObject({ type: 'avkryss', seen: ['k1', 'k2'] });
    log = applyListEvent(log, t);
    expect(checks(log, W).has('x')).toBe(false);
    expect(checks(log, '2026-11-30').size).toBe(0);
  });
  it('avviser ugyldige hendelser', () => {
    expect(isValidListEvent({ type: 'kryss', ...s('k'), week: 'uke 48', key: 'x' } as ListEvent)).toBe(false);
    expect(isValidListEvent({ type: 'avkryss', ...s('k'), week: W, key: 'x', seen: 'k1' } as never)).toBe(false);
    expect(isValidListEvent({ type: 'manuell', ...s('k'), line: { id: 'l', text: '', note: '' } })).toBe(false);
    expect(isValidListEvent({ type: 'slett-alt', ...s('k') } as never)).toBe(false);
  });
});
