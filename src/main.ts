import './styles/fonts.css';
import './styles/tokens.css';
import './styles/app.css';

import { registerSW } from 'virtual:pwa-register';
import { renderHome } from './screens/home';
import { currentPlatform, shouldShowInstallHint } from './util/platform';

const root = document.querySelector<HTMLDivElement>('#app');
if (root) {
  root.innerHTML = renderHome({
    showInstallHint: shouldShowInstallHint(currentPlatform()),
    baseUrl: import.meta.env.BASE_URL,
  });
}

// Service Worker: Updates werden beim nächsten Start automatisch übernommen.
registerSW({ immediate: true });
