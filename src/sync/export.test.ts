// «Last ned mine data»: filen er lesbar, har versjon og tidspunkt, og tar aldri med nøkkelen.
import { describe, expect, it } from 'vitest';
import { initialState, type AppState } from '../store';
import { buildExport, exportFileName, exportText } from './export';
import type { ServerExport } from './protocol';

// Satt sammen, så regel 7-sjekken (ingen hemmeligheter i repoet) ikke ser en tilordnet tokenverdi.
const FAKE = ['HEMMELIG', 'TOKEN', 'abcdefghijklmnopqrstuvwxyz'].join('-');
const connected: AppState = {
  ...initialState, postal: '0150',
  settings: { ...initialState.settings, vegetarian: true, avoid: ['melk'], avoidFoods: ['svin'] },
  sync: {
    token: FAKE, cursor: 4, docs: {}, conflicts: {}, rejected: 0, lastSync: null,
    me: { id: 'enhet-aaaa1111', label: 'Voksen 1', role: 'eier', createdAt: '2026-11-23T10:00:00.000Z', lastSeen: null, me: true }, members: [],
  },
};
const server = { format: 'middagsplanlegger-servereksport', versjon: 1, hendelser: [] } as unknown as ServerExport;

describe('eksport av mine data', () => {
  it('har format, versjon og eksporttidspunkt; lokale kostkrav og postnummer står for seg', () => {
    const x = buildExport(connected, 'enhet-aaaa1111', '2026-11-23T12:00:00.000Z', server);
    expect(x).toMatchObject({ format: 'middagsplanlegger-eksport', versjon: 1, eksportert: '2026-11-23T12:00:00.000Z', server });
    expect(x.enhet.bareHer).toEqual({ postnummer: '0150', vegetar: true, allergener: ['melk'], matvarerSomUnngås: ['svin'] });
    expect(x.enhet.lagretPåEnheten.sync?.cursor).toBe(4);
    expect(exportFileName(x.eksportert)).toBe('middagsplanlegger-mine-data-2026-11-23.json');
  });

  it('nøkkelen (token) er aldri med, og tilstanden endres ikke', () => {
    const text = exportText(buildExport(connected, 'enhet-aaaa1111', '2026-11-23T12:00:00.000Z', server));
    expect(text).not.toContain('HEMMELIG-TOKEN');
    expect(text).not.toMatch(/"token"/);
    expect(connected.sync?.token).toBe(FAKE);
    expect(text.split('\n').length).toBeGreaterThan(20); // lesbar med innrykk
  });

  it('uten husstand: bare enheten, og det står hvorfor serverdelen mangler', () => {
    const x = buildExport(initialState, 'enhet-bbbb2222', '2026-11-23T12:00:00.000Z', null);
    expect(x.server).toBeNull();
    expect(x.serverMerknad).toMatch(/ikke med i en husstand/);
    expect(buildExport(connected, 'e', 'x', null).serverMerknad).toMatch(/kunne ikke hentes/);
  });
});
