"use client";

import { useState, useTransition } from "react";
import { ExternalLink } from "lucide-react";
import { connectStripeAction, stripeDashboardAction } from "@/app/studio/payments-actions";
import { Button } from "@/components/ui/button";

const COUNTRIES = [
  ["US", "United States"], ["CA", "Canada"], ["GB", "United Kingdom"], ["IE", "Ireland"], ["AU", "Australia"],
  ["NZ", "New Zealand"], ["DE", "Germany"], ["FR", "France"], ["NL", "Netherlands"], ["ES", "Spain"], ["IT", "Italy"],
  ["SE", "Sweden"], ["DK", "Denmark"], ["NO", "Norway"], ["FI", "Finland"], ["BE", "Belgium"], ["AT", "Austria"],
  ["PT", "Portugal"], ["CH", "Switzerland"], ["SG", "Singapore"], ["JP", "Japan"],
] as const;

export function ConnectButton({ label, defaultCountry, showCountry = false }: { label: string; defaultCountry: string; showCountry?: boolean }) {
  const [country, setCountry] = useState(defaultCountry);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col items-stretch gap-2 sm:items-end">
      <div className="flex gap-2">
        {showCountry && (
          <>
            <label htmlFor="country" className="sr-only">Country</label>
            <select
              id="country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="rounded-full border border-black/15 bg-white px-4 text-sm font-medium"
            >
              {COUNTRIES.map(([code, name]) => (
                <option key={code} value={code}>{name}</option>
              ))}
            </select>
          </>
        )}
        <Button
          variant="primary"
          size="lg"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await connectStripeAction({ country });
              if (res && !res.ok) setError(res.error);
            })
          }
        >
          {pending ? "Opening Stripe…" : label}
        </Button>
      </div>
      {error && <p role="alert" className="text-sm text-orange-deep">{error}</p>}
    </div>
  );
}

export function DashboardButton() {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="outline"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await stripeDashboardAction();
            if (res && !res.ok) setError(res.error);
          })
        }
      >
        Stripe dashboard <ExternalLink size={15} aria-hidden="true" />
      </Button>
      {error && <p role="alert" className="text-sm text-orange-deep">{error}</p>}
    </div>
  );
}
