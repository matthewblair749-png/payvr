import "server-only";
import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import type { Provider } from "next-auth/providers";
import Google from "next-auth/providers/google";
import Nodemailer from "next-auth/providers/nodemailer";
import { RateLimiter } from "@/features/translation/server/rate-limit";
import { db } from "@/server/db";
import { sendMagicLink } from "./email";

// At most 3 sign-in emails per address every 10 minutes, so nobody can use
// the form to flood someone's inbox.
const magicLinkLimiter = new RateLimiter(3, 10 * 60_000);

export class TooManyEmailsError extends Error {
  constructor() {
    super("Too many sign-in emails");
    this.name = "TooManyEmailsError";
  }
}

export const googleEnabled = () => Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);

function providers(): Provider[] {
  const list: Provider[] = [
    Nodemailer({
      // Only used when EMAIL_SERVER is set; dev prints links instead.
      server: process.env.EMAIL_SERVER ?? "smtp://localhost:25",
      from: process.env.EMAIL_FROM ?? "babel <hello@example.com>",
      maxAge: 24 * 60 * 60,
      async sendVerificationRequest({ identifier, url }) {
        if (magicLinkLimiter.check(identifier.toLowerCase()) > 0) throw new TooManyEmailsError();
        await sendMagicLink({ email: identifier, url });
      },
    }),
  ];
  if (googleEnabled()) {
    // Google verifies email ownership, so it's safe to attach a Google login
    // to an account that first signed up with a magic link to the same address.
    list.push(Google({ allowDangerousEmailAccountLinking: true }));
  }
  return list;
}

/**
 * Auth.js v5: email magic links plus Google, stored in Postgres through the
 * Prisma adapter, with database sessions (revocable, nothing sensitive in
 * the cookie).
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: "database", maxAge: 30 * 24 * 60 * 60 },
  trustHost: true,
  pages: {
    signIn: "/signin",
    verifyRequest: "/signin/check-email",
    error: "/signin",
  },
  callbacks: {
    // Database sessions don't include the user id by default.
    session({ session, user }) {
      return { ...session, user: { ...session.user, id: user.id } };
    },
  },
  providers: providers(),
});

/** The signed-in user's id, or null. */
export async function currentUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}
