import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

// Scripts may only come from the plugin's own origin: no inline code, no
// eval, no remote scripts. Connections stay open, since sending requests
// anywhere is what the editor is for; so do styles, fonts and images,
// because the host injects its theme stylesheet from wherever the app
// keeps themes.
const CONTENT_SECURITY_POLICY = [
  "script-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

// Built pages only: the dev server injects inline scripts of its own.
const contentSecurityPolicy = (): Plugin => ({
  name: 'content-security-policy',
  apply: 'build',
  transformIndexHtml: () => [
    {
      tag: 'meta',
      attrs: { 'http-equiv': 'Content-Security-Policy', content: CONTENT_SECURITY_POLICY },
      injectTo: 'head-prepend',
    },
  ],
});

export default defineConfig({
  base: './',
  plugins: [react(), contentSecurityPolicy()],
  build: {
    outDir: 'build',
    // Lists every bundled dependency with its license text, shipped in the
    // zip and on Pages next to the code it covers.
    license: { fileName: 'THIRD_PARTY_LICENSES.md' },
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
    // e2e/ specs belong to Playwright, not to Vitest.
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/**', 'src/components/**'],
      // Demo wiring and the error-boundary fallback are exercised by the
      // e2e suite, not the unit tests.
      exclude: ['src/demo.tsx', 'src/**/*.test.*'],
      reporter: ['text', 'json-summary'],
      reportsDirectory: './coverage',
    },
  },
});
