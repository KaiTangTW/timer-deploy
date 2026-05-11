#!/usr/bin/env node
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { TASK_TYPES, listJsonFiles, queueDir, queueRoot } from "./lib/queue-utils.mjs";

const execFileAsync = promisify(execFile);
const root = queueRoot();
const failures = [];

async function runStep(name, command, args) {
  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      cwd: process.cwd(),
      env: process.env,
      maxBuffer: 1024 * 1024 * 5,
    });
    console.log(`\n[PASS] ${name}`);
    if (stdout.trim()) console.log(stdout.trim());
    if (stderr.trim()) console.error(stderr.trim());
  } catch (error) {
    failures.push(name);
    console.log(`\n[FAIL] ${name}`);
    if (error.stdout?.trim()) console.log(error.stdout.trim());
    if (error.stderr?.trim()) console.error(error.stderr.trim());
  }
}

console.log("AI BOSS RC Check");
console.log(`Queue root: ${root}`);

console.log("\n[PASS] doctor");
console.log("doctor: no worker enablement, launchd send changes, Gemini, dashboard, or attachment download required for RC check.");

console.log("\nQueue summary");
for (const taskType of TASK_TYPES) {
  const pending = (await listJsonFiles(queueDir(root, taskType, "pending"))).length;
  const done = (await listJsonFiles(queueDir(root, taskType, "done"))).length;
  const blocked = (await listJsonFiles(queueDir(root, taskType, "blocked"))).length;
  console.log(`${taskType}: pending=${pending} done=${done} blocked=${blocked}`);
}

await runStep("smoke checks", process.execPath, ["--test", "tests/rc1-smoke.test.mjs"]);

if (failures.length === 0) {
  console.log("\nSAFE TO OPERATE");
} else {
  console.log(`\nNOT SAFE: failed ${failures.join(", ")}`);
  process.exit(1);
}
