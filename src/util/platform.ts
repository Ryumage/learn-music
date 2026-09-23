export interface PlatformInfo {
  userAgent: string;
  platform?: string;
  maxTouchPoints?: number;
  standalone?: boolean;
  displayModeStandalone?: boolean;
}

/** iPhone, iPod oder iPad (auch iPadOS, das sich als „MacIntel“ mit Touch meldet). */
export function isIOS(info: PlatformInfo): boolean {
  if (/iPhone|iPad|iPod/.test(info.userAgent)) return true;
  return info.platform === 'MacIntel' && (info.maxTouchPoints ?? 0) > 1;
}

/** Läuft die App als Home-Bildschirm-App (ohne Browserleiste)? */
export function isStandalone(info: PlatformInfo): boolean {
  return info.standalone === true || info.displayModeStandalone === true;
}

/**
 * Installationshinweis nur in Safari auf iOS, nicht in der installierten App.
 * Safari löscht Website-Daten nach 7 Tagen ohne Besuch, Home-Bildschirm-Apps nicht.
 */
export function shouldShowInstallHint(info: PlatformInfo): boolean {
  return isIOS(info) && !isStandalone(info);
}

export function currentPlatform(): PlatformInfo {
  const nav = navigator as Navigator & { standalone?: boolean };
  return {
    userAgent: nav.userAgent,
    platform: nav.platform,
    maxTouchPoints: nav.maxTouchPoints,
    standalone: nav.standalone,
    displayModeStandalone: window.matchMedia?.('(display-mode: standalone)').matches ?? false,
  };
}
