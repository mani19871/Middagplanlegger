#!/usr/bin/env bash
# Husvett driftsstatus: én kort, norsk statusrapport for en liten server. BARE LESING: endrer ingenting, starter ikke noe,
# sletter ikke noe. Skriver aldri IP-adresser, tokens, etiketter, kodeord eller innhold, bare tall, ja/nei og faste tekster.
# Se docs/drift/driftstatus.md (tolkning, tabell for eieren) og docs/installasjon-ubuntu.md, avsnitt 9B.
#
#   ./driftstatus.sh              kjør fra en vanlig bruker; docker, find og df kjøres med «sudo» (spør etter passord)
#   ./driftstatus.sh --journal    samme, men med prioritetsmerker som `journalctl -p warning` forstår (til systemd, kjøres som root)
#
# Hvert punkt får OK, ADVARSEL eller FEIL. Utgangskode: 0 = alt OK, 1 = minst én ADVARSEL, 2 = minst én FEIL.
#
# Hva som kjøres med sudo (bare når du ikke er root): `docker` (compose ps, inspect, exec, stats, logs), `find` og `df`
# på sikkerhetskopimappen (bare hvis du ikke kan lese den selv), og `grep` på linjen DOMENE= i .env.drift hvis filen ikke
# kan leses direkte. Ingenting skrives noe sted. `docker exec` kjører bare ett lite lese-program i app-containeren (filstørrelser,
# diskplass og GET /healthz på 127.0.0.1) og skriver bare tall og ja/nei tilbake.
#
# Innstillinger (miljøvariabler, alle valgfrie):
#   HUSVETT_DRIFT_DIR     katalogen med docker-compose.yml og .env.drift (standard: katalogen til dette skriptet)
#   BACKUP_DIR            sikkerhetskopimappen (standard: BACKUP_DIR fra /srv/husvett/backup.env, ellers <drift-katalogen>/backup)
#   HUSVETT_DOMENE        domenet for TLS-sjekken (standard: DOMENE fra .env.drift, ellers husvett.no)
#   HUSVETT_TLS_PORT      port for TLS-sjekken (standard 443)
#   HUSVETT_SKIP_EXTERNAL 1 = hopp over TLS- og nettadresse-sjekken (hvis serveren ikke når seg selv utenfra)
#   HUSVETT_CA_FILE       egen CA-fil å stole på i TLS-sjekken (bare til prøving, f.eks. selvsignert sertifikat)
#   HUSVETT_DOCKER        annen docker-kommando i stedet for «sudo docker» (bare til prøving)
#   Terskler: HUSVETT_BACKUP_WARN_HOURS (36) _FAIL_HOURS (96), HUSVETT_DISK_WARN_PCT (80) _FAIL_PCT (90),
#     HUSVETT_DISK_WARN_FREE_MB (2000) _FAIL_FREE_MB (500), HUSVETT_MEM_WARN_PCT (15, tilgjengelig minne) _FAIL_PCT (5),
#     HUSVETT_CERT_WARN_DAYS (21) _FAIL_DAYS (7), HUSVETT_OFFERS_WARN_HOURS (14) _FAIL_HOURS (48), HUSVETT_DB_WARN_MB (800),
#     HUSVETT_ERRORS_WARN (5) _FAIL (100) (feillinjer i appens logg siste 24 timer)
set -uo pipefail
export LC_ALL=C

JOURNAL=0
case "${1:-}" in
  --journal) JOURNAL=1 ;;
  -h|--hjelp|--help) sed -n '2,27p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
  '') ;;
  *) echo "Ukjent valg: bruk --journal eller --hjelp." >&2; exit 2 ;;
esac

DRIFT_DIR="${HUSVETT_DRIFT_DIR:-$(cd "$(dirname "$0")" && pwd)}"
TMO=60 # sekunder per kommando mot Docker; et hengt kall skal ikke henge rapporten

