/**
 * Lumen-hosted logos (real Postgres). No network: remote fetches are only
 * exercised on addresses the SSRF guard refuses before connecting.
 */
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { DEMO_CONFIG } from "@/lib/checkout/defaults";
import { checkoutConfigSchema } from "@/lib/checkout/schema";
import { db } from "@/server/db";
import { hostLogo, sniffImage, storeAsset } from "@/server/assets";
import { parseConfig, publishPage } from "@/server/dal/checkout-pages";
import { GET } from "@/app/assets/[id]/route";

const RUN = Math.random().toString(36).slice(2, 8);
const PNG = Buffer.from("89504e470d0a1a0a0000000d4948445200000001000000010806000000", "hex");
const SVG = Buffer.from('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect width="1" height="1"/></svg>');
const userIds: string[] = [];
let merchantId = "";
let otherMerchantId = "";
let pageId = "";

async function newMerchant(tag: string) {
  const user = await db.user.create({ data: { email: `as-${tag}-${RUN}@lumen.test` } });
  userIds.push(user.id);
  return (await db.merchant.create({ data: { userId: user.id, name: tag } })).id;
}

beforeAll(async () => {
  merchantId = await newMerchant("a");
  otherMerchantId = await newMerchant("b");
  const product = await db.product.create({ data: { merchantId, name: "Mug", priceCents: 2400 } });
  pageId = (await db.checkoutPage.create({ data: { merchantId, productId: product.id, name: "Mugs", slug: `as-${RUN}`, draftConfig: DEMO_CONFIG } })).id;
});

afterAll(async () => {
  await db.user.deleteMany({ where: { id: { in: userIds } } });
  await db.$disconnect();
});

describe("sniffImage", () => {
  it("trusts bytes, not names", () => {
    expect(sniffImage(PNG)).toBe("image/png");
    expect(sniffImage(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffImage(SVG)).toBe("image/svg+xml");
    expect(sniffImage(Buffer.from("<html><body>hi</body></html>"))).toBeNull();
    expect(sniffImage(Buffer.from('<svg onload="alert(1)"></svg>'))).toBeNull();
    expect(sniffImage(Buffer.from("<svg><script>alert(1)</script></svg>"))).toBeNull();
  });
});

describe("hosted assets", () => {
  it("dedupes per merchant and serves with a locked-down response", async () => {
    const path = await storeAsset(merchantId, PNG);
    expect(path).toMatch(/^\/assets\/[a-z0-9]+$/);
    expect(await storeAsset(merchantId, PNG)).toBe(path);
    expect(checkoutConfigSchema.safeParse({ ...DEMO_CONFIG, brand: { name: "x", logoUrl: path } }).success).toBe(true);

    const id = path.split("/").pop()!;
    const res = await GET(new Request(`http://x${path}`), { params: Promise.resolve({ id }) } as never);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("content-security-policy")).toContain("sandbox");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(Buffer.from(await res.arrayBuffer()).equals(PNG)).toBe(true);
    const missing = await GET(new Request("http://x"), { params: Promise.resolve({ id: "nope" }) } as never);
    expect(missing.status).toBe(404);
  });

  it("won't let one merchant point at another merchant's asset", async () => {
    const theirs = await storeAsset(otherMerchantId, SVG);
    await expect(hostLogo(merchantId, theirs)).rejects.toThrow(/isn't available/);
    expect(await hostLogo(otherMerchantId, theirs)).toBe(theirs);
  });

  it("rejects non-images and oversize files", async () => {
    await expect(storeAsset(merchantId, Buffer.from("<html></html>"))).rejects.toThrow(/supported image/);
    await expect(storeAsset(merchantId, Buffer.alloc(600 * 1024))).rejects.toThrow(/512 KB/);
  });
});

describe("publishing", () => {
  it("keeps hosted logos and refuses to go live with a logo it can't copy", async () => {
    const hosted = await storeAsset(merchantId, PNG);
    await db.checkoutPage.update({ where: { id: pageId }, data: { draftConfig: { ...DEMO_CONFIG, brand: { name: "Kiln", logoUrl: hosted } } } });
    const { version } = await publishPage(merchantId, pageId);
    expect(parseConfig(version.config).brand.logoUrl).toBe(hosted);

    // A private address is refused by the SSRF guard before any connection.
    await db.checkoutPage.update({ where: { id: pageId }, data: { draftConfig: { ...DEMO_CONFIG, brand: { name: "Kiln", logoUrl: "https://192.168.1.10/logo.png" } } } });
    await expect(publishPage(merchantId, pageId)).rejects.toThrow(/Couldn't copy your logo/);
    const page = await db.checkoutPage.findUniqueOrThrow({ where: { id: pageId }, include: { publishedVersion: true } });
    expect(parseConfig(page.publishedVersion!.config).brand.logoUrl).toBe(hosted);
  });

  it("reuses an earlier copy of the same remote logo without fetching", async () => {
    const remote = "https://192.168.1.11/brand.png"; // unreachable on purpose
    const copied = await storeAsset(merchantId, Buffer.concat([PNG, Buffer.from([1])]), remote);
    expect(await hostLogo(merchantId, remote)).toBe(copied);
  });
});
