import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  define: { __APP_VERSION__: JSON.stringify('test'), __APP_BUILD__: JSON.stringify('test'), __FAKE_AUTH__: JSON.stringify(true) },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
