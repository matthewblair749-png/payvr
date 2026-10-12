import { ButtonLink } from "@/components/ui/button";
import { SubmitButton } from "@/features/auth/submit-button";
import { formatDay } from "@/features/dashboard/format";
import { disconnectExtensionAction } from "../actions";

export function ExtensionPanel({ browsers }: { browsers: { id: string; label: string; lastUsedAt: Date }[] }) {
  return (
    <section aria-labelledby="extension-title" className="wrap mt-12 grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div>
        <h2 id="extension-title" className="text-3xl">
          Browser extension
        </h2>
        <p className="mt-2 max-w-md text-muted">
          Translate whole pages in place, without losing the layout. A page counts as one translation, however long it is.
        </p>
        <ButtonLink href="/extension/connect" variant="ink" className="mt-5">
          Connect a browser
        </ButtonLink>
      </div>
      <div>
        <h3 className="font-display text-xl font-extrabold">Connected browsers</h3>
        {browsers.length === 0 ? (
          <p className="mt-3 rounded-[var(--radius-lg)] border-2 border-dashed border-line-strong p-6 text-muted">
            None yet. Browsers you connect show up here, and you can disconnect them any time.
          </p>
        ) : (
          <ul className="mt-3 grid gap-3">
            {browsers.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-lg)] border-2 border-ink bg-white p-4">
                <span>
                  <span className="block font-display text-lg font-extrabold">{b.label}</span>
                  <span className="block text-sm text-muted">Last used {formatDay(b.lastUsedAt)}</span>
                </span>
                <form action={disconnectExtensionAction}>
                  <input type="hidden" name="tokenId" value={b.id} />
                  <SubmitButton variant="outline" pendingLabel="Disconnecting…">
                    Disconnect
                  </SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
