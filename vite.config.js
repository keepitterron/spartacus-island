import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Served from https://keepitterron.github.io/spartacus-island/ so every URL is under that base.
export default defineConfig({
  base: '/spartacus-island/',
  // es2022 for the top-level await in main.js (levels load before the world is built)
  build: { target: 'es2022', chunkSizeWarningLimit: 900 },
  plugins: [
    VitePWA({
      // the new version is picked up on the next launch; never reload in the middle of a game
      registerType: 'autoUpdate',
      injectRegister: 'script',
      // icons are generated from public/icon.svg (see pwa-assets.config.js)
      pwaAssets: { config: true, overrideManifestIcons: true },
      manifest: {
        name: 'Spartacus’s Island',
        short_name: 'Spartacus',
        description:
          'A cosy 3D pirate pup adventure. Sail from island to island, eat magic fruits and gather a crew of animal friends.',
        lang: 'en',
        theme_color: '#a8e6f7',
        background_color: '#a8e6f7',
        display: 'fullscreen',
        display_override: ['fullscreen', 'standalone'],
        orientation: 'any',
        categories: ['games', 'kids'],
      },
      workbox: {
        // .glb + .bin: islands made in Blender (levels/) and their heights, so they work offline too
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2,glb,bin}'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
});