# ---- innstillinger og terskler --------------------------------------------------------------------------------------
num() { local v="${1:-}" d="$2"; [[ "$v" =~ ^[0-9]+$ ]] && echo "$v" || echo "$d"; }
BACKUP_WARN_H=$(num "${HUSVETT_BACKUP_WARN_HOURS:-}" 36);  BACKUP_FAIL_H=$(num "${HUSVETT_BACKUP_FAIL_HOURS:-}" 96)
DISK_WARN=$(num "${HUSVETT_DISK_WARN_PCT:-}" 80);          DISK_FAIL=$(num "${HUSVETT_DISK_FAIL_PCT:-}" 90)
FREE_WARN_MB=$(num "${HUSVETT_DISK_WARN_FREE_MB:-}" 2000); FREE_FAIL_MB=$(num "${HUSVETT_DISK_FAIL_FREE_MB:-}" 500)
MEM_WARN=$(num "${HUSVETT_MEM_WARN_PCT:-}" 15);            MEM_FAIL=$(num "${HUSVETT_MEM_FAIL_PCT:-}" 5)
CERT_WARN_D=$(num "${HUSVETT_CERT_WARN_DAYS:-}" 21);       CERT_FAIL_D=$(num "${HUSVETT_CERT_FAIL_DAYS:-}" 7)
OFFERS_WARN_H=$(num "${HUSVETT_OFFERS_WARN_HOURS:-}" 14);  OFFERS_FAIL_H=$(num "${HUSVETT_OFFERS_FAIL_HOURS:-}" 48)
DB_WARN_MB=$(num "${HUSVETT_DB_WARN_MB:-}" 800)
ERR_WARN=$(num "${HUSVETT_ERRORS_WARN:-}" 5);              ERR_FAIL=$(num "${HUSVETT_ERRORS_FAIL:-}" 100)
TLS_PORT=$(num "${HUSVETT_TLS_PORT:-}" 443)

# ---- rapportering ---------------------------------------------------------------------------------------------------
N_OK=0; N_WARN=0; N_FAIL=0
if [[ $JOURNAL -eq 0 && -t 1 && -z "${NO_COLOR:-}" ]]; then C_OK=$'\e[32m'; C_WARN=$'\e[33m'; C_FAIL=$'\e[31m'; C_END=$'\e[0m'; else C_OK=''; C_WARN=''; C_FAIL=''; C_END=''; fi
# say NIVÅ tekst. Nivå: OK, ADVARSEL eller FEIL. Med --journal settes prioritetsmerke (<6> info, <4> advarsel, <3> feil).
say() {
  local lvl="$1" txt="$2" col="" pre=""
  case "$lvl" in
    OK) N_OK=$((N_OK + 1)); col="$C_OK"; pre='<6>' ;;
    ADVARSEL) N_WARN=$((N_WARN + 1)); col="$C_WARN"; pre='<4>' ;;
    FEIL) N_FAIL=$((N_FAIL + 1)); col="$C_FAIL"; pre='<3>' ;;
  esac
  [[ $JOURNAL -eq 1 ]] || pre=''
  printf '%s%s%-9s%s %s\n' "$pre" "$col" "$lvl" "$C_END" "$txt"
}

# Heltall → «1,2 GB» / «34 MB» / «12 kB». Bare til visning.
human() {
  awk -v b="$1" 'BEGIN { if (b < 0) { print "ukjent"; exit }
    if (b >= 1073741824) s = sprintf("%.1f GB", b / 1073741824); else if (b >= 1048576) s = sprintf("%.1f MB", b / 1048576);
    else if (b >= 1024) s = sprintf("%.0f kB", b / 1024); else s = sprintf("%d byte", b);
    sub(/\./, ",", s); print s }'
}
# Som human, men «ingen» for en fil som ikke finnes (journalfilen er borte når databasen er tømt, og det er normalt).
hsz() { if (( $1 < 0 )); then echo ingen; else human "$1"; fi; }
# Minutter → «12 min», «5 t 20 min», «3 døgn».
span() {
  local m="$1"
  if (( m < 60 )); then echo "${m} min"; elif (( m < 2880 )); then echo "$((m / 60)) t $((m % 60)) min"; else echo "$((m / 1440)) døgn"; fi
}

# ---- kommandoer (sudo bare når vi ikke er root) ----------------------------------------------------------------------
as_root() { if [[ $EUID -eq 0 ]]; then "$@"; elif [[ -t 0 ]]; then sudo "$@"; else sudo -n "$@"; fi; }
# «--foreground» så sudo kan spørre etter passord på terminalen; tidsgrensen stopper likevel et hengt kall.
# shellcheck disable=SC2016  # $EUID og $@ skal utvides av det indre skallet, ikke her
dock() { if [[ -n "${HUSVETT_DOCKER:-}" ]]; then timeout --foreground "$TMO" "$HUSVETT_DOCKER" "$@"; else timeout --foreground "$TMO" bash -c 'if [[ $EUID -eq 0 ]]; then exec docker "$@"; elif [[ -t 0 ]]; then exec sudo docker "$@"; else exec sudo -n docker "$@"; fi' _ "$@"; fi; }
# find og df på sikkerhetskopimappen: som vanlig bruker når mappen kan leses, ellers med sudo (den kan være lesbar bare for root).
dir_cmd() { if [[ -r "$BACKUP_DIR" && -x "$BACKUP_DIR" ]]; then "$@"; else as_root "$@"; fi; }
compose() { ( cd "$DRIFT_DIR" && dock compose --env-file .env.drift "$@" ); }

