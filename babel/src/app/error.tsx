"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="main" className="wrap flex flex-col items-center py-24 text-center">
      <h1 className="text-4xl sm:text-5xl">Well, that didn&rsquo;t translate.</h1>
      <p className="mt-4 max-w-md text-lg text-muted">Something went wrong on our side. Give it another try.</p>
      <Button onClick={reset} className="mt-8">
        Try again
      </Button>
    </main>
  );
}
