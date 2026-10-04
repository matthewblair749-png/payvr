// Confirms the HTML calculator reproduces the brief's planning numbers from the config defaults.
// The spreadsheet uses the same formulas (verified with LibreOffice when regenerated).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import assert from "node:assert/strict";

const html = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "revenue-model.html"), "utf8");
const defaults = JSON.parse(html.match(/const DEFAULTS = (.*);/)[1]);
const compute = new Function("return " + html.match(/function compute\(s, dau = s.dailyPlayers\) \{[\s\S]*?\n\}/)[0])();
const r = compute(defaults);
const near = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} vs ${b}`);
near(r.spend, 0.15061, 1e-5, "spend per daily player");
near(r.gross, 1506, 1, "gross per month");
near(r.netS, 1280, 1, "net of 15% store cut");
near(r.fixedS, 1400, 0, "fixed costs");
near(r.breakS, 11000, 100, "standalone break-even");
near(r.keep, 0.266, 1e-9, "Roblox keep rate");
near(r.crossover, 16000, 150, "crossover");
console.log(`ok: spend ${r.spend.toFixed(4)}, gross ${r.gross.toFixed(0)}, net ${r.netS.toFixed(0)}, break-even ${Math.round(r.breakS)}, crossover ${Math.round(r.crossover)}`);
