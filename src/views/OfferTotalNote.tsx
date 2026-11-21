import type { OfferTotal } from '../engine/offerTotal';
import { kr } from '../engine/format';

/** «Med kontrollerte tilbud»-summen, vist ved siden av basissummen. Basissummen endres aldri av tilbud. */
export default function OfferTotalNote({ total, approvedHints, className = 'offertotal' }: { total: OfferTotal; approvedHints: number; className?: string }) {
  if (approvedHints === 0) return null;
  if (total.blocked === 'allergifilter') {
    return <p className={`fine ${className}`}>Allergifilter er på: tilbudsvarer har uavklart allergenstatus, så kontrollerte tilbud regnes ikke inn.</p>;
  }
  if (total.blocked || total.lines.length === 0) return null;
  const dealers = [...new Set(total.lines.map((l) => l.dealer))].sort().join(', ');
  return (
    <div className={className}>
      <div className="drow"><span>🏷 Med kontrollerte tilbud{total.complete ? '' : ' (delsum)'}</span><strong>{kr(total.totalOre)}, anslått</strong></div>
      <p className="fine">
        {kr(total.savingOre)} lavere enn summen over på {total.lines.length} vare{total.lines.length === 1 ? '' : 'r'}, regnet fra tilbudets egen førpris.
        Gjelder bare hvis du kjøper tilbudsvarene hos {dealers} på handledagen. Tilbudene er ekte (Tjek) og kontrollert av redaktør; summen over er uendret.
        {total.coveredOnly.length > 0 && ` ${total.coveredOnly.length} tilbud uten førpris er ikke regnet med.`}
      </p>
    </div>
  );
}
