import type { Config } from 'drizzle-kit';

export default {
  schema: './server/db/schema/*',
  out: './server/db/migrations',
  driver: 'better-sqlite',
  dbCredentials: {
    url: process.env.DATABASE_URL || 
      (process.env.NODE_ENV === 'production' 
        ? '/var/www/vaultscope-statistics/database.db'
        : './database.db')
  },
  verbose: true,
  strict: true,
} satisfies Config;