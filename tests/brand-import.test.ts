import { describe, expect, it } from "vitest";
import { extractSignals, parseCssColor } from "@/lib/brand/extract";
import { cleanBrandName, guessFromSignals, mapFont, pickRadius } from "@/lib/brand/heuristics";
import { isBlockedIp, normalizePublicUrl } from "@/server/brand-import/safe-fetch";

const HTML = `<!doctype html><html><head>
<title>Moth Press | Risograph prints &amp; zines</title>
<meta name="theme-color" content="#2F6BFF">
<meta property="og:site_name" content="Moth Press">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;700&display=swap">
<style>
  :root { --brand-primary: #2F6BFF; --bg: #FAF7F0; }
  body { font-family: "Space Grotesk", sans-serif; background: #FAF7F0; color: #111; }
  .btn { background: var(--brand-primary); border-radius: 12px; }
  .card { border-radius: 16px; background: #fff; }
  .tag { color: rgb(47, 107, 255); }
</style></head><body><img class="site-logo" src="/logo.svg" alt="Moth Press logo"></body></html>`;

describe("extractSignals", () => {
  const s = extractSignals(HTML, "https://mothpress.example/");
  it("reads name, theme color, fonts and logos", () => {
    expect(s.siteName).toBe("Moth Press");
    expect(s.themeColor).toBe("#2F6BFF");
    expect(s.googleFonts).toContain("Space Grotesk");
    expect(s.logoCandidates[0]).toBe("https://mothpress.example/apple-touch-icon.png");
    expect(s.logoCandidates).toContain("https://mothpress.example/logo.svg");
  });
  it("weights brand-named CSS variables", () => {
    expect(s.colors[0].hex).toBe("#2F6BFF");
  });
  it("maps to a sensible theme", () => {
    const g = guessFromSignals(s);
    expect(g.brandName).toBe("Moth Press");
    expect(g.theme.accent).toBe("#2F6BFF");
    expect(g.theme.background).toBe("#FAF7F0");
    expect(g.theme.font).toBe("spaceGrotesk");
    expect(g.theme.radius).toBeGreaterThanOrEqual(12);
  });
});

describe("heuristics", () => {
  it("maps fonts by personality", () => {
    expect(mapFont(["Playfair Display"])).toBe("fraunces");
    expect(mapFont(["Poppins"])).toBe("sora");
    expect(mapFont(["Open Sans"])).toBe("dmSans");
    expect(mapFont(["PT Sans Serif"])).toBe("dmSans");
    expect(mapFont(["JetBrains Mono"])).toBe("plexMono");
  });
  it("picks radius", () => {
    expect(pickRadius([])).toBe(12);
    expect(pickRadius([4, 4, 6])).toBe(6);
    expect(pickRadius([999, 999, 999, 999, 8])).toBe(24);
  });
  it("cleans Instagram titles", () => {
    expect(
      cleanBrandName({ isInstagram: true, siteName: null, title: "Kiln & Co. (@kilnandco) • Instagram photos and videos", url: "https://www.instagram.com/kilnandco/" }),
    ).toBe("Kiln & Co.");
  });
  it("parses css colors, ignoring transparent", () => {
    expect(parseCssColor("#abc")).toBe("#AABBCC");
    expect(parseCssColor("rgba(0,0,0,0.1)")).toBeNull();
    expect(parseCssColor("rgb(240 74 26)")).toBe("#F04A1A");
  });
});

describe("SSRF guard", () => {
  it.each(["127.0.0.1", "10.1.2.3", "169.254.169.254", "192.168.1.1", "172.20.0.1", "::1", "fe80::1", "::ffff:127.0.0.1", "fd00::1", "0.0.0.0"])(
    "blocks %s",
    (ip) => expect(isBlockedIp(ip)).toBe(true),
  );
  it.each(["93.184.216.34", "1.1.1.1", "2606:4700:4700::1111"])("allows %s", (ip) => expect(isBlockedIp(ip)).toBe(false));

  it.each([
    "http://localhost/",
    "http://127.0.0.1/",
    "http://[::1]/",
    "http://169.254.169.254/latest/meta-data",
    "https://example.com:8443/",
    "https://user:pass@example.com/",
    "file:///etc/passwd",
    "http://intranet/",
    "http://printer.local/",
  ])("rejects %s", (u) => expect(() => normalizePublicUrl(u)).toThrow());

  it("adds https to bare domains", () => {
    expect(normalizePublicUrl("mothpress.example/shop#x").toString()).toBe("https://mothpress.example/shop");
  });
});
