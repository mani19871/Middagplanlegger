import { useEffect, useState } from 'react';
import { fetchPages, fetchPapers, type PagesResponse, type PapersResponse } from '../../offers/client';
import type { Catalog } from '../../offers/types';
import { credit, IMAGE_NOTE, pageAlt, periodText } from './paperText';

/**
 * «Aviser fra Tjek»: ekte kundeaviser (ikke demodata) fra Tjek, slik brukeren opplyser at avtalen tillater (2026-11-22).
 * Lista er tekst; sidene (bilder hos Tjek) lastes først når brukeren åpner en avis. Ingenting lagres i appen.
 */
export default function TjekPapers({ resetKey = 0 }: { resetKey?: number }) {
  const [list, setList] = useState<PapersResponse | null>(null);
  const [err, setErr] = useState(false);
  const [open, setOpen] = useState<Catalog | null>(null);
  useEffect(() => { if (resetKey > 0) setOpen(null); }, [resetKey]);
  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      try {
        const r = await fetchPapers();
        if (stop) return;
        setList(r); setErr(false);
        if (r.status === 'loading') timer = setTimeout(load, 4000);
      } catch { if (!stop) setErr(true); }
    };
    load();
    return () => { stop = true; clearTimeout(timer); };
  }, []);

  if (open) return <Reader catalog={open} imagesAllowed={!!list?.imagesAllowed} onBack={() => setOpen(null)} />;
  return (
    <>
      {err && <div className="banner warn">Fikk ikke kontakt med tilbudsserveren. Se «Aviser (demo)» eller prøv igjen senere.</div>}
      {!err && (!list || list.status === 'loading') && <p className="card">Henter kundeaviser fra Tjek …</p>}
      {list?.status === 'error' && <div className="banner warn">{list.error}</div>}
      {list?.status === 'ok' && (
        <p className="fine" role="status">{credit(list.observed)} (ekte kundeaviser, ikke demodata). {list.catalogs.length} aviser denne og neste uke.
          {list.imagesAllowed ? '' : ' Avissidene kan ikke vises ennå: bildeverten er ikke satt opp på serveren.'}</p>
      )}
      {list?.status === 'ok' && list.catalogs.length === 0 && <p className="card">Ingen kundeaviser akkurat nå.</p>}
      <div className="covers">
        {list?.catalogs.map((c) => (
          <button key={c.id} className="ecard" onClick={() => setOpen(c)} aria-label={`${c.dealerName}${c.label ? `, ${c.label}` : ''}, ${periodText(c)}`}>
            <span className="cvr tjek"><b>{c.dealerName}</b><small>{c.label ?? 'Kundeavis'}</small></span>
            <span className="cap"><span>{periodText(c)}<br /><small>{c.pageCount ? `${c.pageCount} sider · ` : ''}Tjek</small></span><span aria-hidden>›</span></span>
          </button>
        ))}
      </div>
    </>
  );
}

/** Én avis: én side om gangen, forrige/neste, kreditering med dato. Bildet lastes fra Tjek (ingen kopi hos oss). */
function Reader({ catalog, imagesAllowed, onBack }: { catalog: Catalog; imagesAllowed: boolean; onBack: () => void }) {
  const [data, setData] = useState<PagesResponse | null>(null);
  const [err, setErr] = useState(false);
  const [n, setN] = useState(1);
  useEffect(() => {
    const ac = new AbortController();
    fetchPages(catalog.id, ac.signal).then((r) => { setData(r); setErr(false); }).catch(() => { if (!ac.signal.aborted) setErr(true); });
    return () => ac.abort();
  }, [catalog.id]);
  const pages = data?.pages ?? [];
  const total = pages.length || catalog.pageCount;
  const page = pages[n - 1];
  return (
    <>
      <div className="pagehead"><button className="x" aria-label="Tilbake" onClick={onBack}>←</button>
        <div className="center"><h2>{catalog.dealerName}</h2><small className="fine">{catalog.label ?? 'Kundeavis'} · {periodText(catalog)}</small></div><span /></div>
      {err && <div className="banner warn">Fikk ikke hentet avissidene. Prøv igjen senere.</div>}
      {!err && !data && <p className="card">Henter avissidene fra Tjek …</p>}
      {data?.status === 'error' && <div className="banner warn">{data.error}</div>}
      {data?.status === 'ok' && !imagesAllowed && <p className="card">Avissidene kan ikke vises ennå: bildeverten hos Tjek er ikke satt opp på serveren (TJEK_IMAGE_HOSTS).</p>}
      {data?.status === 'ok' && imagesAllowed && pages.length === 0 && <p className="card">Tjek har ingen sider for denne avisen.</p>}
      {page && (
        <figure className="paperpage">
          {page.view ?? page.thumb
            ? <img src={(page.view ?? page.thumb)!} alt={pageAlt(catalog, n, total)} referrerPolicy="no-referrer" decoding="async" />
            : <p className="card">Side {n} kan ikke vises (bildeadressen er ikke fra en tillatt vert).</p>}
          <figcaption className="fine">{pageAlt(catalog, n, total)}. {credit(data?.observed)}.</figcaption>
        </figure>
      )}
      {pages.length > 1 && (
        <div className="row-field" role="group" aria-label="Bla i avisen">
          <button className="ghost" disabled={n <= 1} onClick={() => setN((x) => Math.max(1, x - 1))}>← Forrige</button>
          <span className="fine" aria-live="polite">Side {n} av {pages.length}</span>
          <button className="ghost" disabled={n >= pages.length} onClick={() => setN((x) => Math.min(pages.length, x + 1))}>Neste →</button>
        </div>
      )}
      <p className="fine">Ekte kundeavis fra Tjek, ikke demodata. Tilbud i avisen regnes ikke inn i summen; bruk «Tilbud nå» for tilbud koblet til varer. {IMAGE_NOTE}</p>
    </>
  );
}
