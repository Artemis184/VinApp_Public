import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    // Ejecuta el seed directamente con ts-node (no requiere build)
    seed: 'ts-node prisma/seed.ts',
  },
  datasource: {
    // Requiere que DATABASE_URL exista; si prefieres opcional, usa process.env.DATABASE_URL ?? ''
    url: env('DATABASE_URL'),
  },
});
