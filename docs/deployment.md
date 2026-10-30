# Deployment

## GitHub Pages

Pushing to `main` runs `.github/workflows/deploy.yml`: `npm ci`, `npm run build`, upload `dist/`, deploy to Pages. The repo's Pages source must be **GitHub Actions** (it is). It can also be run by hand from the Actions tab (workflow_dispatch).

Live URL: https://keepitterron.github.io/spartacus-island/

Everything is served under `/spartacus-island/` (`base` in `vite.config.js`). If the repo is renamed or a custom domain is added, change `base`.

## PWA

`vite-plugin-pwa` generates the manifest and a Workbox service worker that precaches the whole game (JS, CSS, HTML, fonts, icons, about 700 KB), so it works offline after the first visit and can be installed:

- **iPhone/iPad:** Safari → Share → Add to Home Screen.
- **Android:** Chrome menu → Install app.

It opens full screen (`display: fullscreen`, falling back to standalone) in any orientation.

**Updates:** the new version downloads in the background and is used on the **next launch**. The game never reloads itself mid-play. If someone is stuck on an old version, closing and reopening the app is enough.

## Icons

One source image: `public/icon.svg` (Spartacus in his hat). At build time `@vite-pwa/assets-generator` (config: `pwa-assets.config.js`) makes `favicon.ico`, `apple-touch-icon-180x180.png`, `pwa-64/192/512` and a maskable icon, and injects the `<link>` tags and manifest icons. Edit the SVG and rebuild; no PNGs are committed.

## Fonts

Fredoka is bundled from `@fontsource/fredoka` (latin subset, weights 400–700) so it works offline and text sprites render with it. No requests to Google Fonts.

## Checks before sharing a link

- `npm run build` has no errors.
- The Actions run is green and the site loads at the URL above.
- Install it on a phone once and launch it offline (airplane mode).
