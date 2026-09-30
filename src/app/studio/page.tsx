import type { Metadata } from "next";
import { StudioHandoff } from "./studio-handoff";

export const metadata: Metadata = { title: "Studio" };

/**
 * Phase 1 placeholder: confirms the design carried over from the landing page.
 * Replaced by the full Checkout Studio in Phase 2.
 */
export default function StudioPage() {
  return <StudioHandoff />;
}
