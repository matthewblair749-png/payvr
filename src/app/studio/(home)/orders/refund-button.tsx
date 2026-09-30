"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { refundOrderAction } from "@/app/studio/payments-actions";
import { Button } from "@/components/ui/button";

export function RefundButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col items-end">
      <Button
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() => {
          if (!confirm("Refund this order in full? This can't be undone.")) return;
          start(async () => {
            const res = await refundOrderAction({ orderId });
            if (!res.ok) return setError(res.error);
            router.refresh();
          });
        }}
      >
        {pending ? "Refunding…" : "Refund"}
      </Button>
      {error && <span role="alert" className="text-xs text-orange-deep">{error}</span>}
    </span>
  );
}
