/**
 * Builds the extension into dist/. The Babel server address is baked in at
 * build time:   APP_URL=https://babel.example npm run build
 */
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import * as esbuild from "esbuild";

const here = import.meta.dirname;
const out = path.join(here, "dist");
const watch = process.argv.includes("--watch");
const appUrl = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
const { version } = JSON.parse(readFileSync(path.join(here, "package.json"), "utf8"));

// Chrome match patterns can't contain a port; the host alone covers all ports.
const { protocol, hostname } = new URL(appUrl);
const host = `${protocol}//${hostname}`;

const manifest = {
  manifest_version: 3,
  name: "babel: read any page in your language",
  short_name: "babel",
  version,
  description: "Translate the page you're on into your language without breaking its layout. The original is always one click away.",
  icons: { 16: "icons/16.png", 32: "icons/32.png", 48: "icons/48.png", 128: "icons/128.png" },
  action: { default_popup: "popup.html", default_title: "Translate with babel", default_icon: { 16: "icons/16.png", 32: "icons/32.png" } },
  background: { service_worker: "background.js" },
  // activeTab + scripting: pages are only read after a click or the shortcut.
  permissions: ["activeTab", "scripting", "storage"],
  host_permissions: [`${host}/*`],
  content_scripts: [{ matches: [`${host}/extension/connect*`], js: ["bridge.js"], run_at: "document_idle" }],
  commands: {
    "toggle-translation": {
      suggested_key: { default: "Alt+Shift+T" },
      description: "Translate this page, or switch back to the original",
    },
  },
};

rmSync(out, { recursive: true, force: true });
mkdirSync(path.join(out, "icons"), { recursive: true });
mkdirSync(path.join(out, "fonts"), { recursive: true });
writeFileSync(path.join(out, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
for (const file of ["popup.html", "popup.css"]) copyFileSync(path.join(here, "static", file), path.join(out, file));
for (const size of [16, 32, 48, 128]) copyFileSync(path.join(here, "static/icons", `${size}.png`), path.join(out, "icons", `${size}.png`));
const fonts = path.join(here, "../node_modules/@fontsource-variable");
copyFileSync(path.join(fonts, "nunito/files/nunito-latin-wght-normal.woff2"), path.join(out, "fonts/nunito.woff2"));
copyFileSync(path.join(fonts, "manrope/files/manrope-latin-wght-normal.woff2"), path.join(out, "fonts/manrope.woff2"));

const options = {
  entryPoints: { background: "src/background.ts", content: "src/content/main.ts", bridge: "src/bridge.ts", popup: "src/popup.ts" },
  outdir: out,
  bundle: true,
  format: "iife",
  target: "chrome110",
  minify: !watch,
  sourcemap: watch ? "inline" : false,
  alias: { "@babel-app": path.join(here, "../src") },
  define: { __APP_URL__: JSON.stringify(appUrl), __VERSION__: JSON.stringify(version) },
  logLevel: "info",
};

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
} else {
  await esbuild.build(options);
  console.log(`Built for ${appUrl} → ${path.relative(process.cwd(), out)}/`);
}
