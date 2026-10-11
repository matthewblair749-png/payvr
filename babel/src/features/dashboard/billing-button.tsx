import { Button } from "@/components/ui/button";

/** Form post to the Customer Portal (manage card, change plan, cancel). */
export function BillingButton({ children, variant = "ink" }: { children: React.ReactNode; variant?: "primary" | "ink" | "outline" }) {
  return (
    <form action="/api/billing/portal" method="post">
      <Button type="submit" variant={variant}>
        {children}
      </Button>
    </form>
  );
}
