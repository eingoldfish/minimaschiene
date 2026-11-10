/**
 * Entry point of the app. Vite loads this file from index.html.
 */
import './styles.css';
import { App } from './ui/app';

const root = document.querySelector<HTMLElement>('#app');
if (!root) {
  throw new Error('Element #app not found in index.html');
}
new App(root);

/**
 * Offline support (PWA): register the service worker (public/sw.js).
 * Only in the built version – during development it would cache old files.
 */
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js')
      .then(() => navigator.serviceWorker.ready)
      .then((registration) => {
        // Tell the service worker which files this page loaded, so they are cached right away.
        const urls = [
          location.href.split('#')[0]!,
          ...performance.getEntriesByType('resource').map((entry) => entry.name),
        ];
        registration.active?.postMessage({ type: 'cache', urls });
      })
      .catch(() => {
        // No offline support (e.g. not served via https) – the app still works online.
      });
  });
}
