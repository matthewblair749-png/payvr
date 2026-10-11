import Link from "next/link";
import { ROOMS } from "@/config/rooms";
import { SubmitButton } from "@/features/auth/submit-button";
import { formatMinutes } from "@/features/dashboard/format";
import { LANGUAGES } from "@/features/translation/languages";
import { createRoomAction } from "../actions";

const NOTICES: Record<string, string> = {
  invalid: "Give the room a name and tell us what to call you.",
  too_many: `You can have ${ROOMS.maxOpenRoomsPerOwner} rooms open at once. Close one first.`,
};

export function RoomsPanel({
  rooms,
  defaultName,
  roomSize,
  minutesLeft,
  notice,
}: {
  rooms: { id: string; name: string; expiresAt: Date; people: number }[];
  defaultName: string;
  roomSize: number;
  minutesLeft: number;
  notice?: string;
}) {
  const message = notice ? NOTICES[notice] : undefined;
  return (
    <section id="rooms" aria-labelledby="rooms-title" className="wrap mt-12 grid scroll-mt-8 gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div>
        <h2 id="rooms-title" className="text-3xl">
          Rooms
        </h2>
        <p className="mt-2 max-w-md text-muted">
          Open a room, send the link, and talk. Everyone writes in their own language. Your plan allows up to {roomSize} people per
          room and has {formatMinutes(minutesLeft)} of live time left this month.
        </p>
        <form action={createRoomAction} className="mt-6 grid gap-3 rounded-[var(--radius-lg)] border-2 border-ink bg-paper p-5">
          {message && (
            <p role="alert" className="rounded-[var(--radius)] bg-coral-tint px-4 py-3 font-semibold">
              {message}
            </p>
          )}
          <label htmlFor="room-name" className="font-display font-extrabold">
            Room name
          </label>
          <input
            id="room-name"
            name="name"
            required
            maxLength={ROOMS.maxRoomNameChars}
            placeholder="e.g. Weekend in Lisbon"
            className="min-h-12 rounded-[var(--radius)] border-2 border-line-strong bg-cream px-4 hover:border-ink focus-visible:border-ink"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <label htmlFor="room-display-name" className="font-display font-extrabold">
                Your name in the room
              </label>
              <input
                id="room-display-name"
                name="displayName"
                required
                maxLength={ROOMS.maxNameChars}
                defaultValue={defaultName}
                className="min-h-12 rounded-[var(--radius)] border-2 border-line-strong bg-cream px-4 hover:border-ink focus-visible:border-ink"
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="room-language" className="font-display font-extrabold">
                Your language
              </label>
              <select
                id="room-language"
                name="language"
                defaultValue="en"
                className="min-h-12 rounded-[var(--radius)] border-2 border-line-strong bg-cream px-3 hover:border-ink focus-visible:border-ink"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.native}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <SubmitButton pendingLabel="Opening…" className="mt-1">
            Open a room
          </SubmitButton>
          <p className="text-sm text-muted">
            Rooms close after {ROOMS.lifetimeHours} hours, and their messages are deleted.
          </p>
        </form>
      </div>

      <div>
        <h3 className="font-display text-xl font-extrabold">Your open rooms</h3>
        {rooms.length === 0 ? (
          <p className="mt-3 rounded-[var(--radius-lg)] border-2 border-dashed border-line-strong p-6 text-muted">
            No rooms open right now. The one you open will show up here until it closes.
          </p>
        ) : (
          <ul className="mt-3 grid gap-3">
            {rooms.map((room) => (
              <li key={room.id}>
                <Link
                  href={`/r/${room.id}`}
                  className="press flex items-center justify-between gap-4 rounded-[var(--radius-lg)] border-2 border-ink bg-white p-4 shadow-[0_3px_0_var(--ink)] hover:-translate-y-0.5 hover:shadow-[0_5px_0_var(--ink)] active:translate-y-0.5 active:shadow-[0_1px_0_var(--ink)]"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-display text-lg font-extrabold">{room.name}</span>
                    <span className="block text-sm text-muted">
                      {room.people} {room.people === 1 ? "person" : "people"} · closes{" "}
                      {room.expiresAt.toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit", timeZone: "UTC" })} UTC
                    </span>
                  </span>
                  <span aria-hidden className="font-bold text-coral-text">
                    Open →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
