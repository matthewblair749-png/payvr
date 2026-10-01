import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

/** Honest, specific empty state for sections not built yet. */
export function PagePlaceholder({ title, icon: Icon, body }: { title: string; icon: LucideIcon; body: string }) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-xl font-bold tracking-[-0.02em]">{title}</h1>
      <Card className="flex flex-col items-start gap-4 p-8">
        <span className="grid size-11 place-items-center rounded-xl bg-sunken text-muted">
          <Icon className="size-5" aria-hidden />
        </span>
        <div>
          <p className="text-base font-semibold">{title} is on its way</p>
          <p className="mt-1 max-w-[52ch] text-sm text-muted">{body}</p>
        </div>
        <Button asChild variant="secondary">
          <Link href="/">Back to Home</Link>
        </Button>
      </Card>
    </div>
  );
}
