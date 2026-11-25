import { createRoot } from 'react-dom/client';
import App from './App';
import TabGate from './views/TabGate';
import './styles.css';

/**
 * Serveren krever Trusted Types (CSP i server/app.ts, docs/sikkerhet.md): en vanlig streng kan ikke bli en skript-URL.
 * Den eneste skript-URL-en appen lager, er service workeren; denne policyen godtar bare den.
 */
function serviceWorkerUrl(): string {
  type Policy = { createScriptURL(u: string): unknown };
  const tt = (window as unknown as { trustedTypes?: { createPolicy(name: string, rules: { createScriptURL(u: string): string }): Policy } }).trustedTypes;
  if (!tt) return '/sw.js';
  const policy = tt.createPolicy('sw', {
    createScriptURL: (u) => { if (u !== '/sw.js') throw new TypeError('Skript-URL er ikke tillatt'); return u; },
  });
  return policy.createScriptURL('/sw.js') as string;
}

createRoot(document.getElementById('root')!).render(<TabGate><App /></TabGate>);
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  try { navigator.serviceWorker.register(serviceWorkerUrl()).catch(() => {}); } catch { /* uten service worker virker appen som før, bare ikke frakoblet */ }
}
