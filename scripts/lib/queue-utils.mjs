import { promises as fs } from "node:fs";
import path from "node:path";

export const TASK_TYPES = [
  "attachment_analysis",
  "research",
  "memory_note",
  "execution",
];

export function queueRoot() {
  return process.env.AIBOSS_QUEUE_ROOT || path.join(process.cwd(), "queues");
}

export function queueDir(root, taskType, status = "pending") {
  return path.join(root, `${taskType}-queue`, status);
}

export async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

export async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

export async function writeJson(filePath, value) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function listJsonFiles(dir) {
  if (!(await pathExists(dir))) return [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => path.join(dir, entry.name));
}

export async function findTaskPacket(root, taskId) {
  for (const taskType of TASK_TYPES) {
    for (const status of ["pending", "done", "blocked"]) {
      const filePath = path.join(queueDir(root, taskType, status), `${taskId}.json`);
      if (await pathExists(filePath)) {
        return { filePath, taskType, status };
      }
    }
  }
  return null;
}

export async function moveJsonFile(fromPath, toPath) {
  await ensureDir(path.dirname(toPath));
  if (await pathExists(toPath)) {
    await fs.rm(fromPath, { force: true });
    return;
  }
  await fs.rename(fromPath, toPath);
}
