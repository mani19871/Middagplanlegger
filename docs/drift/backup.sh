#!/usr/bin/env bash
# Konsistent sikkerhetskopi av synk-databasen mens serveren kjører, kryptert med age (eller gpg) før den forlater maskinen.
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
TMP_IN_CONTAINER="/tmp/backup-${STAMP}.sqlite"

if [[ -z "${BACKUP_AGE_RECIPIENT:-}" && -z "${BACKUP_GPG_RECIPIENT:-}" ]]; then
  echo "Sett BACKUP_AGE_RECIPIENT (age) eller BACKUP_GPG_RECIPIENT (gpg). Ukrypterte kopier lages ikke." >&2
  exit 2
fi
umask 077
mkdir -p "$DEST"

# 1) Kopi inne i containeren (/tmp er tmpfs; filen forsvinner når containeren stoppes).
"${COMPOSE[@]}" exec -T app node --no-warnings -e '
  const { DatabaseSync } = require("node:sqlite");
  const db = new DatabaseSync(process.env.SYNC_DB ?? (process.env.DATA_DIR ?? "/data") + "/middag.sqlite");
  db.exec("PRAGMA busy_timeout = 5000");
  db.exec(`VACUUM INTO \x27${process.argv[1]}\x27`);
  db.close();
  const c = new DatabaseSync(process.argv[1], { readOnly: true });
  const r = c.prepare("PRAGMA integrity_check").get();
  if (r.integrity_check !== "ok") { console.error("Kopien består ikke integrity_check"); process.exit(1); }
  console.log("kopi ok");
' "$TMP_IN_CONTAINER"

# 2) Ut av containeren og rett inn i kryptering (ingen ukryptert fil på verten).
OUT="$DEST/middag-${STAMP}.sqlite"
if [[ -n "${BACKUP_AGE_RECIPIENT:-}" ]]; then
  "${COMPOSE[@]}" exec -T app cat "$TMP_IN_CONTAINER" | age -r "$BACKUP_AGE_RECIPIENT" -o "${OUT}.age"
  OUT="${OUT}.age"
else
  "${COMPOSE[@]}" exec -T app cat "$TMP_IN_CONTAINER" | gpg --batch --yes --encrypt --recipient "$BACKUP_GPG_RECIPIENT" -o "${OUT}.gpg"
  OUT="${OUT}.gpg"
fi
"${COMPOSE[@]}" exec -T app rm -f "$TMP_IN_CONTAINER"

# 3) Rydd lokale kopier eldre enn KEEP_DAYS. Kopier som er lastet opp andre steder må ha samme slettefrist der
#    (docs/hosting.md, «Slettefrist for sikkerhetskopier»): slettede husstander ligger i kopiene til de er ryddet.
find "$DEST" -maxdepth 1 -type f \( -name 'middag-*.sqlite.age' -o -name 'middag-*.sqlite.gpg' \) -mtime "+${KEEP_DAYS}" -print -delete
echo "Sikkerhetskopi: $OUT"
