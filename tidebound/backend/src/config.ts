import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Ajv2020 } from "ajv/dist/2020.js";
import addFormatsModule from "ajv-formats";

// Validates a remote config override before it is published: merge onto the shipped defaults,
// check every section against its JSON Schema, then re-check the fairness rules. Live servers
// validate again on load (ConfigValidator.luau) and keep the old config if anything is wrong.
export const SECTIONS = ["cycle", "day", "economy", "drifters", "night", "harbor", "catalog", "compliance"] as const;
type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

export function mergePatch(target: Json, patch: Json): Json {
  if (patch === null || typeof patch !== "object" || Array.isArray(patch)) return structuredClone(patch);
  const out: { [k: string]: Json } = target && typeof target === "object" && !Array.isArray(target) ? structuredClone(target) : {};
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) delete out[k];
    else out[k] = mergePatch(out[k] ?? null, v);
  }
  return out;
}

const COSMETIC = /^(skin_|deco_|rodskin_|emote_)/;

export function createValidator(sharedDir: string) {
  const addFormats = (addFormatsModule as unknown as { default?: typeof addFormatsModule }).default ?? addFormatsModule;
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  (addFormats as unknown as (a: Ajv2020) => void)(ajv);
  const defaults: Record<string, Json> = {};
  const validators = new Map<string, ReturnType<Ajv2020["compile"]>>();
  for (const s of SECTIONS) {
    defaults[s] = JSON.parse(readFileSync(join(sharedDir, "config", `${s}.json`), "utf8"));
    validators.set(s, ajv.compile(JSON.parse(readFileSync(join(sharedDir, "schemas", `${s}.schema.json`), "utf8"))));
  }
  return function validate(overrides: Record<string, Json>): string[] {
    const errors: string[] = [];
    for (const key of Object.keys(overrides)) {
      if (!(SECTIONS as readonly string[]).includes(key)) errors.push(`unknown section ${key}`);
    }
    const merged: Record<string, any> = {};
    for (const s of SECTIONS) {
      merged[s] = overrides[s] === undefined ? defaults[s] : mergePatch(defaults[s], overrides[s]);
      const v = validators.get(s)!;
      if (!v(merged[s])) for (const e of v.errors ?? []) errors.push(`${s}${e.instancePath} ${e.message}`);
    }
    if (errors.length) return errors;
    const cat = merged.catalog;
    for (const r of cat.harborPass.paidTrack) {
      if (r.silver || r.pearls || r.eggs || r.materials) errors.push(`paid pass tier ${r.tier} grants gameplay rewards`);
      for (const c of r.cosmetics ?? []) if (!COSMETIC.test(c)) errors.push(`paid pass tier ${r.tier} grants non-cosmetic ${c}`);
    }
    for (const crate of cat.crates) for (const i of crate.items) if (!COSMETIC.test(i.id)) errors.push(`crate ${crate.id} contains non-cosmetic ${i.id}`);
    for (const p of cat.products) for (const c of p.grants?.cosmetics ?? []) if (!COSMETIC.test(c)) errors.push(`product ${p.id} grants non-cosmetic ${c}`);
    return errors;
  };
}
