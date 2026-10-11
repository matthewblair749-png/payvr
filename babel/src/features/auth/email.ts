import "server-only";
import { createTransport } from "nodemailer";

/**
 * Magic-link delivery.
 *
 * With EMAIL_SERVER set, sends a real email over SMTP. Without it, in local
 * development only, prints the link to the server console and keeps the
 * latest one so the "check your inbox" page can show it. That shortcut is
 * switched off in production no matter what.
 */
const devStore = globalThis as unknown as { __babelLastMagicLink?: { email: string; url: string; at: number } };

export const devMagicLinksEnabled = () => process.env.NODE_ENV !== "production" && !process.env.EMAIL_SERVER;

export function lastDevMagicLink(): { email: string; url: string } | null {
  if (!devMagicLinksEnabled()) return null;
  const link = devStore.__babelLastMagicLink;
  return link && Date.now() - link.at < 10 * 60_000 ? link : null;
}

const FROM = () => process.env.EMAIL_FROM ?? "babel <hello@example.com>";

export async function sendMagicLink({ email, url }: { email: string; url: string }): Promise<void> {
  if (devMagicLinksEnabled()) {
    devStore.__babelLastMagicLink = { email, url, at: Date.now() };
    console.info(`\n[babel] Dev sign-in link for ${email}:\n${url}\n`);
    return;
  }
  if (!process.env.EMAIL_SERVER) throw new Error("EMAIL_SERVER is not configured");

  const transport = createTransport(process.env.EMAIL_SERVER);
  const result = await transport.sendMail({
    to: email,
    from: FROM(),
    subject: "Your babel sign-in link",
    text: `Here's your link to sign in to babel:\n\n${url}\n\nIt works once and expires in 24 hours. If you didn't ask for it, you can ignore this email.`,
    html: magicLinkHtml(url),
  });
  const failed = result.rejected.concat(result.pending).filter(Boolean);
  if (failed.length) throw new Error("Email could not be delivered");
}

function magicLinkHtml(url: string): string {
  const safeUrl = url.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  return `<!doctype html><html><body style="margin:0;background:#FFF6EC;font-family:Arial,Helvetica,sans-serif;color:#2A1F4D">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px">
<table width="480" cellpadding="0" cellspacing="0" style="background:#F3EFE6;border:2px solid #2A1F4D;border-radius:24px;padding:40px">
<tr><td style="font-size:30px;font-weight:900;letter-spacing:-1px;color:#0C1021">babel</td></tr>
<tr><td style="padding:24px 0 8px;font-size:22px;font-weight:800">Here's your sign-in link</td></tr>
<tr><td style="padding-bottom:28px;color:#5E5578;line-height:1.5">Tap the button to sign in. It works once and expires in 24 hours.</td></tr>
<tr><td><a href="${safeUrl}" style="display:inline-block;background:#FF5A3C;color:#2A1F4D;border:2px solid #2A1F4D;text-decoration:none;font-weight:800;padding:14px 28px;border-radius:999px">Sign in to babel</a></td></tr>
<tr><td style="padding-top:28px;font-size:13px;color:#5E5578">Didn't ask for this? You can safely ignore it.</td></tr>
</table></td></tr></table></body></html>`;
}
