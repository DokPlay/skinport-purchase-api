import { defineConfig } from 'vitest/config';
import * as dotenv from 'dotenv';
import path from 'path';

// Load test environment
dotenv.config({ path: path.resolve(__dirname, '.env.test') });

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    env: {
      BASE_URL: process.env.BASE_URL || 'http://127.0.0.1:3000',
      DATABASE_URL: process.env.DATABASE_URL || 'postgres://postgres:postgres@127.0.0.1:5432/skinport',
      REDIS_URL: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
    },
  },
});
