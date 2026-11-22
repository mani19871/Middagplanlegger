// «Last ned mine data» (innsyn og dataportabilitet, docs/personvern/05): én JSON-fil med alt denne enheten har lagret og,
// i en husstand, alt serveren har om husstanden (GET /api/household/export). Ren funksjon; tid og henting settes inn.
// Nøkkelen (token) tas aldri med: den gir tilgang til husstanden og er ikke en opplysning om deg.
import type { AppState, SyncMeta } from '../store';
import type { ServerExport } from './protocol';

export interface DeviceExport {
  format: 'middagsplanlegger-eksport'; versjon: 1; eksportert: string; forklaring: string;
  enhet: {
    /** Offentlig enhets-id (brukes som «hvem» i husstanden og kan oppgis ved henvendelser om personvern). */
    enhetsId: string;
    /** Lagres bare på denne enheten og sendes aldri til serveren. */
    bareHer: { postnummer: string; vegetar: boolean; allergener: string[]; matvarerSomUnngås: string[] };
    /** Alt appen har lagret i nettleseren på denne enheten, uten nøkkelen. */
    lagretPåEnheten: Omit<AppState, 'sync'> & { sync: Omit<SyncMeta, 'token'> | null };
  };
  /** Det serveren har om husstanden; null uten husstand eller når serveren ikke kunne nås (se `serverMerknad`). */
  server: ServerExport | null;
  serverMerknad: string;
}

const TEXT = 'Kopi av opplysningene Husvett har om deg og husstanden din. «enhet» er det som er lagret i nettleseren på '
  + 'denne enheten. «server» er det serveren har lagret om husstanden (bare hvis enheten er med i en husstand). Nøkkelen som '
  + 'gir tilgang til husstanden er ikke med. Basisvarer med minstegrenser står i innstillingene (settings.staples) og '
  + 'markeringene «har / snart tom / tom» i beholdningsloggen (type «nivå»); i en husstand er begge også delt med de '
  + 'andre voksne. Formatet er JSON og kan leses av andre programmer.';

export function buildExport(state: AppState, deviceId: string, now: string, server: ServerExport | null, serverNote?: string): DeviceExport {
  let sync: Omit<SyncMeta, 'token'> | null = null;
  if (state.sync) {
    const { token: _token, ...rest } = state.sync;
    sync = rest;
  }
  return {
    format: 'middagsplanlegger-eksport', versjon: 1, eksportert: now, forklaring: TEXT,
    enhet: {
      enhetsId: deviceId,
      bareHer: {
        postnummer: state.postal, vegetar: state.settings.vegetarian, allergener: [...state.settings.avoid],
        matvarerSomUnngås: [...(state.settings.avoidFoods ?? [])],
      },
      lagretPåEnheten: { ...state, sync },
    },
    server,
    serverMerknad: serverNote ?? (state.sync ? (server ? 'Hentet fra serveren.' : 'Serverdelen kunne ikke hentes.')
      : 'Enheten er ikke med i en husstand, så serveren har ingenting om deg.'),
  };
}

export const exportFileName = (now: string) => `middagsplanlegger-mine-data-${now.slice(0, 10)}.json`;
/** Lesbar JSON (innrykk), så filen kan åpnes og leses i et vanlig tekstprogram. */
export const exportText = (x: DeviceExport) => `${JSON.stringify(x, null, 2)}\n`;
