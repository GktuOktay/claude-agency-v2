import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  build: { target: 'es2022', chunkSizeWarningLimit: 900 },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
    // Procedural tower builds (~0.3 s each) contend for CPU when files run in parallel.
    testTimeout: 15000,
  },
});
