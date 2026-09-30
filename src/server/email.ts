import "server-only";
import { createTransport } from "nodemailer";

/**
 * Magic-link delivery.
 *
 * - With EMAIL_SERVER set: sends a branded email over SMTP.
 * - Without it (local dev): prints the link to the server console and keeps
 *   the latest one in memory so /login/check-email can show it. This dev
 *   shortcut is hard-disabled in production.
 */
const devLinks = globalThis as unknown as { __lumenLastMagicLink?: { email: string; url: string; at: number } };

export const devMagicLinksEnabled = () => process.env.NODE_ENV !== "production" && !process.env.EMAIL_SERVER;

export function lastDevMagicLink() {
  if (!devMagicLinksEnabled()) return null;
  const l = devLinks.__lumenLastMagicLink;
  // Only show recent links.
  return l && Date.now() - l.at < 10 * 60_000 ? l : null;
}

export async function sendMagicLink({ email, url }: { email: string; url: string }) {
  if (devMagicLinksEnabled()) {
    devLinks.__lumenLastMagicLink = { email, url, at: Date.now() };
    console.info(`\n[lumen] Magic link for ${email}:\n${url}\n`);
    return;
  }
  if (!process.env.EMAIL_SERVER) throw new Error("EMAIL_SERVER is not configured");

  const transport = createTransport(process.env.EMAIL_SERVER);
  const { host } = new URL(url);
  const result = await transport.sendMail({
    to: email,
    from: process.env.EMAIL_FROM ?? "lumen <hello@lumen.app>",
    subject: "Your lumen sign-in link",
    text: `Sign in to lumen\n${url}\n\nIf you didn't ask for this, you can ignore this email.`,
    html: magicLinkHtml(url, host),
  });
  const failed = result.rejected.concat(result.pending).filter(Boolean);
  if (failed.length) throw new Error(`Email could not be sent to ${failed.join(", ")}`);
}

function magicLinkHtml(url: string, host: string) {
  const safeUrl = url.replace(/"/g, "&quot;");
  return `<!doctype html><html><body style="margin:0;background:#EDEDF0;font-family:Arial,sans-serif;color:#0E0E10">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px">
<table width="480" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:24px;padding:40px">
<tr><td style="font-size:32px;font-weight:700;letter-spacing:-1.5px;color:#F04A1A">lumen</td></tr>
<tr><td style="padding:24px 0 8px;font-size:20px;font-weight:700">Sign in to ${host}</td></tr>
<tr><td style="padding-bottom:28px;color:#5C5C64;line-height:1.5">Tap the button to sign in. The link works once and expires in 24 hours.</td></tr>
<tr><td><a href="${safeUrl}" style="display:inline-block;background:#0E0E10;color:#fff;text-decoration:none;font-weight:700;padding:16px 28px;border-radius:999px">Sign in</a></td></tr>
<tr><td style="padding-top:28px;font-size:13px;color:#5C5C64">If you didn't ask for this, you can safely ignore it.</td></tr>
</table></td></tr></table></body></html>`;
}
