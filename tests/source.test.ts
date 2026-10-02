import { describe, expect, it } from "vitest";
import { classifySource } from "@/lib/tracking/source";

describe("classifySource", () => {
  it("prefers the utm tag", () => {
    expect(classifySource("google.com", "ig")).toBe("instagram");
    expect(classifySource(null, "newsletter-oct")).toBe("email");
    expect(classifySource(null, "Klaviyo")).toBe("email");
    expect(classifySource(null, "podcast")).toBe("other");
  });
  it("reads referrer hostnames", () => {
    expect(classifySource("l.instagram.com", null)).toBe("instagram");
    expect(classifySource("www.google.co.uk", null)).toBe("search");
    expect(classifySource("mail.google.com", null)).toBe("email");
    expect(classifySource("lm.facebook.com", null)).toBe("facebook");
    expect(classifySource("kilnandco.com", null)).toBe("other");
  });
  it("treats no referrer, or our own host, as direct", () => {
    expect(classifySource("", null)).toBe("direct");
    expect(classifySource(undefined, undefined)).toBe("direct");
    expect(classifySource("lumen.app", null, "lumen.app")).toBe("direct");
  });
});
