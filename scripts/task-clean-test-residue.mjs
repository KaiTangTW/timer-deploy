#!/usr/bin/env node
import path from "node:path";
import { TASK_TYPES, listJsonFiles, moveJsonFile, queueDir, queueRoot, readJson } from "./lib/queue-utils.mjs";

const apply = process.argv.includes("--apply");
const TEST_RE = /(SafetyProj|CascadeProj|ask=test|ask=測安全)/i;
const root = queueRoot();
const matches = [];

for (const taskType of TASK_TYPES) {
  for (const filePath of await listJsonFiles(queueDir(root, taskType, "pending"))) {
    const packet = await readJson(filePath);
    const haystack = JSON.stringify(packet);
    if (TEST_RE.test(haystack)) {
      matches.push({ taskType, filePath, id: packet.id || path.basename(filePath, ".json") });
    }
  }
}

for (const match of matches) {
  const toPath = path.join(queueDir(root, match.taskType, "blocked"), `${match.id}.json`);
  console.log(`${apply ? "MOVE" : "DRY-RUN"} ${match.filePath} -> ${toPath}`);
  if (apply) await moveJsonFile(match.filePath, toPath);
}

console.log(`${apply ? "Applied" : "Dry run"}: ${matches.length} test residue packet(s) ${apply ? "moved" : "matched"}.`);
if (!apply) console.log("Pass --apply to move matched packets to blocked.");
