import "server-only";
import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import Nodemailer from "next-auth/providers/nodemailer";
import { db } from "./db";
import { sendMagicLink } from "./email";
import { LIMITS, rateLimit } from "./rate-limit";

/**
 * Auth.js v5 — passwordless email magic links, database sessions.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: "database", maxAge: 30 * 24 * 60 * 60 },
  trustHost: true,
  pages: {
    signIn: "/login",
    verifyRequest: "/login/check-email",
    error: "/login",
  },
  callbacks: {
    // Expose the user id to server code (database sessions don't by default).
    session({ session, user }) {
      return { ...session, user: { ...session.user, id: user.id } };
    },
  },
  providers: [
    Nodemailer({
      // Unused when EMAIL_SERVER is absent (dev prints links instead).
      server: process.env.EMAIL_SERVER ?? "smtp://localhost:25",
      from: process.env.EMAIL_FROM ?? "lumen <hello@lumen.app>",
      maxAge: 24 * 60 * 60,
      async sendVerificationRequest({ identifier, url }) {
        // Per-address throttle stops using us to spam someone's inbox.
        rateLimit(`magic:${identifier.toLowerCase()}`, LIMITS.magicLink.limit, LIMITS.magicLink.windowMs);
        await sendMagicLink({ email: identifier, url });
      },
    }),
  ],
});
