import { execSync } from "node:child_process";

/**
 * Database tests run against TEST_DATABASE_URL (never DATABASE_URL). Setup
 * only applies migrations; it never deletes data. Each test creates its own
 * uniquely named users and Stripe ids, so runs don't interfere.
 * Without TEST_DATABASE_URL, database tests are skipped.
 */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    console.warn("\n[tests] TEST_DATABASE_URL not set: skipping database tests.\n");
    return;
  }
  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: url },
    stdio: "pipe",
  });
}