# Henter én linje «NAVN=verdi» fra en miljøfil uten å lese resten av filen (de har hemmeligheter og skrives aldri ut).
file_value() {
  local file="$1" name="$2" line=""
  [[ -e "$file" ]] || return 0
  line=$(grep -E "^${name}=" "$file" 2>/dev/null | tail -n 1) || true
  [[ -n "$line" ]] || line=$(as_root grep -E "^${name}=" "$file" 2>/dev/null | tail -n 1) || true
  line="${line#*=}"; line="${line%%#*}"; line="${line//\"/}"; line="${line//\'/}"; line="${line//[[:space:]]/}"
  printf '%s' "$line"
}
env_value() { file_value "$DRIFT_DIR/.env.drift" "$1"; }

DOMENE="${HUSVETT_DOMENE:-}"
[[ -n "$DOMENE" ]] || DOMENE=$(env_value DOMENE)
[[ "$DOMENE" =~ ^[a-z0-9.-]+\.[a-z]{2,63}$ || "$DOMENE" == localhost ]] || DOMENE=husvett.no

BACKUP_DIR="${BACKUP_DIR:-}"
[[ -n "$BACKUP_DIR" ]] || BACKUP_DIR=$(file_value /srv/husvett/backup.env BACKUP_DIR)
[[ -n "$BACKUP_DIR" ]] || BACKUP_DIR="$DRIFT_DIR/backup"

echo "Husvett driftsstatus $(date '+%Y-%m-%d %H:%M') (serverens tid). Bare lesing; ingen adresser eller innhold i rapporten."

# ---- 1. Docker og containere ------------------------------------------------------------------------------------------
APP_ID=''; HAVE_APP=0
declare -A H=()
if ! dock version --format '{{.Server.Version}}' >/dev/null 2>&1; then
  say FEIL "Docker: kan ikke kjøre «sudo docker» (ikke installert, står stoppet, eller du har ikke sudo). Containere, helse, volum og logg er derfor ikke sjekket."
elif [[ ! -e "$DRIFT_DIR/docker-compose.yml" || ! -e "$DRIFT_DIR/.env.drift" ]]; then
  say FEIL "Containere: finner ikke docker-compose.yml og .env.drift i driftskatalogen. Kjør fra docs/drift, eller sett HUSVETT_DRIFT_DIR."
