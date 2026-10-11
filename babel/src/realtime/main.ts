/**
 * The realtime room server. Runs next to the Next.js app:
 *   npm run realtime   (or `npm run dev:all` for both in development)
 *
 * Started with Node's "react-server" condition so the shared server modules'
 * `import "server-only"` guards resolve to nothing outside Next.
 */
import "./env";
import { createServer } from "node:http";
import { ROOMS } from "@/config/rooms";
import { RoomHub } from "@/features/rooms/server/hub";
import { attachSocketIO } from "@/features/rooms/server/socketio";
import { translate } from "@/features/translation/server/translate";
import { db } from "@/server/db";

const port = Number(process.env.REALTIME_PORT ?? 3001);
const appUrl = process.env.APP_URL ?? "http://localhost:3000";

const http = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, ...hub.stats() }));
    return;
  }
  res.writeHead(404).end();
});

const hub = new RoomHub({ db, translate });
attachSocketIO(http, hub, { corsOrigin: appUrl });

// A failed timer run is logged and retried next time, never fatal.
const every = (ms: number, task: () => Promise<void>, name: string) =>
  setInterval(() => task().catch((e: unknown) => console.error(`${name} failed:`, e instanceof Error ? e.message : e)), ms);

every(ROOMS.minuteTickMs, () => hub.tick(), "minute tick");
every(10 * 60_000, () => hub.sweep(), "room sweep");
void hub.sweep().catch(() => undefined);

http.listen(port, () => {
  console.info(`[babel] realtime rooms on :${port} (accepting ${appUrl})`);
});
