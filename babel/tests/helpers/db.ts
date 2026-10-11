import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { describe } from "vitest";
import { PrismaClient } from "@/generated/prisma/client";

export const hasTestDb = Boolean(process.env.TEST_DATABASE_URL);

/** `describe` that skips when no test database is configured. */
export const describeDb = describe.skipIf(!hasTestDb);

export const testDb = hasTestDb
  ? new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.TEST_DATABASE_URL }) })
  : (null as unknown as PrismaClient);

export async function createUser(overrides: { stripeCustomerId?: string } = {}) {
  return testDb.user.create({ data: { email: `${randomUUID()}@example.test`, ...overrides } });
}
