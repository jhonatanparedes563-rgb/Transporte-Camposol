import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Registro inmediato del Service Worker y detección ultrarrápida de nuevas versiones en móvil/PWA
if (typeof window !== 'undefined' && import.meta.env.PROD) {
  const baseUrl = import.meta.env.BASE_URL || '/';
  let refreshing = false;

  const triggerReloadOnce = (reasonKey?: string) => {
    if (refreshing) return;
    if (reasonKey) {
      try {
        if (sessionStorage.getItem('camposol_reloaded_ver') === reasonKey) return;
        sessionStorage.setItem('camposol_reloaded_ver', reasonKey);
      } catch {
        // ignore
      }
    }
    refreshing = true;
    window.location.reload();
  };

  // Verificar en segundo plano si index.html desplegado apunta a un bundle distinto al actual (<200ms)
  let lastHtmlCheck = 0;
  const checkLiveBundleUpdate = async () => {
    if (!navigator.onLine) return;
    const now = Date.now();
    if (now - lastHtmlCheck < 2500) return;
    lastHtmlCheck = now;

    try {
      const currentScript = document.querySelector<HTMLScriptElement>('script[type="module"][src*="assets/index-"]');
      const currentSrc = currentScript?.getAttribute('src');
      if (!currentSrc) return;

      const res = await fetch(`${baseUrl}index.html?_t=${now}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (!res.ok) return;
      const html = await res.text();
      const match = html.match(/src="([^"]*assets\/index-[^"]+\.js)"/);
      const liveSrc = match?.[1];
      if (liveSrc && liveSrc !== currentSrc) {
        triggerReloadOnce(liveSrc);
      }
    } catch {
      // Sin conexión o error transitorio de red
    }
  };

  if ('serviceWorker' in navigator) {
    const hadController = Boolean(navigator.serviceWorker.controller);

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController) return;
      triggerReloadOnce();
    });

    navigator.serviceWorker
      .register(`${baseUrl}sw.js`, {
        scope: baseUrl,
        updateViaCache: 'none',
      })
      .then((reg) => {
        if (reg.waiting && hadController) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }

        reg.addEventListener('updatefound', () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              installing.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });

        let lastSwCheck = 0;
        const checkUpdates = () => {
          const now = Date.now();
          if (now - lastSwCheck >= 2500) {
            lastSwCheck = now;
            reg.update().catch(() => {});
          }
          checkLiveBundleUpdate();
        };

        checkUpdates();
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') checkUpdates();
        });
        window.addEventListener('focus', checkUpdates);
        window.addEventListener('pageshow', checkUpdates);
        window.addEventListener('online', checkUpdates);
      })
      .catch(() => {});
  }
} else if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker
    .getRegistrations()
    .then((regs) => {
      regs.forEach((reg) => {
        reg.unregister().catch(() => {});
      });
    })
    .catch(() => {});
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
