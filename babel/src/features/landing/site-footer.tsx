import Link from "next/link";
import { SIGNUP_HREF } from "@/config/site";
import { Logo } from "@/features/brand/logo";

const LINKS = [
  { href: SIGNUP_HREF, label: "Try it free" },
  { href: "/pricing", label: "Pricing" },
  { href: "/privacy", label: "Privacy" },
];

export function SiteFooter() {
  return (
    <footer className="on-dark bg-ink">
      <div className="wrap flex flex-col gap-8 py-12 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-sm">
          <Logo tone="dark" />
          <p className="mt-4 text-muted">Made for people who would rather just talk.</p>
        </div>
        <nav aria-label="Footer">
          <ul className="flex flex-wrap gap-x-2 gap-y-1">
            {LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="press inline-flex min-h-11 items-center rounded-full px-3 font-semibold text-cream underline-offset-4 hover:underline active:scale-[0.97]"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="wrap border-t border-line py-6 text-sm text-muted">© {new Date().getFullYear()} Babel</div>
    </footer>
  );
}
