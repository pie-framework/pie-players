import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  server: {
    port: 3000,
    open: true
  },
  resolve: {
    alias: {
      '@pie-players/pie-calculator': '../calculator/src'
    }
  }
});
