import { describe, expect, it } from "vitest";
import { nameFromEmail } from "@/features/dashboard/format";

describe("nameFromEmail", () => {
  it("uses the part before the @", () => {
    expect(nameFromEmail("sam.rivera@example.com")).toBe("sam.rivera");
  });

  it("drops a +tag", () => {
    expect(nameFromEmail("sam+work@example.com")).toBe("sam");
    expect(nameFromEmail("sam.rivera+28357@example.com")).toBe("sam.rivera");
  });

  it("keeps the whole local part if it starts with +", () => {
    expect(nameFromEmail("+tag@example.com")).toBe("+tag");
  });
});