else
  APP_ID=$(compose ps -a -q app 2>/dev/null | head -n 1) || true
  if [[ ! "$APP_ID" =~ ^[0-9a-f]{12,64}$ ]]; then
    APP_ID=''
    say FEIL "Containere: app-containeren finnes ikke (aldri startet, eller fjernet)."
  else
    # tilstand, helse, antall omstarter, starttid
    IFS='|' read -r st hl rc started < <(dock inspect -f '{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{else}}ingen{{end}}|{{.RestartCount}}|{{.State.StartedAt}}' "$APP_ID" 2>/dev/null) || true
    [[ "${st:-}" =~ ^[a-z]+$ ]] || st='ukjent'; [[ "${hl:-}" =~ ^[a-z]+$ ]] || hl='ukjent'; [[ "${rc:-}" =~ ^[0-9]+$ ]] || rc=0
    up=''
    if t=$(date -d "${started:-}" +%s 2>/dev/null); then now=$(date +%s); (( t <= now )) && up=", oppe $(span $(( (now - t) / 60 )))"; fi
    if [[ "$st" == running && "$hl" == healthy ]]; then
      if (( rc >= 5 )); then say ADVARSEL "Containere: app kjører og er «healthy»$up, men har startet på nytt $rc ganger siden den ble laget. Se loggen (kontakt utvikler hvis det fortsetter)."
      else say OK "Containere: app kjører og er «healthy»$up (omstarter siden den ble laget: $rc)."; fi
      HAVE_APP=1
    elif [[ "$st" == running && "$hl" == starting ]]; then
      say ADVARSEL "Containere: app kjører, men helsesjekken er ikke ferdig ennå (startet nylig$up). Kjør rapporten på nytt om et par minutter."; HAVE_APP=1
    elif [[ "$st" == running ]]; then
      say FEIL "Containere: app kjører, men helsetilstanden er «$hl»."; HAVE_APP=1
    else
      say FEIL "Containere: app er ikke i gang (tilstand: $st)."
    fi
  fi
  CADDY_ID=$(compose ps -a -q caddy 2>/dev/null | head -n 1) || true
  if [[ "$CADDY_ID" =~ ^[0-9a-f]{12,64}$ ]]; then
    cst=$(dock inspect -f '{{.State.Status}}' "$CADDY_ID" 2>/dev/null) || cst=ukjent
    [[ "$cst" =~ ^[a-z]+$ ]] || cst=ukjent
    if [[ "$cst" == running ]]; then say OK "Containere: Caddy (HTTPS-fronten) kjører."; else say FEIL "Containere: Caddy er ikke i gang (tilstand: $cst). Siden er da ikke nåbar utenfra."; fi
  elif [[ "$(env_value COMPOSE_FILE)" == *bak-proxy* ]]; then
    say OK "Containere: ingen egen Caddy (vei B: serverens webserver står foran appen; den sjekkes ikke her)."
  else
    say FEIL "Containere: Caddy-containeren finnes ikke."
  fi
fi

# ---- 2–5. Det appen selv kan si: /healthz, volum, databaser (ett lite lese-program i app-containeren) ------------------
if [[ $HAVE_APP -eq 1 ]]; then
  read -r -d '' PROBE <<'JS' || true
const fs = require('node:fs');
const out = (k, v) => console.log(k + '=' + v);
const dir = process.env.DATA_DIR || '/data';
const size = (p) => { try { return fs.statSync(p).size; } catch { return -1; } };
const sync = process.env.SYNC_DB || dir + '/middag.sqlite';
const offer = process.env.OFFER_DB || dir + '/tilbud.sqlite';
out('middag_bytes', size(sync)); out('middag_wal_bytes', size(sync + '-wal'));
out('tilbud_bytes', size(offer)); out('tilbud_wal_bytes', size(offer + '-wal'));
try { const s = fs.statfsSync(dir); out('disk_total', s.blocks * s.bsize); out('disk_free', s.bavail * s.bsize); } catch { /* ukjent */ }
fetch('http://127.0.0.1:' + (process.env.PORT || 8787) + '/healthz', { signal: AbortSignal.timeout(5000) })
  .then(async (r) => {
    out('http', r.status);
    try {
      const j = await r.json();
      if (j.status === 'ok' || j.status === 'feil') out('h_status', j.status);
      for (const [k, v] of Object.entries(j)) {
        if (/^[A-Za-z][A-Za-z0-9]{0,39}$/.test(k) && k !== 'status' && (typeof v === 'boolean' || (typeof v === 'number' && Number.isFinite(v)))) out('h_' + k, v);
      }
    } catch { /* ikke JSON */ }
  })
  .catch(() => out('http', 0));
JS
  probe_out=$(dock exec "$APP_ID" node --no-warnings -e "$PROBE" 2>/dev/null) || probe_out=''
  while IFS='=' read -r k v; do
    # Bare enkle nøkler og enkle verdier slipper inn; alt annet kastes (rapporten kan aldri vise innhold fra appen).
    [[ "$k" =~ ^[a-z_A-Z0-9]{1,50}$ && "$v" =~ ^(-?[0-9]{1,18}|true|false|ok|feil)$ ]] && H[$k]="$v"
  done <<<"$probe_out"
fi
hv() { printf '%s' "${H[$1]:-}"; }

# 2. /healthz lokalt
if [[ $HAVE_APP -eq 0 ]]; then
  say FEIL "Helsesjekk (/healthz lokalt): kan ikke spørre appen fordi app-containeren ikke kjører."
elif [[ "$(hv http)" == 200 && "$(hv h_status)" == ok && "$(hv h_dbOk)" == true ]]; then
  say OK "Helsesjekk (/healthz lokalt): svarer 200, synk-databasen svarer."
elif [[ "$(hv http)" == 503 ]]; then
  say FEIL "Helsesjekk (/healthz lokalt): svarer 503, synk-databasen svarer ikke. Ikke start noe på nytt og ikke slett noe: ring utvikleren."
