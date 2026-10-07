import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { monthLabel } from "@/lib/format";
import { getAnalysis } from "@/server/analysis/get";
import type { Workspace } from "@/server/workspace";
import { AskButton } from "./ask-button";
import { MobileNav, Sidebar, type ShellInfo } from "./sidebar";
import { WorkspaceProvider } from "./workspace-context";

function planLabel(ws: Workspace) {
  if (ws.mode === "demo") return "Demo workspace";
  const e = ws.entitlements;
  if (e.trialActive) return `Pro trial · ${e.trialDaysLeft} day${e.trialDaysLeft === 1 ? "" : "s"} left`;
  return `${e.plan.charAt(0)}${e.plan.slice(1).toLowerCase()} plan`;
}

export async function AppShell({ ws, children }: { ws: Workspace; children: ReactNode }) {
  const { analysis, hasData, status } = await getAnalysis(ws);
  const actionCount = analysis.insights.filter((i) => i.severity === "ACTION" && status[i.key] !== "DONE" && status[i.key] !== "DISMISSED").length;
  const info: ShellInfo = {
    mode: ws.mode,
    basePath: ws.basePath,
    companyName: ws.company.name,
    companyId: ws.company.id,
    companies: ws.companies,
    planLabel: planLabel(ws),
    user: ws.user ? { name: ws.user.name, email: ws.user.email } : null,
    badges: { insights: actionCount },
  };

  return (
    <WorkspaceProvider companyId={ws.company.id}>
      <div className="pv-app min-h-dvh bg-canvas">
        <Sidebar info={info} />
        <div className="lg:pl-64">
          {ws.mode === "demo" && (
            <aside aria-label="Demo" className="no-print border-b border-ink bg-ink text-white">
              <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2.5 text-sm sm:px-6 lg:px-10">
                <p>
                  <span className="font-heavy">Demo:</span> you&apos;re exploring Northstar Commerce, a sample company.
                </p>
                <Link href={ws.user ? "/app" : "/signup"} className="inline-flex items-center gap-1 font-heavy underline-offset-4 hover:underline">
                  {ws.user ? "Go to my workspace" : "Try it on your data"} <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </div>
            </aside>
          )}
          <header className="no-print sticky top-0 z-20 border-b border-line bg-canvas/85 backdrop-blur-md">
            <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-3 px-4 sm:px-6 lg:px-10">
              <MobileNav info={info} />
              <Link href={ws.basePath} className="rounded-lg lg:hidden" aria-label="PIVOT overview">
                <Logo size={26} />
              </Link>
              <p className="hidden flex-1 text-sm text-muted lg:block">
                {hasData && analysis.period ? (
                  <>
                    Data through <span className="text-ink">{monthLabel(analysis.period)}</span>
                  </>
                ) : (
                  "No data yet"
                )}
              </p>
              <div className="ml-auto">
                <AskButton mode={ws.mode} companyName={ws.company.name} />
              </div>
            </div>
          </header>
          <main id="main" className="mx-auto max-w-[1200px] px-4 pb-20 pt-6 sm:px-6 sm:pt-8 lg:px-10">
            {children}
          </main>
        </div>
      </div>
    </WorkspaceProvider>
  );
}

/** Page title block used by every app page. */
export function PageHeader({ title, subtitle, actions, eyebrow }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="mb-2 text-sm text-muted">{eyebrow}</div>}
        <h1 className="text-[2rem] font-heavy leading-[1.05] tracking-tighter text-ink sm:text-[2.5rem]">{title}</h1>
        {subtitle && <p className="mt-2 text-[17px] text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
