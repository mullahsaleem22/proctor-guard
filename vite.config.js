import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // Ensures relative path resolving for free static hosting (GitHub Pages/Vercel/Netlify)
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
    minify: 'esbuild' // Built-in minifier (No external terser package required)
  },
  server: {
    port: 3000,
    open: true
  }
});
