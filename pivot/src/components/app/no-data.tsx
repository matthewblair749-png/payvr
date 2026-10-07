"use client";

import { Database, Loader2 } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";
import { ButtonLink, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FormMessage } from "@/components/ui/field";
import { importSampleData } from "@/server/data/actions";
import type { ActionResult } from "@/server/errors";

const COPY: Record<string, { title: string; description: string }> = {
  overview: { title: "No business data yet", description: "Upload your first dataset to start discovering insights." },
  health: { title: "No health score yet", description: "Upload your business data and PIVOT will score six areas of your business." },
  insights: { title: "No insights yet", description: "Upload your first dataset and PIVOT will explain what changed and why." },
  opportunities: { title: "No opportunities yet", description: "PIVOT finds and scores growth opportunities once it has your data." },
  whatif: { title: "Nothing to simulate yet", description: "Upload your data to test pricing, marketing and cost decisions on your own numbers." },
  recommendations: { title: "No recommendations yet", description: "Upload your data and PIVOT will rank your best next moves." },
  reports: { title: "No reports yet", description: "Upload your data to generate your first monthly business report." },
};

export function NoData({ page, base }: { page: keyof typeof COPY; base: string }) {
  const [state, action, pending] = useActionState<ActionResult | undefined>(() => importSampleData(), undefined);
  const c = COPY[page];
  return (
    <EmptyState icon={Database} title={c.title} description={c.description}>
      <ButtonLink href={`${base}/data`} variant="accent" size="lg">
        Upload data
      </ButtonLink>
      <form action={action}>
        <button type="submit" disabled={pending} className={buttonVariants({ variant: "secondary", size: "lg" })}>
          {pending && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
          {pending ? "Importing…" : "Import sample data"}
        </button>
      </form>
      <Link href="/demo" className="basis-full text-sm text-ink-2 underline decoration-line-strong underline-offset-4 hover:text-ink">
        Or explore the Northstar Commerce demo
      </Link>
      {state && !state.ok && (
        <div className="basis-full">
          <FormMessage tone="error">{state.error}</FormMessage>
        </div>
      )}
    </EmptyState>
  );
}

/** Just the "Import sample data" action, for places that already offer an upload. */
export function ImportSampleButton() {
  const [state, action, pending] = useActionState<ActionResult | undefined>(() => importSampleData(), undefined);
  return (
    <form action={action} className="flex flex-col items-start gap-2">
      <button type="submit" disabled={pending} className={buttonVariants({ variant: "secondary", size: "sm" })}>
        {pending && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
        {pending ? "Importing…" : "Import sample data"}
      </button>
      {state && !state.ok && <FormMessage tone="error">{state.error}</FormMessage>}
    </form>
  );
}
