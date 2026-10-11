import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// Prisma 7 doesn't read .env on its own; dotenv loads it for the CLI.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: env("DATABASE_URL") },
});
