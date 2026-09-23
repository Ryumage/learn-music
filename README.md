# Saitenlesen

Lern-Web-App für Gitarre: Noten lesen, Griffbrett, Saiten, Akkorde, Tabs und Rhythmus.
Läuft kostenlos auf GitHub Pages, ist fürs iPhone gemacht und funktioniert offline.

**Adresse:** https://ryumage.github.io/learn-music/

- Spezifikation: [`PLAN.md`](PLAN.md) · Arbeitsanweisung: [`CLAUDE.md`](CLAUDE.md)
- Recherche: [`docs/recherche.md`](docs/recherche.md) · Cheat Sheets: [`docs/cheatsheets/`](docs/cheatsheets/)

## Entwicklung

```sh
npm ci
npm run dev          # Entwicklungsserver
npm run lint         # ESLint
npm run typecheck    # TypeScript
npm test             # Unit-Tests (Vitest)
npm run build        # Produktions-Build nach dist/
npm run test:e2e     # E2E (Playwright, WebKit/iPhone 13) gegen den Build
```

Die E2E-Tests laufen gegen `vite preview`, also vorher `npm run build`.
Ist WebKit lokal nicht installiert, geht auch Chromium: `PW_BROWSER=chromium npm run test:e2e`.

Hilfsskripte (Python, `pip install fonttools brotli pillow`):

- `npm run fonts:subset` – reduziert Noto Music auf 𝄠 ♯ ♭ ♮ (`src/assets/fonts/noto-music-subset.woff2`)
- `python3 scripts/make-icons.py` – erzeugt die App-Icons in `public/icons/`

## Deployment

1. Repo muss **öffentlich** sein (GitHub Pages ist im kostenlosen Plan nur für öffentliche Repos verfügbar).
2. **Settings → Pages → Source: GitHub Actions**.
3. Jeder Push auf `main` testet, baut und veröffentlicht `dist/` (Workflow `.github/workflows/ci.yml`).

## Auf dem iPhone

In **Safari** öffnen → **Teilen → Zum Home-Bildschirm**. Dann startet die App ohne Browserleiste,
funktioniert offline und der Lernstand bleibt erhalten. Updates kommen automatisch beim nächsten Start.
