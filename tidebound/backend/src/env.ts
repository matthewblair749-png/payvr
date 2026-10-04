// Runtime settings, all from environment variables (see SETUP.md).
export interface Env {
  port: number;
  gameSecret: string; // shared with game servers (Roblox Secrets store: tidebound_backend)
  adminKey: string; // for support and live-ops tools
  webhookSecret: string; // Roblox webhook secret (Creator Hub > Webhooks)
  openCloudKey: string; // Open Cloud API key with DataStore, Messaging and Notifications scopes
  universeId: string;
  notificationMessageIds: Record<string, string>; // notification type -> Roblox message template id
  dataDir: string;
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const required = (name: string): string => {
    const v = source[name];
    if (!v) throw new Error(`Missing environment variable ${name}`);
    return v;
  };
  return {
    port: Number(source.PORT ?? 8080),
    gameSecret: required("TIDEBOUND_GAME_SECRET"),
    adminKey: required("TIDEBOUND_ADMIN_KEY"),
    webhookSecret: required("ROBLOX_WEBHOOK_SECRET"),
    openCloudKey: required("ROBLOX_OPEN_CLOUD_KEY"),
    universeId: required("ROBLOX_UNIVERSE_ID"),
    notificationMessageIds: JSON.parse(source.ROBLOX_NOTIFICATION_MESSAGE_IDS ?? "{}"),
    dataDir: source.TIDEBOUND_DATA_DIR ?? "./data",
  };
}
