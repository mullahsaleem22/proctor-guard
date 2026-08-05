import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // Ensures relative path resolving for free static hosting (GitHub Pages/Netlify)
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
    minify: 'terser'
  },
  server: {
    port: 3000,
    open: true
  }
});
