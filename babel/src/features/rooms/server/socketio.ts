import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import type { ServerEvents } from "../protocol";
import type { HubConnection, RoomHub } from "./hub";

/**
 * Socket.IO transport for the room hub. This is the only file that knows
 * about Socket.IO on the server: to move to a managed realtime service,
 * write an equivalent adapter and leave the hub alone.
 */
export function attachSocketIO(httpServer: HttpServer, hub: RoomHub, options: { corsOrigin: string }): Server {
  const io = new Server(httpServer, {
    cors: { origin: options.corsOrigin, methods: ["GET", "POST"] },
    // Messages are capped at 1,000 characters; nothing legitimate is bigger.
    maxHttpBufferSize: 16_000,
    pingInterval: 20_000,
    pingTimeout: 20_000,
  });

  // Credentials are checked before the connection is accepted.
  io.use(async (socket, next) => {
    const result = await hub.authenticate(socket.handshake.auth);
    if (!result.ok) return next(new Error(result.reason));
    socket.data.roomId = result.roomId;
    socket.data.participantId = result.participantId;
    next();
  });

  io.on("connection", (socket) => {
    const conn: HubConnection = {
      id: socket.id,
      emit: <E extends keyof ServerEvents>(event: E, ...args: Parameters<ServerEvents[E]>) => {
        socket.emit(event, ...args);
      },
      disconnect: () => socket.disconnect(true),
    };

    // Events are queued until the hub has sent the room, so nothing races ahead of it.
    const ready = hub.attach(conn, socket.data.roomId as string, socket.data.participantId as string).catch((error: unknown) => {
      console.error("room attach failed:", error instanceof Error ? error.message : "unknown");
      socket.disconnect(true);
    });

    socket.onAny(async (event: string, ...args: unknown[]) => {
      await ready;
      const ack = args.find((a): a is (result: unknown) => void => typeof a === "function");
      const payload = args.find((a) => typeof a !== "function");
      const result = await hub.handle(conn, event, payload);
      ack?.(result);
    });

    socket.on("disconnect", () => {
      void ready.then(() => hub.detach(conn));
    });
  });

  return io;
}
