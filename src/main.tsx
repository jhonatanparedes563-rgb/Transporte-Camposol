import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Automatically detect and apply service worker updates
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.ready.then((registration) => {
    // Check for updates immediately when app loads
    registration.update().catch(() => {});
  });

  // When a new service worker takes over, reload once to ensure the user gets the latest build
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      refreshing = true;
      window.location.reload();
    }
  });

  // Re-check for updates whenever the tab gains focus or visibility
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      navigator.serviceWorker.getRegistration().then((reg) => {
        reg?.update().catch(() => {});
      });
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
