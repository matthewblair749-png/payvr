import { cn } from '@/lib/utils';

export function Kbd({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      className={cn('inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-hairline bg-sunken px-1.5 font-sans text-xs font-medium text-muted', className)}
      {...props}
    />
  );
}
