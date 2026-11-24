// Norsk kalenderdato for et tidspunkt. Ren kalenderregning med fast regel (ingen klokke, ingen Intl eller tidssonedatabase),
// så motor, klient og server gir samme dato for samme tekst (regel 1). Norge følger EUs sommertid siden 1996: CEST (+2)
// fra siste søndag i mars 01:00 UTC til siste søndag i oktober 01:00 UTC, ellers CET (+1). Kodegjennomgang runde 2, M5.

/**
 * Dagnummer (dager siden 1970-01-01) for en gregoriansk dato (H. Hinnants `days_from_civil`). Ugyldig dato gir null.
 */
export function civilDay(y0: number, mo: number, d: number): number | null {
  if (!Number.isInteger(y0) || !Number.isInteger(mo) || !Number.isInteger(d)) return null;
  const leap = (y0 % 4 === 0 && y0 % 100 !== 0) || y0 % 400 === 0;
  const dim = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (mo < 1 || mo > 12 || d < 1 || d > dim[mo - 1]) return null;
  const y = mo <= 2 ? y0 - 1 : y0;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const doy = Math.floor((153 * (mo + (mo > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

/** ÅÅÅÅ-MM-DD fra dagnummer (`civil_from_days`). */
export function dayToIso(z0: number): string {
  const z = z0 + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp < 10 ? mp + 3 : mp - 9;
  const y = yoe + era * 400 + (m <= 2 ? 1 : 0);
  const p = (n: number, w: number) => String(n).padStart(w, '0');
  return `${y < 0 ? '-' : ''}${p(Math.abs(y), 4)}-${p(m, 2)}-${p(d, 2)}`;
}

/** Dagnummer for siste søndag i måneden. 1970-01-01 var en torsdag. */
function lastSunday(y: number, mo: number): number {
  const next = mo === 12 ? civilDay(y + 1, 1, 1)! : civilDay(y, mo + 1, 1)!;
  const last = next - 1;
  const weekday = (((last + 4) % 7) + 7) % 7; // 0 = søndag
  return last - weekday;
}

/** Sommertid i Norge for et UTC-tidspunkt i minutter siden 1970 (EU-regelen). */
function summerTime(utcMin: number): boolean {
  const y = Number(dayToIso(Math.floor(utcMin / 1440)).slice(0, 4));
  const start = lastSunday(y, 3) * 1440 + 60;
  const end = lastSunday(y, 10) * 1440 + 60;
  return utcMin >= start && utcMin < end;
}

const ISO = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:[.,]\d+)?)?\s*(Z|[+-]\d{2}(?::?\d{2})?)?)?/i;

/**
 * Norsk dato (ÅÅÅÅ-MM-DD) for en dato eller ISO-tid.
 * - Bare dato, eller tid uten sone: datoen slik den står (den er allerede en norsk dato eller lokal tid).
 * - Tid med sone (`Z`, `+01:00`, `+0100`): omregnet til norsk tid, så 23:30Z 8. nov blir 9. nov.
 * Ulesbar eller ugyldig tekst gir null.
 */
export function osloDate(iso: string): string | null {
  const m = ISO.exec(iso);
  if (!m) return null;
  const day = civilDay(Number(m[1]), Number(m[2]), Number(m[3]));
  if (day === null) return null;
  if (m[4] === undefined || m[7] === undefined) return `${m[1]}-${m[2]}-${m[3]}`;
  const h = Number(m[4]), min = Number(m[5]), s = m[6] === undefined ? 0 : Number(m[6]);
  if (h > 24 || min > 59 || s > 60 || (h === 24 && (min > 0 || s > 0))) return null;
  let offset = 0;
  if (m[7].toUpperCase() !== 'Z') {
    const z = /^([+-])(\d{2}):?(\d{2})?$/.exec(m[7]);
    if (!z || Number(z[2]) > 23 || Number(z[3] ?? 0) > 59) return null;
    offset = (z[1] === '-' ? -1 : 1) * (Number(z[2]) * 60 + Number(z[3] ?? 0));
  }
  const utcMin = day * 1440 + h * 60 + min - offset; // sekunder flytter aldri over et helt minutt-skille som betyr noe her
  const local = utcMin + (summerTime(utcMin) ? 120 : 60);
  return dayToIso(Math.floor(local / 1440));
}

/** UTC-tidspunktet (ISO med Z) for norsk midnatt ved starten av datoen. Midnatt ligger aldri i et sommertidsskifte. */
export function osloMidnightUtc(date: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const day = m ? civilDay(Number(m[1]), Number(m[2]), Number(m[3])) : null;
  if (day === null) return null;
  const summer = day * 1440 - 120;
  const utcMin = summerTime(summer) ? summer : day * 1440 - 60;
  const d = Math.floor(utcMin / 1440), rest = utcMin - d * 1440;
  return `${dayToIso(d)}T${String(Math.floor(rest / 60)).padStart(2, '0')}:${String(rest % 60).padStart(2, '0')}:00.000Z`;
}
