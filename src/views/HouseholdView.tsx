import { useEffect, useState } from 'react';
import { deviceId, initialState, type AppState } from '../store';
import { SyncError } from '../sync/api';
import { defaultApi } from '../sync/useSync';
import { connect, disconnect, resolveConflict } from '../sync/engine';
import { fieldText, type DocName } from '../sync/docs';
import type { HouseholdResponse, InviteResponse } from '../sync/protocol';
import { whoLabel } from '../sync/labels';
import type { SyncRuntime } from '../sync/useSync';
import type { SyncStatus } from '../sync/engine';

interface Props {
  state: AppState; update: (f: (s: AppState) => AppState) => void; runtime: SyncRuntime; status: SyncStatus;
  statusText: string; purchaseConflicts: number; initialCode: string; openList: () => void;
}
const DOC_TEXT: Record<DocName, string> = { plan: 'Ukeplanen', innstillinger: 'Innstillingene' };
const time = (iso: string | null) => (iso ? new Date(iso).toLocaleString('nb-NO', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'aldri');
const errText = (e: unknown) => (e instanceof SyncError ? e.message : 'Noe gikk galt. Prøv igjen.');

export default function HouseholdView({ state, update, runtime, status, statusText, purchaseConflicts, initialCode, openList }: Props) {
  const sync = state.sync;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [code, setCode] = useState(initialCode);
  const [info, setInfo] = useState<HouseholdResponse | null>(null);
  const [invite, setInvite] = useState<InviteResponse | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState('');
  const [wipeLocal, setWipeLocal] = useState(false);
  const [copied, setCopied] = useState(false);
  const api = sync ? defaultApi.withToken(sync.token) : defaultApi;

  const act = async (f: () => Promise<void>) => {
    setBusy(true); setError(null);
    try { await f(); } catch (e) {
      if (e instanceof SyncError && e.unauthorized) update((s) => disconnect(s, 'Denne enheten er ikke lenger med i husstanden. Dataene på enheten er beholdt.'));
      else setError(errText(e));
    } finally { setBusy(false); }
  };
  const load = () => act(async () => { setInfo(await api.household()); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (sync) void load(); }, [sync?.token, sync?.members.length]);

  if (!sync) {
    const create = () => act(async () => {
      const r = await defaultApi.createHousehold(deviceId(), label.trim() || undefined);
      update((s) => connect(s, r.token, r.member));
    });
    const join = () => act(async () => {
      const r = await defaultApi.join(code, deviceId(), label.trim() || undefined);
      update((s) => connect(s, r.token, r.member));
    });
    return (
      <>
        <h1 className="page">Husstand</h1>
        {state.syncNotice && <div className="notice" role="status">{state.syncNotice}
          <button className="ghost sm" onClick={() => update((s) => ({ ...s, syncNotice: null }))}>OK</button></div>}
        <p>Del ukeplan, handleliste og matskap med en annen voksen på deres egne enheter. Appen virker som før uten husstand,
          og alt virker uten nett: endringer sendes når enheten er på nett igjen.</p>
        <p className="fine">Ingen passord eller e-post. Hver voksen enhet får en egen nøkkel. Vi lagrer bare det som trengs for å dele:
          plan, innstillinger (etiketter som «Barn 1», porsjoner, dager), avkrysninger og matskap. Postnummeret blir på denne enheten.
          Bruk etiketter, ikke barns navn. Barn og gjester trenger ingen konto.</p>
        <label className="big" htmlFor="lbl">Hva skal denne enheten hete i husstanden? (valgfritt)</label>
        <input id="lbl" maxLength={24} placeholder="F.eks. Voksen 1" value={label} onChange={(e) => setLabel(e.target.value)} />
        {error && <div className="banner warn" role="alert">{error}</div>}

        <h3>Ny husstand</h3>
        <div className="card">
          <p>Lag en husstand med denne enhetens plan, innstillinger, handleliste og matskap. Etterpå kan du invitere en annen voksen.</p>
          <button className="cta" disabled={busy} onClick={create}>🏠 Opprett husstand</button>
        </div>

        <h3>Bli med i en husstand</h3>
        <div className="card">
          <label className="big" htmlFor="code">Invitasjonskode</label>
          <input id="code" autoComplete="off" autoCapitalize="characters" maxLength={20} placeholder="ABCDE-FGHJK" value={code}
            onChange={(e) => setCode(e.target.value)} style={{ fontSize: '1.3rem', letterSpacing: '.1em' }} />
          <p className="fine">Husstandens ukeplan og innstillinger erstatter dem på denne enheten. Matskap og avkrysninger herfra
            legges til husstanden, uten doble rader.</p>
          <button className="cta" disabled={busy || code.replace(/[^a-z0-9]/gi, '').length !== 10} onClick={join}>Bli med</button>
        </div>
      </>
    );
  }

  const members = info?.members ?? sync.members.filter((m) => !m.removed);
  const isOwner = sync.me.role === 'eier';
  const link = invite ? `${location.origin}/#bli-med=${invite.code}` : '';
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); } catch { setCopied(false); }
  };
  const conflictDocs = (Object.keys(sync.conflicts) as DocName[]);

  return (
    <>
      <h1 className="page">Husstand</h1>
      <div className={`card ${status}`} role="status" aria-live="polite">
        <div className="drow"><span>Status</span><b>{statusText}</b></div>
        <div className="drow"><span>Sist synket</span><b>{time(sync.lastSync)}</b></div>
        {runtime.offline && <p className="fine">Endringene er lagret på enheten og sendes automatisk når den er på nett igjen.</p>}
        {sync.rejected > 0 && <p className="fine">{sync.rejected} endring{sync.rejected === 1 ? '' : 'er'} ble avvist av serveren som ugyldig og er bare på denne enheten.</p>}
        <button className="ghost" disabled={runtime.busy} onClick={runtime.syncNow}>↻ Synk nå</button>
      </div>

      {conflictDocs.map((name) => {
        const c = sync.conflicts[name]!;
        return (
          <div key={name} className="card" role="alert">
            <div className="banner warn">⚠ {DOC_TEXT[name]} ble endret både her og av {whoLabel(state, c.by)} samtidig:
              {' '}{c.fields.map(fieldText).join(', ')}. Ingenting er overskrevet. Velg hva som skal gjelde for disse feltene;
              andre endringer er allerede slått sammen.</div>
            <button className="ghost" onClick={() => update((s) => resolveConflict(s, name, 'mine'))}>Behold det som står her</button>
            <button className="ghost" onClick={() => update((s) => resolveConflict(s, name, 'theirs'))}>Bruk endringen fra {whoLabel(state, c.by)}</button>
          </div>
        );
      })}
      {purchaseConflicts > 0 && (
        <div className="banner warn">⚠ {purchaseConflicts} vare{purchaseConflicts === 1 ? '' : 'r'} er markert som handlet med ulikt antall.
          Bekreft antallet i handlelista eller matskapet. <button className="ghost sm" onClick={openList}>Åpne handlelista</button></div>
      )}
      {error && <div className="banner warn" role="alert">{error}</div>}

      <h3>Medlemmer</h3>
      <div className="card">
        {members.map((m) => (
          <div key={m.id} className="member">
            <span>{m.label}{m.me ? ' (denne enheten)' : ''}<small>{m.role === 'eier' ? 'Eier' : 'Voksen'} · sist sett {time(m.lastSeen)}</small></span>
            {isOwner && !m.me && <button className="ghost sm danger" disabled={busy}
              onClick={() => act(async () => { await api.removeMember(m.id); await load(); runtime.syncNow(); })}>Fjern</button>}
          </div>
        ))}
        <label className="big" htmlFor="mylbl">Navn på denne enheten</label>
        <div className="row">
          <input id="mylbl" maxLength={24} defaultValue={sync.me.label} key={sync.me.label} onChange={(e) => setLabel(e.target.value)} />
          <button className="ghost" disabled={busy || !label.trim()} onClick={() => act(async () => {
            const r = await api.setLabel(label); update((s) => (s.sync ? { ...s, sync: { ...s.sync, me: r.member } } : s)); await load(); runtime.syncNow();
          })}>Lagre</button>
        </div>
        <p className="fine">Bruk en etikett som «Voksen 2», ikke fullt navn. Barn og gjester legges inn som etiketter under «Hvem spiser».</p>
      </div>

      <h3>Inviter en voksen</h3>
      <div className="card">
        {invite ? (
          <>
            <p>Skriv inn koden på den andre enheten under Husstand → «Bli med», eller send lenken:</p>
            <p className="code" aria-label={`Kode ${invite.code.split('').join(' ')}`}>{invite.code}</p>
            <button className="ghost" onClick={copy}>{copied ? '✓ Lenke kopiert' : '📋 Kopier lenke'}</button>
            <p className="fine">Virker én gang og utløper {time(invite.expiresAt)}. Den som har koden kan bli med, så del den bare med
              noen i husstanden.</p>
          </>
        ) : <button className="cta" disabled={busy} onClick={() => act(async () => { setCopied(false); setInvite(await api.invite()); await load(); })}>➕ Lag invitasjon</button>}
        {info && info.invites.length > 0 && (
          <p className="fine">{info.invites.length} aktiv{info.invites.length === 1 ? '' : 'e'} invitasjon{info.invites.length === 1 ? '' : 'er'}.{' '}
            <button className="link" style={{ display: 'inline' }} onClick={() => act(async () => {
              for (const i of info.invites) await api.deleteInvite(i.id);
              setInvite(null); await load();
            })}>Trekk tilbake alle</button></p>
        )}
      </div>

      <h3>Forlat eller slett</h3>
      <div className="card">
        {!confirmLeave ? <button className="ghost" onClick={() => setConfirmLeave(true)}>Forlat husstanden</button> : (
          <>
            <p>Denne enheten slutter å dele. Det som er lagret her beholdes, men nye endringer fra de andre kommer ikke hit.
              {isOwner ? ' Eierskapet går til den som har vært med lengst.' : ''} Er du den siste, slettes husstanden på serveren.</p>
            <button className="ghost danger" disabled={busy} onClick={() => act(async () => {
              await api.leave(); update((s) => disconnect(s, 'Du har forlatt husstanden. Dataene er beholdt på denne enheten.'));
            })}>Ja, forlat</button>
            <button className="ghost" onClick={() => setConfirmLeave(false)}>Avbryt</button>
          </>
        )}
        {isOwner && (
          <>
            <p className="fine" style={{ marginTop: 16 }}>Slett husstanden og alle data på serveren: medlemmer, invitasjoner, plan,
              innstillinger, handleliste og matskap. Kan ikke angres. De andre enhetene kobles fra og beholder bare det de har lagret selv.</p>
            <label className="big" htmlFor="del">Skriv SLETT for å bekrefte</label>
            <input id="del" value={confirmDelete} onChange={(e) => setConfirmDelete(e.target.value)} autoComplete="off" />
            <label><input type="checkbox" checked={wipeLocal} onChange={() => setWipeLocal(!wipeLocal)} /> Slett også alt som er lagret på denne enheten</label>
            <button className="ghost danger" disabled={busy || confirmDelete.trim().toUpperCase() !== 'SLETT'} onClick={() => act(async () => {
              await api.deleteHousehold();
              update((s) => (wipeLocal ? { ...initialState, syncNotice: 'Husstanden og alle data er slettet.' } : disconnect(s, 'Husstanden er slettet på serveren. Dataene på denne enheten er beholdt.')));
            })}>🗑 Slett husstanden og alle data</button>
          </>
        )}
      </div>
    </>
  );
}