elif [[ "$(hv http)" == 429 ]]; then
  say ADVARSEL "Helsesjekk (/healthz lokalt): for mange kall akkurat nå (429). Vent et minutt og kjør rapporten på nytt."
elif [[ -z "$(hv http)" || "$(hv http)" == 0 ]]; then
  say FEIL "Helsesjekk (/healthz lokalt): appen svarer ikke på sin egen port."
else
  say FEIL "Helsesjekk (/healthz lokalt): uventet svar (kode $(hv http))."
fi

# 3. Disk og minne
disk_line() { # $1 = navn, $2 = totalt byte, $3 = ledig byte
  local name="$1" total="$2" free="$3" used_pct free_mb
  if [[ ! "$total" =~ ^[0-9]+$ || ! "$free" =~ ^[0-9]+$ || "$total" -eq 0 ]]; then say ADVARSEL "Disk ($name): kunne ikke leses."; return; fi
  used_pct=$(( (total - free) * 100 / total )); free_mb=$(( free / 1048576 ))
  local txt; txt="Disk ($name): $used_pct % brukt, $(human "$free") ledig."
  if (( used_pct >= DISK_FAIL || free_mb < FREE_FAIL_MB )); then say FEIL "$txt Nesten full: databasen og sikkerhetskopiene trenger plass."
  elif (( used_pct >= DISK_WARN || free_mb < FREE_WARN_MB )); then say ADVARSEL "$txt Følg med; rydd ikke selv (se tabellen i driftstatus.md)."
  else say OK "$txt"; fi
}
if [[ $HAVE_APP -eq 1 ]]; then disk_line "Husvetts datavolum" "$(hv disk_total)" "$(hv disk_free)"; else say ADVARSEL "Disk (Husvetts datavolum): ikke sjekket, appen kjører ikke."; fi
if [[ -d "$BACKUP_DIR" ]]; then
  read -r _ total_kb _ free_kb _ < <(dir_cmd df -Pk "$BACKUP_DIR" 2>/dev/null | tail -n 1) || true
  if [[ "${total_kb:-}" =~ ^[0-9]+$ && "${free_kb:-}" =~ ^[0-9]+$ ]]; then disk_line "sikkerhetskopimappen" $((total_kb * 1024)) $((free_kb * 1024)); else say ADVARSEL "Disk (sikkerhetskopimappen): kunne ikke leses."; fi
else
  say ADVARSEL "Disk (sikkerhetskopimappen): mappen finnes ikke (se punktet om sikkerhetskopier)."
fi

mem_total=0; mem_avail=0
while read -r key val _; do
  case "$key" in MemTotal:) mem_total="$val" ;; MemAvailable:) mem_avail="$val" ;; esac
done < /proc/meminfo 2>/dev/null || true
if (( mem_total > 0 )); then
  avail_pct=$(( mem_avail * 100 / mem_total ))
  txt="Minne (hele serveren, delt med Plattform): $avail_pct % tilgjengelig ($(human $((mem_avail * 1024))) av $(human $((mem_total * 1024))))."
  if (( avail_pct < MEM_FAIL )); then say FEIL "$txt Serveren går tom for minne."
  elif (( avail_pct < MEM_WARN )); then say ADVARSEL "$txt"
  else say OK "$txt"; fi
else
  say ADVARSEL "Minne (hele serveren): kunne ikke leses."
fi
if [[ $HAVE_APP -eq 1 ]]; then
  # MemPerc er «12.34%», MemUsage «45.3MiB / 2GiB»; begge sjekkes mot fast form før de vises.
  IFS='|' read -r mp mu < <(dock stats --no-stream --format '{{.MemPerc}}|{{.MemUsage}}' "$APP_ID" 2>/dev/null) || true
  pct=''; [[ "${mp:-}" =~ ^([0-9]{1,3})(\.[0-9]+)?%$ ]] && pct="${BASH_REMATCH[1]}"
  if [[ -n "$pct" && "${mu:-}" =~ ^[0-9.]+[A-Za-z]+\ /\ [0-9.]+[A-Za-z]+$ ]]; then
    if (( pct >= 90 )); then say FEIL "Minne (appen): $pct % av minnegrensen ($mu). Appen kan bli stoppet."
    elif (( pct >= 75 )); then say ADVARSEL "Minne (appen): $pct % av minnegrensen ($mu)."
    else say OK "Minne (appen): $pct % av minnegrensen ($mu)."; fi
  else
    say ADVARSEL "Minne (appen): kunne ikke leses."
  fi
