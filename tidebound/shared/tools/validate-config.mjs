// Validates every file in shared/config against its JSON Schema in shared/schemas.
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);

let failed = 0;
for (const file of readdirSync(join(root, "config")).filter((f) => f.endsWith(".json"))) {
  const name = file.replace(/\.json$/, "");
  const schema = JSON.parse(readFileSync(join(root, "schemas", `${name}.schema.json`), "utf8"));
  const data = JSON.parse(readFileSync(join(root, "config", file), "utf8"));
  const validate = ajv.compile(schema);
  if (validate(data)) {
    console.log(`ok   ${file}`);
  } else {
    failed++;
    console.error(`FAIL ${file}`);
    for (const e of validate.errors) console.error(`  ${e.instancePath || "/"} ${e.message}`);
  }
}
process.exit(failed ? 1 : 0);
