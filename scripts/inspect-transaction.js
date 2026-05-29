#!/usr/bin/env node

const path = require("path");
const { spawnSync } = require("child_process");

const distEntry = path.join(__dirname, "..", "dist", "inspect-transaction.js");
const result = spawnSync(process.execPath, [distEntry, ...process.argv.slice(2)], {
  stdio: "inherit",
});

if (result.error) {
  console.error(`Failed to start compiled firewall: ${result.error.message}`);
  console.error("Run `npm install` and `npm run build`, then try again.");
  process.exit(1);
}

process.exit(result.status ?? 1);
