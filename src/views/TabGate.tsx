// Viser appen bare i den aktive fanen (V7; se src/singleTab.ts). En passiv fane monterer ikke appen, så den verken leser,
// skriver eller synker. Når fanen blir aktiv, monteres appen på nytt og leser det den andre fanen sist lagret.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { browserLocks, otherTabText, startTabGuard, type Locks, type TabRole } from '../singleTab';

export function OtherTabNotice({ onTakeOver }: { onTakeOver: () => void }) {
  return (
    <main className="app" aria-labelledby="annen-fane">
      <div className="pagehead"><h2 id="annen-fane">Åpen i en annen fane</h2></div>
      <p role="status">{otherTabText()}</p>
      <p className="fine">Lukker du den andre fanen, fortsetter appen her av seg selv.</p>
      <button className="cta" onClick={onTakeOver}>Bruk Husvett her</button>
    </main>
  );
}

export default function TabGate({ children, locks = browserLocks() }: { children: ReactNode; locks?: Locks | null }) {
  const [role, setRole] = useState<TabRole>(locks ? 'sjekker' : 'aktiv');
  const guard = useRef<ReturnType<typeof startTabGuard> | null>(null);
  useEffect(() => {
    const g = startTabGuard(locks, setRole);
    guard.current = g;
    return () => g.stop();
  }, [locks]);
  if (role === 'aktiv') return <>{children}</>;
  if (role === 'sjekker') return null; // et øyeblikk ved oppstart, før låsen er avklart
  return <OtherTabNotice onTakeOver={() => guard.current?.takeOver()} />;
}
