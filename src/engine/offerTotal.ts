// «Med kontrollerte tilbud»: en egen sum ved siden av basissummen. Ren funksjon, ingen nettverk eller klokke.
// Basiskurven, butikksammenligningen og budsjettsvaret endres aldri; tilbud blandes ikke inn i katalogprisene.
// Besparelsen regnes fra tilbudets egen førpris (som i deals.ts), ikke mot katalogprisen, fordi katalogen kan være
// demodata mens tilbudene er ekte. Tilbud uten førpris gir dekning, ikke besparelse.
// Bare tilbud fra kjeder i `settings.offerChains` teller, og summen forutsetter at tilbudsvaren kjøpes hos den kjeden
// (Tjek skiller ikke på utsalg). Demobutikkene har ingen kjede; tilbudslinjene viser kjeden de gjelder.
import type { OfferHint } from './deals';
import { hintsForChains, prePrice, validOnDate } from './deals';
import { chainSet } from './chains';
import type { Basket, Settings } from './types';

const EPS = 1e-9;

export interface OfferTotalLine {
  ingredient: string; offerId: string; dealer: string; packs: number; packSize: number;
  priceOre: number; prePriceOre: number; savingOre: number;
}
/** `kjede`: ingen kjede er valgt i `offerChains`, så ingen tilbud kan knyttes til husstanden. */
export type OfferTotalBlock = 'av' | 'allergifilter' | 'kjede' | null;
export interface OfferTotal {
  /** Basiskurvens sum, uendret. */
  baseOre: number;
  /** Basissum minus besparelse på kontrollerte tilbud. */
  totalOre: number;
  savingOre: number;
  lines: OfferTotalLine[];
  /** Ingredienser med kontrollert tilbud uten (høyere) førpris: dekket, men ingen besparelse regnet. */
  coveredOnly: string[];
  /** Samme som basiskurven: ukjent pris fylles aldri av et tilbud, så en ufullstendig kurv forblir en delsum. */
  complete: boolean;
  /** Hvorfor tilbud ikke er regnet med. */
  blocked: OfferTotalBlock;
}

/** Et tilbud kan brukes i summen bare når regelen er godkjent, det er gyldig på handledagen og mengden er kjent. */
export const usableHint = (h: OfferHint, shopDate: string) =>
  h.approved === true && validOnDate(h, shopDate) && h.amount > 0 && h.priceOre > 0 && Number.isInteger(h.priceOre);

export function totalWithOffers(
  basket: Basket, hints: OfferHint[], shopDate: string, settings: Pick<Settings, 'avoid' | 'useOffers' | 'offerChains'>,
): OfferTotal {
  const base: OfferTotal = {
    baseOre: basket.totalOre, totalOre: basket.totalOre, savingOre: 0, lines: [], coveredOnly: [], complete: basket.complete, blocked: null,
  };
  if (settings.useOffers === false) return { ...base, blocked: 'av' };
  // Tilbudsvarer har uavklart allergenstatus. Ved aktivt allergifilter godkjennes de aldri (regel 4).
  if (settings.avoid.length > 0) return { ...base, blocked: 'allergifilter' };
  // Tilbudet gjelder kjeden, ikke et bestemt utsalg. Summen forutsetter at varen kjøpes hos en valgt kjede.
  if (chainSet(settings.offerChains).size === 0) return { ...base, blocked: 'kjede' };

  const usable = hintsForChains(hints, settings.offerChains).filter((h) => usableHint(h, shopDate));
  const lines: OfferTotalLine[] = [];
  const coveredOnly: string[] = [];
  for (const line of [...basket.lines].sort((a, b) => a.ingredient.localeCompare(b.ingredient))) {
    // Ukjent pris fylles aldri inn av et tilbud; da ville tilbudssummen se mer komplett ut enn kurven.
    if (line.costOre === null || line.need <= 0) continue;
    let best: OfferTotalLine | null = null;
    for (const h of usable) {
      if (h.ingredient !== line.ingredient || h.unit !== line.unit) continue;
      const packs = Math.max(1, Math.ceil(line.need / h.amount - EPS));
      const pre = prePrice(h) ?? h.priceOre;
      const cand: OfferTotalLine = {
        ingredient: line.ingredient, offerId: h.id, dealer: h.dealer, packs, packSize: h.amount,
        priceOre: h.priceOre, prePriceOre: pre, savingOre: Math.min(line.costOre, packs * (pre - h.priceOre)),
      };
      // Størst besparelse, så lavest utlegg, så id: fast regel ved likhet.
      const better = !best || cand.savingOre > best.savingOre ||
        (cand.savingOre === best.savingOre && (packs * h.priceOre < best.packs * best.priceOre ||
          (packs * h.priceOre === best.packs * best.priceOre && h.id < best.offerId)));
      if (better) best = cand;
    }
    if (!best) continue;
    if (best.savingOre > 0) lines.push(best);
    else coveredOnly.push(line.ingredient);
  }
  const savingOre = lines.reduce((s, l) => s + l.savingOre, 0);
  return { ...base, totalOre: basket.totalOre - savingOre, savingOre, lines, coveredOnly };
}
