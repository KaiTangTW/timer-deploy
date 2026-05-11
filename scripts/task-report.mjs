#!/usr/bin/env node
import path from "node:path";
import { findTaskPacket, moveJsonFile, queueDir, queueRoot, readJson, writeJson } from "./lib/queue-utils.mjs";

function parseArgs(argv) {
  const args = { status: null, id: null, result: null, blocker: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--status") args.status = argv[++i];
    else if (arg === "--id") args.id = argv[++i];
    else if (arg === "--result") args.result = argv[++i];
    else if (arg === "--blocker") args.blocker = argv[++i];
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
if (!args.id || !["done", "blocked"].includes(args.status)) {
  console.error("Usage: npm run task-report -- --id <task-id> --status <done|blocked> [--result json] [--blocker json]");
  process.exit(2);
}

const root = queueRoot();
const found = await findTaskPacket(root, args.id);
if (!found) {
  console.error(`NOT SAFE: task not found: ${args.id}`);
  process.exit(1);
}

const packet = await readJson(found.filePath);
const taskType = packet.task_type || found.taskType;
const archivedPath = path.join(queueDir(root, taskType, args.status), `${args.id}.json`);
const outputName = args.status === "done" ? "result.json" : "blocker.json";
const outputPayload = args.status === "done" ? args.result : args.blocker;
const outputPath = path.join(queueDir(root, taskType, args.status), `${args.id}.${outputName}`);

if (found.status === "pending") {
  await moveJsonFile(found.filePath, archivedPath);
} else if (found.status !== args.status) {
  console.error(`NOT SAFE: task ${args.id} already archived as ${found.status}`);
  process.exit(1);
}

await writeJson(outputPath, {
  task_id: args.id,
  task_type: taskType,
  status: args.status,
  [args.status === "done" ? "result" : "blocker"]: outputPayload ? JSON.parse(outputPayload) : {},
  archived_at: new Date().toISOString(),
});

console.log(`Archived ${args.id} as ${args.status}`);
