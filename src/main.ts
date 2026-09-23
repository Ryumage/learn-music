import './styles/fonts.css';
import './styles/tokens.css';
import './styles/app.css';
import './styles/components.css';

import { registerSW } from 'virtual:pwa-register';
import { App } from './app';
import { Store } from './learn/store';
import { currentPlatform, shouldShowInstallHint } from './util/platform';

function localStorageOrNull(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

const root = document.querySelector<HTMLDivElement>('#app');
if (root) {
  const app = new App({
    root,
    store: new Store(localStorageOrNull()),
    baseUrl: import.meta.env.BASE_URL,
    showInstallHint: shouldShowInstallHint(currentPlatform()),
  });
  app.render();
  (window as unknown as { __saitenlesen: { probe: () => unknown } }).__saitenlesen = { probe: () => app.probe() };
}

// Service Worker: Updates werden beim nächsten Start automatisch übernommen.
registerSW({ immediate: true });
