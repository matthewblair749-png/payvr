import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// Prisma 7 no longer reads .env on its own; dotenv loads .env for the CLI.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
