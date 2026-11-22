// Ord som tyder på kampanjevilkår vi ikke kan regne med (medlemspris, «3 for 2», kupong, mengdetak …). Ren funksjon.
// Delt av tilbudsmatchingen (src/offers/match.ts) og husholdningsvarene (household.ts).
const CONDITIONS = [/medlem/, /trumf/, /kupong/, /ved kjøp av/, /\d+\s*for\s*\d+/, /\d+\s*%/, /maks\.?\s*\d/, /(per|pr\.?)\s*kunde/, /app-?pris/, /i appen/, /æ-?pris/];
/** Har teksten (overskrift og beskrivelse) ord om vilkår? Store og små bokstaver er likegyldige. */
export const hasConditionText = (text: string) => {
  const t = text.toLowerCase();
  return CONDITIONS.some((r) => r.test(t));
};
