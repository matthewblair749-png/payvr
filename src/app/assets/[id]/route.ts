import { getAsset } from "@/server/assets";

/**
 * Serves lumen-hosted merchant images. Assets are immutable (a new upload gets
 * a new id), so they cache for a year. The sandboxing CSP means an SVG opened
 * directly can't run anything, and nosniff pins the sniffed type.
 */
export async function GET(_req: Request, ctx: RouteContext<"/assets/[id]">) {
  const { id } = await ctx.params;
  const asset = await getAsset(id);
  if (!asset) return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
  return new Response(new Uint8Array(asset.bytes), {
    headers: {
      "content-type": asset.contentType,
      "cache-control": "public, max-age=31536000, immutable",
      etag: `"${asset.sha256}"`,
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      "x-content-type-options": "nosniff",
      "cross-origin-resource-policy": "same-origin",
    },
  });
}
