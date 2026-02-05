import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'PiePrintPlayer',
      fileName: 'print-player',
      formats: ['es'],
    },
    rollupOptions: {
      // Externalize lit to avoid bundling it
      external: [],
      output: {
        // Provide global variables for externalized deps in UMD build
        globals: {},
      },
    },
    // Generate sourcemaps for debugging
    sourcemap: true,
    // Target modern browsers
    target: 'es2020',
    // Minify for production
    minify: 'esbuild',
  },
  // Ensure proper module resolution
  resolve: {
    extensions: ['.ts', '.js'],
  },
});
