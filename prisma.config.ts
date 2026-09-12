import { config as loadEnv } from 'dotenv';
import { defineConfig, env } from 'prisma/config';

// Prisma 7 no longer reads the connection string from schema.prisma. The CLI
// takes the migration connection here; runtime uses DATABASE_URL via PrismaService.
loadEnv({ path: ['.env.local', '.env'], quiet: true });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: process.env.DIRECT_URL || env('DATABASE_URL') },
});
