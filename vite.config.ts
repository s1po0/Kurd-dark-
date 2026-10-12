import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Relative base so the same build works from GitHub Pages, a phone's
// file://-style WebView asset folder and a plain static server.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  // Dev and preview servers only (never part of the APK). allowedHosts lets the
  // sandbox preview proxy reach them; the bundle itself is served as static files.
  server: { host: '0.0.0.0', port: 5173, allowedHosts: true },
  preview: { host: '0.0.0.0', port: 4173, allowedHosts: true },
  build: {
    target: 'es2022',
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 2000, // Phaser is one large vendor chunk by design
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
