import { config as loadEnv } from 'dotenv';
import { defineConfig, env } from 'prisma/config';

// Prisma 7 no longer reads the connection string from schema.prisma. The CLI
// takes it from here; the running application takes it from PrismaService,
// which passes the same url to the pg adapter.
loadEnv({ path: ['.env.local', '.env'], quiet: true });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: env('DATABASE_URL') },
});
