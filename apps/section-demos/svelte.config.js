import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),

  kit: {
    adapter: adapter({
      pages: 'build',
      assets: 'build',
      fallback: undefined,
      precompress: false,
      strict: true
    })
  },

  // Allow custom elements from packages that use them
  compilerOptions: {
    customElement: false
  },

  // Configure vite-plugin-svelte to handle custom elements
  vitePlugin: {
    inspector: {
      toggleKeyCombo: 'meta-shift',
      holdMode: true
    },
    dynamicCompileOptions({ filename }) {
      // Enable custom element compilation for PieSectionPlayer
      if (filename.includes('pie-section-player/src/PieSectionPlayer.svelte')) {
        return {
          customElement: true
        };
      }
      return {
        customElement: false
      };
    }
  }
};

export default config;
