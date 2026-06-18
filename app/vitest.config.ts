import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// Minimal jsdom test setup for component-level regression tests (e.g. the
// Studio per-image Settings editor). Scoped to *.test.tsx so it never picks up
// pipeline scripts. Path alias mirrors tsconfig ("@/..." → "./src/...").
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
