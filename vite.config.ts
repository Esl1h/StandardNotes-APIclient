import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    outDir: 'build',
    rollupOptions: {
      input: {
        main: 'index.html',
        demo: 'demo.html',
      },
    },
  },
  server: {
    // Standard Notes needs CORS when served for dev installs too.
    cors: true,
  },
  preview: {
    port: 3000,
    // The Standard Notes app downloads dev extensions over HTTP and
    // needs permissive CORS to fetch them.
    cors: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.ts',
  },
});
