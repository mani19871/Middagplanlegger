import { useEffect, useRef, type ReactNode, type RefObject } from 'react';

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex]:not([tabindex="-1"])';

/** Dialog-oppførsel: fokus inn ved åpning, fokusfelle med Tab, Escape lukker, fokus tilbake til utløseren ved lukking. */
export function useDialog(ref: RefObject<HTMLElement | null>, onClose: () => void) {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const opener = document.activeElement as HTMLElement | null;
    // Radioknapper i samme gruppe har bare ett tabstopp (den valgte, ellers den første).
    const stop = (x: HTMLElement) => {
      if (!(x instanceof HTMLInputElement) || x.type !== 'radio' || !x.name) return true;
      const group = [...el.querySelectorAll<HTMLInputElement>(`input[type=radio]`)].filter((r) => r.name === x.name);
      return x === (group.find((r) => r.checked) ?? group[0]);
    };
    const items = () => [...el.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((x) => (x.offsetParent !== null || x === document.activeElement) && stop(x));
    (el.querySelector<HTMLElement>('[data-autofocus]') ?? items()[0] ?? el).focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); close.current(); return; }
      if (e.key !== 'Tab') return;
      const f = items();
      if (f.length === 0) { e.preventDefault(); return; }
      const first = f[0], last = f[f.length - 1], cur = document.activeElement;
      if (!el.contains(cur)) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && cur === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && cur === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); if (opener && document.contains(opener)) opener.focus(); };
  }, [ref]);
}

/** Bunnark som modal dialog: bakgrunnsklikk og Escape lukker, fokus fanges og returneres. */
export function Sheet({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useDialog(ref, onClose);
  return (
    <div className="backdrop" onClick={onClose}>
      <div className="sheet" ref={ref} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
