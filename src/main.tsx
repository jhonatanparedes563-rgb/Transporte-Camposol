import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Registro rápido del Service Worker sin caché HTTP para aplicar despliegues de GitHub al instante
if (typeof window !== 'undefined' && 'serviceWorker' in navigator && import.meta.env.PROD) {
  const baseUrl = import.meta.env.BASE_URL || '/';
  const hadController = Boolean(navigator.serviceWorker.controller);
  let refreshing = false;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  window.addEventListener(
    'load',
    () => {
      navigator.serviceWorker
        .register(`${baseUrl}sw.js`, {
          scope: baseUrl,
          updateViaCache: 'none',
        })
        .then((reg) => {
          let lastCheck = Date.now();
          reg.update().catch(() => {});
          document.addEventListener('visibilitychange', () => {
            if (document.visibilityState !== 'visible') return;
            const now = Date.now();
            if (now - lastCheck < 15000) return;
            lastCheck = now;
            reg.update().catch(() => {});
          });
        })
        .catch(() => {});
    },
    { once: true }
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
