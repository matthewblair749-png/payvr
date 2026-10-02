import "server-only";
import dns from "node:dns";
import net from "node:net";
import { Agent, fetch, type Response } from "undici";
import { UserError } from "../errors";

/**
 * SSRF-hardened fetch for user-supplied URLs (brand import).
 *
 * Defenses:
 * - http/https only, default ports only, no credentials in the URL.
 * - Every DNS answer is checked against private/reserved ranges *inside the
 *   socket's lookup*, so DNS-rebinding between "check" and "connect" can't
 *   sneak through. IP-literal hosts are checked up front.
 * - Redirects are followed manually (max 4) and each hop is re-validated.
 * - Hard timeout and response-size cap; content-type allow-list.
 */

const blocked = new net.BlockList();
for (const [addr, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16], // link-local, incl. cloud metadata 169.254.169.254
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  blocked.addSubnet(addr, prefix, "ipv4");
}
for (const [addr, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["64:ff9b::", 96],
  ["100::", 64],
  ["2001:db8::", 32],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  blocked.addSubnet(addr, prefix, "ipv6");
}

export function isBlockedIp(ip: string): boolean {
  const family = net.isIP(ip);
  if (family === 4) return blocked.check(ip, "ipv4");
  if (family === 6) {
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
    if (mapped) return blocked.check(mapped[1], "ipv4");
    return blocked.check(ip, "ipv6");
  }
  return true; // not an IP at all — refuse
}

export class UnsafeUrlError extends UserError {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeUrlError";
  }
}

/** Validate and normalize a user-supplied URL. Adds https:// if missing. */
export function normalizePublicUrl(raw: string): URL {
  let input = raw.trim();
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(input)) input = `https://${input}`;
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new UnsafeUrlError("That doesn't look like a web address");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new UnsafeUrlError("Only http(s) links are supported");
  if (url.username || url.password) throw new UnsafeUrlError("Links with passwords aren't supported");
  if (url.port && url.port !== "80" && url.port !== "443") throw new UnsafeUrlError("Custom ports aren't supported");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(host)) {
    if (isBlockedIp(host)) throw new UnsafeUrlError("That address isn't reachable");
  } else if (!host.includes(".") || /\.(local|internal|localhost|lan|home|corp)$/i.test(host) || host === "localhost") {
    throw new UnsafeUrlError("That address isn't reachable");
  }
  url.hash = "";
  return url;
}

/** DNS lookup that refuses to resolve to private/reserved addresses. */
const safeLookup: net.LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, "", 4);
    const list = addresses as dns.LookupAddress[];
    if (!list.length || list.some((a) => isBlockedIp(a.address))) {
      return callback(Object.assign(new Error("Blocked address"), { code: "EBLOCKED" }), "", 4);
    }
    if ((options as dns.LookupOptions).all) return (callback as unknown as (e: null, a: dns.LookupAddress[]) => void)(null, list);
    callback(null, list[0].address, list[0].family);
  });
};

const agent = new Agent({
  connect: { lookup: safeLookup, timeout: 4_000 },
  headersTimeout: 6_000,
  bodyTimeout: 6_000,
});

export type SafeFetchResult = { url: URL; contentType: string; body: Buffer };

export async function safeFetch(
  input: string | URL,
  opts: {
    maxBytes: number;
    accept: RegExp;
    timeoutMs?: number;
    signal?: AbortSignal;
    /** Keep a truncated prefix instead of failing when over maxBytes (HTML/CSS only). */
    truncate?: boolean;
  },
): Promise<SafeFetchResult> {
  let url = typeof input === "string" ? normalizePublicUrl(input) : normalizePublicUrl(input.toString());
  const signal = AbortSignal.any([AbortSignal.timeout(opts.timeoutMs ?? 6_000), ...(opts.signal ? [opts.signal] : [])]);

  for (let hop = 0; hop <= 4; hop++) {
    let res: Response;
    try {
      res = await fetch(url, {
        dispatcher: agent,
        redirect: "manual",
        signal,
        headers: {
          // Honest UA; many sites serve richer <meta> to known link-preview bots.
          "user-agent": "Mozilla/5.0 (compatible; lumen-brand-import/1.0; +https://lumen.app/bot)",
          accept: "text/html,application/xhtml+xml,text/css,image/*;q=0.8,*/*;q=0.5",
          "accept-language": "en",
        },
      });
    } catch (e) {
      const cause = (e as { cause?: { code?: string } }).cause;
      if (cause?.code === "EBLOCKED") throw new UnsafeUrlError("That address isn't reachable");
      throw new UserError(signal.aborted ? "The site took too long to respond" : "Couldn't reach that site");
    }

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      await res.body?.cancel();
      if (!loc) throw new UserError("Bad redirect");
      url = normalizePublicUrl(new URL(loc, url).toString());
      continue;
    }
    if (!res.ok) {
      await res.body?.cancel();
      throw new UserError(`The site answered ${res.status}`);
    }

    const contentType = (res.headers.get("content-type") ?? "").toLowerCase();
    if (!opts.accept.test(contentType)) {
      await res.body?.cancel();
      throw new UserError("Unexpected content type");
    }
    const declared = Number(res.headers.get("content-length") ?? 0);
    if (declared > opts.maxBytes && !opts.truncate) {
      await res.body?.cancel();
      throw new UserError("Response too large");
    }

    // Stream with a hard cap (content-length can lie or be absent).
    const chunks: Buffer[] = [];
    let size = 0;
    if (res.body) {
      for await (const chunk of res.body) {
        size += chunk.length;
        if (size > opts.maxBytes) {
          if (opts.truncate) break;
          await res.body.cancel().catch(() => {});
          throw new UserError("Response too large");
        }
        chunks.push(Buffer.from(chunk));
      }
    }
    return { url, contentType, body: Buffer.concat(chunks) };
  }
  throw new UserError("Too many redirects");
}
