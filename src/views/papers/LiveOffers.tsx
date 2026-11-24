import { useEffect, useMemo, useState } from 'react';
import type { LiveResponse } from '../../offers/client';
import type { LiveOffer } from '../../offers/service';
import { amount, kr, num } from '../../engine/format';
import { osloDate } from '../../engine/oslo';
import { ING_EMOJI } from '../art';
import { filterOffers, groupOffers, pageGroups, PAGE_SIZE, type GroupBy } from './offerList';

interface Props {
  live: LiveResponse | null; err: boolean; ingName: (id: string) => string; onPick: (l: LiveOffer) => void;
}
const dm = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.`;
const when = (iso: string) => new Date(iso).toLocaleString('nb-NO', { dateStyle: 'short', timeStyle: 'short' });
/** Kildelinje: kilde, når tilbudene sist ble hentet, og eldste observasjon når lagrede tilbud er sett tidligere. */
export function sourceLine(live: LiveResponse): string {
  const read = live.observed ? when(live.observed) : 'ukjent tid';
  if (!live.stored) return `Kilde: Tjek (ekte tilbud, ikke demodata). Lest ${read}.`;
  const oldest = live.oldestObserved && live.observed && (osloDate(live.oldestObserved) ?? '') < (osloDate(live.observed) ?? '')
    ? ` Noen priser ble sist sett ${when(live.oldestObserved)}.` : '';
  return `Kilde: Tjek (ekte tilbud, ikke demodata). Sist hentet ${read}.${oldest}`;
}

/**
 * «Tilbud nå»: tilbud fra Tjek, gruppert per kjede eller vare, med søk og «Vis flere». Lagret på serveren når den har dem
 * (/api/offers/lagret), ellers live. Lagres aldri i appen og synkes ikke. Datoen er når prisen ble sett hos Tjek.
 */
export default function LiveOffers({ live, err, ingName, onPick }: Props) {
  const [q, setQ] = useState('');
  const [by, setBy] = useState<GroupBy>('kjede');
  const [visible, setVisible] = useState(PAGE_SIZE);
  useEffect(() => setVisible(PAGE_SIZE), [q, by]);
  const filtered = useMemo(() => filterOffers(live?.offers ?? [], q, ingName), [live, q, ingName]);
  const page = useMemo(() => pageGroups(groupOffers(filtered, by, ingName), visible), [filtered, by, ingName, visible]);
  return (
    <>
      <div className="row-field"><input style={{ flex: 1, width: 'auto' }} aria-label="Søk i tilbud" placeholder="🔍 Søk i tilbud" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="chips tabs" role="group" aria-label="Grupper tilbud">
        <button className={by === 'kjede' ? 'chip on' : 'chip'} aria-pressed={by === 'kjede'} onClick={() => setBy('kjede')}>Per kjede</button>
        <button className={by === 'vare' ? 'chip on' : 'chip'} aria-pressed={by === 'vare'} onClick={() => setBy('vare')}>Per vare</button>
      </div>
      {err && <div className="banner warn">Fikk ikke kontakt med tilbudsserveren. Start den med <code>npm run server</code>, eller se «Aviser (demo)».</div>}
      {!err && (!live || live.status === 'loading') && <p className="card">Henter tilbud … det kan ta et halvt minutt første gang.</p>}
      {live?.status === 'error' && <div className="banner warn">Tilbudskilden svarte ikke ({live.error}). Prøver igjen ved neste besøk.</div>}
      {live?.status === 'ok' && (
        <p className="fine" role="status">{sourceLine(live)}
          {' '}Viser {page.shown} av {page.total} tilbud koblet til varer i oppskriftene{q.trim() ? ` (søk: «${q.trim()}»)` : ''}. Tilbud regnes ikke inn i summen før vilkår er kontrollert.{live.truncated ? ' Ikke alle tilbud fikk plass.' : ''}</p>
      )}
      {live?.status === 'ok' && page.total === 0 && <p className="card">Ingen tilbud passer søket.</p>}
      {page.groups.map((g) => (
        <section key={g.key} className="offergroup" aria-label={g.label}>
          <h3>{g.label} <small className="fine">({g.items.length})</small></h3>
          <div className="tiles">
            {g.items.map((l) => (
              <button key={l.offer.id} className="tile" onClick={() => onPick(l)}>
                <span className="bigemoji" aria-hidden>{ING_EMOJI[l.ingredient] ?? '🛒'}</span>
                <b>{l.offer.heading}</b><small>{by === 'kjede' ? ingName(l.ingredient) : l.offer.dealerName}</small>
                <span className="price">{l.offer.priceOre !== null ? kr(l.offer.priceOre) : 'Pris ukjent'}</span>
                <small>{l.offer.amount ? amount(l.offer.amount, l.offer.unit ?? 'g') : l.offer.pieces && l.unitPriceOre !== null ? amount(l.offer.pieces, 'stk') : 'mengde ukjent'}{l.unitPriceOre === null ? '' : l.offer.unit ? ` · ${kr(l.unitPriceOre)}/${l.offer.unit === 'g' ? 'kg' : 'l'}` : ` · ${num(l.unitPriceOre / 100, 2)} kr/stk`}</small>
                <small>{l.phase === 'nå' ? `til ${dm(l.offer.validUntil)}` : `fra ${dm(l.offer.validFrom)}`}{l.needsReview ? ' · må kontrolleres' : ''}</small>
                <span className="plus" aria-hidden>＋</span></button>
            ))}
          </div>
        </section>
      ))}
      {page.shown < page.total && (
        <button className="ghost wide" onClick={() => setVisible((v) => v + PAGE_SIZE)}>Vis flere ({page.total - page.shown} igjen)</button>
      )}
    </>
  );
}
