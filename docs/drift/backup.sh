#!/usr/bin/env bash
# Konsistent sikkerhetskopi av synk-databasen (middag.sqlite) og tilbudsdatabasen med prishistorikk fra Tjek (tilbud.sqlite)
# mens serveren kjører, kryptert med age (eller gpg) før den forlater maskinen. Hver database blir én egen kryptert fil
# (middag-<tid>.sqlite.age og tilbud-<tid>.sqlite.age) med samme kryptering og samme slettefrist.
# Se docs/hosting.md («Sikkerhetskopi og gjenoppretting»). Kjøres fra denne katalogen på serveren, f.eks. fra cron.
#
#   BACKUP_AGE_RECIPIENT=age1...   ./backup.sh        (offentlig nøkkel; den private nøkkelen ligger IKKE på serveren)
#   BACKUP_GPG_RECIPIENT=epost     ./backup.sh        (alternativ med gpg)
#
# Kopien lages med SQLite sin «VACUUM INTO» inne i app-containeren (node:sqlite). Det gir én fullstendig,
# WAL-sikker fil. Ikke kopier middag.sqlite alene med cp mens serveren kjører: den kan mangle det som ligger i -wal.
# Scriptet sender ikke kopien noe sted: kopiér filene i ./backup til lagring i EØS (egen avtale, se personvern/04).
set -euo pipefail
cd "$(dirname "$0")"

DEST="${BACKUP_DIR:-./backup}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-30}"          # forslag fra personvernutkastet; må avgjøres av eier
COMPOSE=(docker compose --env-file .env.drift)
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"

if [[ -z "${BACKUP_AGE_RECIPIENT:-}" && -z "${BACKUP_GPG_RECIPIENT:-}" ]]; then
  echo "Sett BACKUP_AGE_RECIPIENT (age) eller BACKUP_GPG_RECIPIENT (gpg). Ukrypterte kopier lages ikke." >&2
  exit 2
fi
umask 077
mkdir -p "$DEST"

# Én database: kopi inne i containeren, kontroll, kryptering ut av containeren, opprydding.
#   $1 = navn på kopien (middag | tilbud), $2 = JavaScript-uttrykk for stien inne i containeren,
#   $3 = «valgfri» hvis databasen kan mangle (tilbud). Mangler synk-databasen, er det en feil (feil volum?).
backup_db() {
  local NAME="$1" PATH_EXPR="$2" OPTIONAL="${3:-}"
  local TMP_IN_CONTAINER="/tmp/backup-${NAME}-${STAMP}.sqlite"
  # 1) Kopi inne i containeren (/tmp er tmpfs; filen forsvinner når containeren stoppes). Finnes ikke databasen, opprettes
  #    den ikke (kode 3): tilbudsdatabasen hoppes da over (f.eks. OFFER_STORE=0), synk-databasen gir feil.
  local rc=0
  "${COMPOSE[@]}" exec -T app node --no-warnings -e '
    const { existsSync } = require("node:fs");
    const { DatabaseSync } = require("node:sqlite");
    const src = '"$PATH_EXPR"';
    if (src === ":memory:" || !existsSync(src)) { console.log("finnes ikke: " + src); process.exit(3); }
    const db = new DatabaseSync(src);
    db.exec("PRAGMA busy_timeout = 5000");
    db.exec(`VACUUM INTO \x27${process.argv[1]}\x27`);
    db.close();
    const c = new DatabaseSync(process.argv[1], { readOnly: true });
    const r = c.prepare("PRAGMA integrity_check").get();
    if (r.integrity_check !== "ok") { console.error("Kopien består ikke integrity_check"); process.exit(1); }
    console.log("kopi ok");
  ' "$TMP_IN_CONTAINER" || rc=$?
  if [[ $rc -eq 3 && "$OPTIONAL" == "valgfri" ]]; then echo "Hopper over ${NAME}: databasen finnes ikke."; return 0; fi
  if [[ $rc -eq 3 ]]; then echo "Fant ikke ${NAME}-databasen. Er volumet montert riktig? Ingen kopi laget." >&2; return 1; fi
  if [[ $rc -ne 0 ]]; then return "$rc"; fi

  # 2) Ut av containeren og rett inn i kryptering (ingen ukryptert fil på verten).
  local OUT="$DEST/${NAME}-${STAMP}.sqlite"
  if [[ -n "${BACKUP_AGE_RECIPIENT:-}" ]]; then
    "${COMPOSE[@]}" exec -T app cat "$TMP_IN_CONTAINER" | age -r "$BACKUP_AGE_RECIPIENT" -o "${OUT}.age"
    OUT="${OUT}.age"
  else
    "${COMPOSE[@]}" exec -T app cat "$TMP_IN_CONTAINER" | gpg --batch --yes --encrypt --recipient "$BACKUP_GPG_RECIPIENT" -o "${OUT}.gpg"
    OUT="${OUT}.gpg"
  fi
  "${COMPOSE[@]}" exec -T app rm -f "$TMP_IN_CONTAINER"
  echo "Sikkerhetskopi: $OUT"
}

# Synk-databasen (husstander) og tilbudsdatabasen (prishistorikk fra Tjek, docs/synk.md «Tilbud fra Tjek»). Stiene følger
# serverens egne standarder: SYNC_DB / OFFER_DB, ellers $DATA_DIR/middag.sqlite og $DATA_DIR/tilbud.sqlite.
backup_db middag 'process.env.SYNC_DB ?? (process.env.DATA_DIR ?? "/data") + "/middag.sqlite"'
backup_db tilbud 'process.env.OFFER_DB ?? (process.env.DATA_DIR ?? "/data") + "/tilbud.sqlite"' valgfri

# 3) Rydd lokale kopier eldre enn KEEP_DAYS. Kopier som er lastet opp andre steder må ha samme slettefrist der
#    (docs/hosting.md, «Slettefrist for sikkerhetskopier»): slettede husstander ligger i kopiene til de er ryddet.
find "$DEST" -maxdepth 1 -type f \( -name 'middag-*.sqlite.age' -o -name 'middag-*.sqlite.gpg' -o -name 'tilbud-*.sqlite.age' -o -name 'tilbud-*.sqlite.gpg' \) \
  -mtime "+${KEEP_DAYS}" -print -delete
