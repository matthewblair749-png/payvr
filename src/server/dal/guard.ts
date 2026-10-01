import "server-only";
import { merchantForAction } from "./session";

/** For app API routes: the signed-in merchant, or a 401 response. */
export async function merchantOr401() {
  try {
    return { merchant: await merchantForAction(), error: null };
  } catch {
    return { merchant: null, error: Response.json({ error: "Sign in" }, { status: 401 }) };
  }
}

export const noStore = { headers: { "cache-control": "private, no-store" } };
