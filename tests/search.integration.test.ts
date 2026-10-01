/**
 * ⌘K search and the customers list (real Postgres).
 */
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { db } from "@/server/db";
import { listCustomers, liveStatus } from "@/server/dal/orders";
import { amountFromTerm, searchWorkspace } from "@/server/dal/search";

const RUN = Math.random().toString(36).slice(2, 8);
const userIds: string[] = [];
let mine = "";
let theirs = "";

async function merchant(tag: string) {
  const user = await db.user.create({ data: { email: `se-${tag}-${RUN}@lumen.test` } });
  userIds.push(user.id);
  return (await db.merchant.create({ data: { userId: user.id, name: tag } })).id;
}

beforeAll(async () => {
  mine = await merchant("mine");
  theirs = await merchant("theirs");
  await db.checkoutPage.create({ data: { merchantId: mine, name: "Speckled mugs", slug: `se-mugs-${RUN}`, draftConfig: {} } });
  const order = (merchantId: string, email: string, cents: number, minsAgo: number, status: "SUCCEEDED" | "FAILED" | "REFUNDED" = "SUCCEEDED", refunded = 0) => ({
    merchantId,
    customerEmail: email,
    amountCents: cents,
    refundedCents: refunded,
    currency: "usd",
    status,
    createdAt: new Date(Date.now() - minsAgo * 60_000),
  });
  await db.order.createMany({
    data: [
      order(mine, `ada-${RUN}@example.com`, 4800, 5),
      order(mine, `ada-${RUN}@example.com`, 2400, 60 * 24, "REFUNDED", 2400),
      order(mine, `bo-${RUN}@example.com`, 8500, 60 * 48),
      order(mine, `cy-${RUN}@example.com`, 1200, 30, "FAILED"),
      order(theirs, `ada-${RUN}@example.com`, 9900, 2),
    ],
  });
});

afterAll(async () => {
  await db.user.deleteMany({ where: { id: { in: userIds } } });
  await db.$disconnect();
});

describe("amountFromTerm", () => {
  it("reads amounts the way merchants type them", () => {
    expect(amountFromTerm("24")).toBe(2400);
    expect(amountFromTerm("$24.5")).toBe(2450);
    expect(amountFromTerm("1,250.00")).toBe(125000);
    expect(amountFromTerm("ada@x.com")).toBeNull();
  });
});

describe("searchWorkspace", () => {
  it("finds payments, customers and pages for this merchant only", async () => {
    const hits = await searchWorkspace(mine, `ada-${RUN}`, "usd");
    const payments = hits.filter((h) => h.kind === "payment");
    expect(payments).toHaveLength(2);
    expect(payments.some((h) => h.title.startsWith("$99"))).toBe(false); // the other merchant's sale
    const customer = hits.find((h) => h.kind === "customer")!;
    expect(customer.detail).toBe("2 orders · $48"); // refund subtracted
    expect((await searchWorkspace(mine, "speckled", "usd")).find((h) => h.kind === "page")?.title).toBe("Speckled mugs");
    expect((await searchWorkspace(mine, "85", "usd")).filter((h) => h.kind === "payment")).toHaveLength(1);
    expect(await searchWorkspace(theirs, "speckled", "usd")).toEqual([]);
    expect(await searchWorkspace(mine, "   ", "usd")).toEqual([]);
  });
});

describe("customers and live status", () => {
  it("groups paid orders by email, most recent first, skipping failures", async () => {
    const rows = await listCustomers(mine);
    expect(rows.map((r) => r.email)).toEqual([`ada-${RUN}@example.com`, `bo-${RUN}@example.com`]);
    expect(rows[0]).toMatchObject({ orders: 2, spentCents: 4800 });
  });

  it("counts only paid orders from the last 15 minutes", async () => {
    expect((await liveStatus(mine)).recent).toBe(1);
  });
});
