/**
 * Messages between the Babel website and the extension's small "bridge"
 * script, which the extension runs only on the /extension/connect page.
 * Both sides check `source` and the page origin.
 */
export const BRIDGE = {
  web: "babel-web",
  extension: "babel-extension",
} as const;

export type WebToExtension = { source: typeof BRIDGE.web; type: "ping" } | { source: typeof BRIDGE.web; type: "connect"; token: string; email: string };

export type ExtensionToWeb = { source: typeof BRIDGE.extension; type: "pong"; version: string } | { source: typeof BRIDGE.extension; type: "connected" };