fi

# 4. Sikkerhetskopier: alder på nyeste fil per database
newest_backup() { # $1 = middag|tilbud → «sekunder-siden-endring størrelse» for nyeste krypterte fil, tom hvis ingen
  local name="$1" line now
  now=$(date +%s)
  line=$(dir_cmd find "$BACKUP_DIR" -maxdepth 1 -type f \( -name "${name}-*.sqlite.age" -o -name "${name}-*.sqlite.gpg" \) -printf '%T@ %s\n' 2>/dev/null) || { echo LESEFEIL; return 0; }
  line=$(sort -rn <<<"$line" | head -n 1)
  [[ "$line" =~ ^([0-9]+)(\.[0-9]+)?\ ([0-9]+)$ ]] || return 0
  echo "$(( now - BASH_REMATCH[1] )) ${BASH_REMATCH[3]}"
}
backup_line() { # $1 = navn, $2 = visningsnavn, $3 = «valgfri» hvis databasen kan mangle
  local name="$1" label="$2" optional="${3:-}" r age_s size hours
  if [[ ! -d "$BACKUP_DIR" ]]; then
    if [[ "$optional" == valgfri ]]; then return; fi
    say FEIL "Sikkerhetskopi ($label): mappen for sikkerhetskopier finnes ikke. Ingen kopier er tatt."; return
  fi
  r=$(newest_backup "$name")
  if [[ "$r" == LESEFEIL ]]; then say ADVARSEL "Sikkerhetskopi ($label): kunne ikke lese mappen (mangler sudo eller rettigheter). Kopiene er ikke sjekket."; return; fi
  if [[ -z "$r" ]]; then
    if [[ "$optional" == valgfri ]]; then say ADVARSEL "Sikkerhetskopi ($label): ingen kopifil funnet (greit hvis tilbudslagring er av)."
    else say FEIL "Sikkerhetskopi ($label): ingen kopifil funnet. Har sikkerhetskopieringen aldri kjørt?"; fi
    return
  fi
  read -r age_s size <<<"$r"
  (( age_s < 0 )) && age_s=0
  hours=$(( age_s / 3600 ))
  local txt; txt="Sikkerhetskopi ($label): nyeste er $(span $((age_s / 60))) gammel, $(human "$size")."
  if (( size == 0 )); then say FEIL "$txt Filen er tom."
  elif (( hours >= BACKUP_FAIL_H )); then say FEIL "$txt Det er flere dager siden sist: sikkerhetskopieringen virker stoppet."
  elif (( hours >= BACKUP_WARN_H )); then say ADVARSEL "$txt Over $BACKUP_WARN_H timer: sjekk at daglig sikkerhetskopi kjører."
  else say OK "$txt"; fi
}
backup_line middag "synk-databasen"
if [[ $HAVE_APP -eq 1 && -z "$(hv h_offersDbOk)" && "$(hv http)" == 200 ]]; then
  say OK "Sikkerhetskopi (tilbudsdatabasen): ingen tilbudsdatabase i bruk, ingen kopi nødvendig."
else
  backup_line tilbud "tilbudsdatabasen" valgfri
fi
NOTE_OFFSITE="Merk: kopier utenfor serveren kan ikke sjekkes herfra. Kontroller selv at de finnes et annet sted i EØS (installasjon-ubuntu.md, 9.4)."

# 5. Størrelse på databasene
if [[ $HAVE_APP -eq 1 && "$(hv middag_bytes)" =~ ^-?[0-9]+$ ]]; then
  mb=$(hv middag_bytes); mw=$(hv middag_wal_bytes); tb=$(hv tilbud_bytes); tw=$(hv tilbud_wal_bytes)
  [[ "$mw" =~ ^-?[0-9]+$ ]] || mw=-1; [[ "$tb" =~ ^-?[0-9]+$ ]] || tb=-1; [[ "$tw" =~ ^-?[0-9]+$ ]] || tw=-1
  total=$(( (mb > 0 ? mb : 0) + (mw > 0 ? mw : 0) + (tb > 0 ? tb : 0) + (tw > 0 ? tw : 0) ))
  txt="Databaser: synk $(hsz "$mb") (journal $(hsz "$mw")), tilbud $(hsz "$tb") (journal $(hsz "$tw"))."
  if (( mb < 0 )); then say FEIL "Databaser: synk-databasen finnes ikke i datavolumet. Feil eller tomt volum? Ikke start noe på nytt, ring utvikleren."
  elif (( total / 1048576 >= DB_WARN_MB )); then say ADVARSEL "$txt Til sammen nær 1 GB: minnegrensen for sikkerhetskopien må kanskje økes (hosting.md). Ring utvikleren."
  elif (( mw > 104857600 || tw > 104857600 )); then say ADVARSEL "$txt Journalfilen er uvanlig stor. Ring utvikleren hvis det varer."
  else say OK "$txt"; fi
