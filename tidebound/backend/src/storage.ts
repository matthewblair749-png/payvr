import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { GameEvent } from "./kpi.js";

// Small file-backed storage: append-only event and report logs plus a JSON document for scheduled
// notifications. Enough for launch scale; swap for a database when volume needs it (see ROADMAP.md).
export class Storage {
  constructor(private readonly dir: string) {
    mkdirSync(dir, { recursive: true });
  }

  appendEvents(events: GameEvent[]): void {
    if (events.length) appendFileSync(join(this.dir, "events.jsonl"), events.map((e) => JSON.stringify(e)).join("\n") + "\n");
  }

  readEvents(): GameEvent[] {
    const file = join(this.dir, "events.jsonl");
    if (!existsSync(file)) return [];
    return readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as GameEvent);
  }

  // Right to erasure: drops every event and report about a user.
  eraseUser(userId: number): void {
    for (const name of ["events.jsonl", "reports.jsonl", "logs.jsonl"]) {
      const file = join(this.dir, name);
      if (!existsSync(file)) continue;
      const kept = readFileSync(file, "utf8")
        .split("\n")
        .filter(Boolean)
        .filter((l) => {
          const o = JSON.parse(l);
          return o.userId !== userId && o.reporter !== userId && o.reported !== userId;
        });
      writeFileSync(file, kept.length ? kept.join("\n") + "\n" : "");
    }
    const schedule = this.readSchedule();
    delete schedule.users[String(userId)];
    this.writeSchedule(schedule);
  }

  append(name: "reports" | "logs", record: unknown): void {
    appendFileSync(join(this.dir, `${name}.jsonl`), JSON.stringify(record) + "\n");
  }

  readSchedule(): Schedule {
    const file = join(this.dir, "schedule.json");
    return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as Schedule) : { users: {} };
  }

  writeSchedule(s: Schedule): void {
    writeFileSync(join(this.dir, "schedule.json"), JSON.stringify(s));
  }
}

export interface Schedule {
  users: Record<string, { pending: { type: string; at: number }[]; sent: Record<string, number> }>;
}
