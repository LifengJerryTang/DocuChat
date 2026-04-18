import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    env: {
      DATABASE_URL: 'file:./test.db',
      JWT_ACCESS_SECRET: 'test-access-secret-at-least-thirty-two-characters-long',
      JWT_REFRESH_SECRET: 'test-refresh-secret-at-least-thirty-two-characters-long',
      NODE_ENV: 'test',
      PORT: '3001',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/config/**'],
    },
  },
});
