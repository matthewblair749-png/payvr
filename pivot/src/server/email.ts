import "server-only";
import { createTransport } from "nodemailer";

/**
 * Transactional email (password resets, invitations, alerts).
 *
 * - With EMAIL_SERVER set: sends over SMTP.
 * - Without it, outside production: logs the message and keeps the latest
 *   link per address in memory so the confirmation screen can show it.
 *   This shortcut is disabled in production.
 */
const store = globalThis as unknown as { __pivotDevMail?: Map<string, { url: string; at: number }> };

export const devMailEnabled = () => process.env.NODE_ENV !== "production" && !process.env.EMAIL_SERVER;

export function lastDevLink(email: string): string | null {
  if (!devMailEnabled()) return null;
  const l = store.__pivotDevMail?.get(email.toLowerCase());
  return l && Date.now() - l.at < 30 * 60_000 ? l.url : null;
}

export function appUrl(path: string) {
  return new URL(path, process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").toString();
}

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export async function sendEmail({ to, subject, heading, body, cta }: { to: string; subject: string; heading: string; body: string; cta?: { label: string; url: string } }) {
  if (devMailEnabled()) {
    store.__pivotDevMail ??= new Map();
    if (cta) store.__pivotDevMail.set(to.toLowerCase(), { url: cta.url, at: Date.now() });
    console.info(`\n[pivot] Email to ${to}: ${subject}${cta ? `\n${cta.url}` : ""}\n`);
    return;
  }
  if (!process.env.EMAIL_SERVER) throw new Error("EMAIL_SERVER is not configured");
  const transport = createTransport(process.env.EMAIL_SERVER);
  const html = `<!doctype html><html><body style="margin:0;background:#f5f6f8;font-family:Inter,Arial,sans-serif;color:#0a1020">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px">
<table width="480" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:20px;padding:36px;border:1px solid #e6e9ef">
<tr><td style="font-size:18px;font-weight:800;letter-spacing:0.04em">PIVOT</td></tr>
<tr><td style="padding:24px 0 8px;font-size:22px;font-weight:800">${escape(heading)}</td></tr>
<tr><td style="padding-bottom:28px;color:#5d6679;line-height:1.55;font-size:15px">${escape(body)}</td></tr>
${cta ? `<tr><td><a href="${escape(cta.url)}" style="display:inline-block;background:#0a1020;color:#fff;text-decoration:none;font-weight:800;padding:14px 24px;border-radius:999px">${escape(cta.label)}</a></td></tr>` : ""}
<tr><td style="padding-top:28px;font-size:13px;color:#5d6679">If you didn't expect this email, you can ignore it.</td></tr>
</table></td></tr></table></body></html>`;
  const result = await transport.sendMail({
    to,
    from: process.env.EMAIL_FROM ?? "PIVOT <hello@pivot.app>",
    subject,
    text: `${heading}\n\n${body}${cta ? `\n\n${cta.label}: ${cta.url}` : ""}`,
    html,
  });
  if (result.rejected.length) throw new Error("Email was rejected");
}
