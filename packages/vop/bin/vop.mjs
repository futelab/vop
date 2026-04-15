#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(new URL("../scripts/generate-vop.mjs", import.meta.url));
const args = process.argv.slice(2);

if (args[0] !== "generate") {
  console.error("Usage: vop generate --config <vop.config.ts> [--out <output-file-or-dir>]");
  process.exit(1);
}

const result = spawnSync(process.execPath, [scriptPath, ...args.slice(1)], {
  stdio: "inherit",
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 0);