else
  say ADVARSEL "Databaser: størrelsene kunne ikke leses (appen kjører ikke, eller svarte ikke)."
fi

# 6. Henting av Tjek-tilbud (tall fra /healthz: offersFetch, offersLastRunAgeMinutes, offersFailures)
if [[ $HAVE_APP -eq 0 || "$(hv http)" != 200 ]]; then
  say ADVARSEL "Tilbud fra Tjek: ikke sjekket, appen svarte ikke."
elif [[ "$(hv h_offersFetch)" == false ]]; then
  say ADVARSEL "Tilbud fra Tjek: henting er slått av (TJEK_FETCH=0). Appen får ingen nye tilbud."
else
  age="$(hv h_offersLastRunAgeMinutes)"; fails="$(hv h_offersFailures)"; [[ "$fails" =~ ^[0-9]+$ ]] || fails=0
  upm="$(hv h_uptimeMinutes)"; [[ "$upm" =~ ^[0-9]+$ ]] || upm=0
  if [[ ! "$age" =~ ^[0-9]+$ ]]; then
    if (( upm < 30 )); then say OK "Tilbud fra Tjek: venter på første henting (appen startet for $(span "$upm") siden)."
    else say ADVARSEL "Tilbud fra Tjek: ingen vellykket henting noensinne ($fails mislykkede på rad). Se loggen etter «tilbud-feil»."; fi
  else
    txt="Tilbud fra Tjek: siste vellykkede henting for $(span "$age") siden"
    if (( age >= OFFERS_FAIL_H * 60 )); then say FEIL "$txt ($fails mislykkede på rad). Hentingen virker stoppet."
    elif (( age >= OFFERS_WARN_H * 60 || fails >= 3 )); then say ADVARSEL "$txt ($fails mislykkede på rad). Normalt hver 6. time; Tjek kan være nede. Ikke kritisk for synk."
    else say OK "$txt."; fi
  fi
fi

# 7. Feil i appens logg siste 24 timer (bare antallet; loggen inneholder bare feilnavn, aldri innhold, men vi skriver den ikke ut)
if [[ $HAVE_APP -eq 1 ]]; then
  if errs=$(dock logs --since 24h "$APP_ID" 2>&1 | grep -cE '^(serverfeil|synk-feil|eksport-feil|helsesjekk|statisk fil)'); then :; else errs=${errs:-0}; fi
  [[ "$errs" =~ ^[0-9]+$ ]] || errs=0
  if (( errs >= ERR_FAIL )); then say FEIL "Feil i appens logg siste 24 timer: $errs linjer. Ring utvikleren."
  elif (( errs >= ERR_WARN )); then say ADVARSEL "Feil i appens logg siste 24 timer: $errs linjer (serverfeil, synkfeil, eksportfeil eller databasen svarte ikke)."
  else say OK "Feil i appens logg siste 24 timer: $errs linjer."; fi
fi

