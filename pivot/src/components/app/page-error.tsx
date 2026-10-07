"use client";

import { AlertTriangle } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

/** In-app error: keeps the sidebar, shows a friendly message and a retry. */
export function PageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => console.error(error), [error]);
  return (
    <EmptyState icon={AlertTriangle} title="Something went wrong" description="We couldn't load this part of PIVOT. Your data is safe. Please try again.">
      <Button variant="primary" onClick={reset}>
        Try again
      </Button>
    </EmptyState>
  );
}
