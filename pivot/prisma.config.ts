import "dotenv/config";
import { defineConfig } from "prisma/config";

// Prisma 7 no longer reads .env on its own; dotenv loads .env for the CLI.
// The database URL is optional here so `prisma generate` (run by `npm install`)
// works before .env exists; migrate and seed still need it.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  ...(process.env.DATABASE_URL ? { datasource: { url: process.env.DATABASE_URL } } : {}),
});
