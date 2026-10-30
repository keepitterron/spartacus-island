import {defineConfig,minimal2023Preset} from '@vite-pwa/assets-generator/config';

// Generates favicon, apple-touch-icon and the PWA/maskable icons from one SVG at build time.
export default defineConfig({
  headLinkOptions:{preset:'2023'},
  preset:{...minimal2023Preset,
    maskable:{...minimal2023Preset.maskable,resizeOptions:{background:'#a8e6f7'}},
    apple:{...minimal2023Preset.apple,resizeOptions:{background:'#a8e6f7'}}},
  images:['public/icon.svg'],
});