# 8. TLS-sertifikat og nettadressen utenfra (kan slås av med HUSVETT_SKIP_EXTERNAL=1 hvis serveren ikke når seg selv utenfra)
check_external() {
tls_out=''
CAOPT=(); [[ -n "${HUSVETT_CA_FILE:-}" && -r "${HUSVETT_CA_FILE}" ]] && CAOPT=(-CAfile "$HUSVETT_CA_FILE")
if command -v openssl >/dev/null 2>&1; then
  tls_out=$(timeout 15 openssl s_client -connect "$DOMENE:$TLS_PORT" -servername "$DOMENE" -verify_hostname "$DOMENE" "${CAOPT[@]}" </dev/null 2>/dev/null) || true
  if [[ -z "$tls_out" ]] || ! grep -q 'BEGIN CERTIFICATE' <<<"$tls_out"; then
    say ADVARSEL "TLS-sertifikat ($DOMENE): kunne ikke koble til port $TLS_PORT fra serveren selv. Det kan skyldes at serveren ikke når seg selv utenfra; kontroller også med oppetidstjenesten eller fra en annen maskin."
  else
    enddate=$(sed -n '/BEGIN CERTIFICATE/,/END CERTIFICATE/p' <<<"$tls_out" | openssl x509 -noout -enddate 2>/dev/null | sed 's/^notAfter=//') || enddate=''
    verify=$(grep -m1 -E '^ *Verify return code: ' <<<"$tls_out" | sed -E 's/^ *Verify return code: ([0-9]+).*/\1/') || verify=''
    if t=$(date -d "$enddate" +%s 2>/dev/null); then
      days=$(( (t - $(date +%s)) / 86400 )); iso=$(date -d "@$t" '+%Y-%m-%d')
      if (( t <= $(date +%s) )); then say FEIL "TLS-sertifikat ($DOMENE): UTLØPT $iso. Nettleserne viser sikkerhetsfeil."
      elif (( days < CERT_FAIL_D )); then say FEIL "TLS-sertifikat ($DOMENE): utløper $iso (om $days dager). Fornyelsen har sviktet."
      elif (( days < CERT_WARN_D )); then say ADVARSEL "TLS-sertifikat ($DOMENE): utløper $iso (om $days dager). Fornyelse skjer vanligvis 30 dager før; se Caddy-loggen."
      elif [[ "$verify" != 0 ]]; then say FEIL "TLS-sertifikat ($DOMENE): utløper $iso, men nettlesere vil ikke stole på det (verifiseringskode ${verify:-ukjent}: feil domene, selvsignert eller mangelfull kjede)."
      else say OK "TLS-sertifikat ($DOMENE): gyldig og betrodd, utløper $iso (om $days dager)."; fi
    else
      say ADVARSEL "TLS-sertifikat ($DOMENE): fant sertifikatet, men kunne ikke lese utløpsdatoen."
    fi
  fi
else
  say ADVARSEL "TLS-sertifikat ($DOMENE): ikke sjekket, programmet openssl mangler."
fi
if command -v curl >/dev/null 2>&1; then
  CACURL=(); [[ -n "${HUSVETT_CA_FILE:-}" && -r "${HUSVETT_CA_FILE}" ]] && CACURL=(--cacert "$HUSVETT_CA_FILE")
  code=$(curl -sS -m 15 -o /dev/null -w '%{http_code}' "${CACURL[@]}" "https://$DOMENE:$TLS_PORT/healthz" 2>/dev/null) || code=000
  if [[ "$code" == 200 ]]; then say OK "Nettadressen (https://$DOMENE/healthz fra serveren selv): svarer 200."
  elif [[ "$code" == 000 ]]; then say ADVARSEL "Nettadressen (https://$DOMENE/healthz fra serveren selv): ingen forbindelse eller ugyldig sertifikat. Kan skyldes at serveren ikke når seg selv; kontroller utenfra."
  elif [[ "$code" == 429 ]]; then say ADVARSEL "Nettadressen (https://$DOMENE/healthz): for mange kall akkurat nå (429)."
  else say FEIL "Nettadressen (https://$DOMENE/healthz): svarer $code. Siden fungerer ikke for brukerne."; fi
fi
}
NOTE_EXTERNAL=''
if [[ "${HUSVETT_SKIP_EXTERNAL:-}" == 1 ]]; then NOTE_EXTERNAL="Merk: TLS-sertifikat og nettadresse er ikke sjekket (HUSVETT_SKIP_EXTERNAL=1). Bruk ekstern oppetidstjeneste i stedet."; else check_external; fi

# ---- samlet ---------------------------------------------------------------------------------------------------------
if (( N_FAIL > 0 )); then total=FEIL; rc=2; elif (( N_WARN > 0 )); then total=ADVARSEL; rc=1; else total=OK; rc=0; fi
echo
echo "$NOTE_OFFSITE"
[[ -z "$NOTE_EXTERNAL" ]] || echo "$NOTE_EXTERNAL"
say "$total" "Samlet: $total ($N_FAIL feil, $N_WARN advarsler, $N_OK i orden). Hva du gjør: docs/drift/driftstatus.md."
# say() har telt «Samlet»-linjen selv; det endrer ikke utgangskoden.
exit "$rc"
