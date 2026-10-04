import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "./env.js";
import { OpenCloud } from "./openCloud.js";
import { Storage } from "./storage.js";
import { createValidator } from "./config.js";
import { createHandler, dispatchDue, type Deps } from "./app.js";

const here = dirname(fileURLToPath(import.meta.url));
const sharedDir = process.env.TIDEBOUND_SHARED_DIR ?? join(here, "..", "..", "..", "shared");
const env = loadEnv();
const harbor = JSON.parse(readFileSync(join(sharedDir, "config", "harbor.json"), "utf8"));
const deps: Deps = {
  env,
  cloud: new OpenCloud(env.openCloudKey, env.universeId),
  storage: new Storage(env.dataDir),
  validateConfig: createValidator(sharedDir),
  notificationRules: harbor.notifications,
  cycle: JSON.parse(readFileSync(join(sharedDir, "config", "cycle.json"), "utf8")),
  seasons: harbor.seasons,
  now: () => Math.floor(Date.now() / 1000),
};

createServer(createHandler(deps)).listen(env.port, () => {
  console.log(JSON.stringify({ level: "info", event: "listening", port: env.port }));
});
setInterval(() => {
  dispatchDue(deps).catch((err) => console.error(JSON.stringify({ level: "error", event: "dispatch_failed", error: String(err) })));
}, 60_000);
