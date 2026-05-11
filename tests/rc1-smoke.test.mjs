import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { buildTaskPacket, classifyTaskType } from "../scripts/lib/task-classifier.mjs";
import { queueDir, writeJson } from "../scripts/lib/queue-utils.mjs";

const execFileAsync = promisify(execFile);

async function withTempQueue(fn) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "aiboss-queue-"));
  try {
    return await fn(root);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

test("routing precedence sends note-intent Gmail attachments to attachment_analysis", async () => {
  await withTempQueue(async (root) => {
    const email = {
      id: "gmail-note-attachment",
      source: "gmail",
      intent: "note",
      subject: "幫我記一下這位學員背景",
      body: "這封是筆記，也請查背景",
      attachments: [{ filename: "student-profile.pdf", mimeType: "application/pdf", size: 12345 }],
    };
    const packet = buildTaskPacket(email);
    await writeJson(path.join(queueDir(root, packet.task_type, "pending"), `${packet.id}.json`), packet);

    const attachmentPath = path.join(root, "attachment_analysis-queue", "pending", "gmail-note-attachment.json");
    const executionPath = path.join(root, "execution-queue", "pending", "gmail-note-attachment.json");
    const status = JSON.parse(await fs.readFile(attachmentPath, "utf8"));

    assert.equal(packet.task_type, "attachment_analysis");
    assert.equal(status.task_type, "attachment_analysis");
    await assert.rejects(fs.access(executionPath));
  });
});

test("routing precedence keeps pure explicit facts without attachment as memory_note", () => {
  assert.equal(
    classifyTaskType({ intent: "note", body: "記一下：王小明生日是 7/10，喜歡黑咖啡。" }),
    "memory_note",
  );
});

test("task-report moves pending tasks to done and is idempotent", async () => {
  await withTempQueue(async (root) => {
    const packet = { id: "report-done", task_type: "attachment_analysis" };
    await writeJson(path.join(queueDir(root, packet.task_type, "pending"), `${packet.id}.json`), packet);

    const env = { ...process.env, AIBOSS_QUEUE_ROOT: root };
    await execFileAsync(process.execPath, ["scripts/task-report.mjs", "--id", packet.id, "--status", "done", "--result", "{\"ok\":true}"], { env });
    await execFileAsync(process.execPath, ["scripts/task-report.mjs", "--id", packet.id, "--status", "done", "--result", "{\"ok\":true}"], { env });

    await fs.access(path.join(queueDir(root, packet.task_type, "done"), `${packet.id}.json`));
    const result = JSON.parse(await fs.readFile(path.join(queueDir(root, packet.task_type, "done"), `${packet.id}.result.json`), "utf8"));
    assert.deepEqual(result.result, { ok: true });
  });
});

test("task-clean-test-residue is dry-run by default and apply moves matches to blocked", async () => {
  await withTempQueue(async (root) => {
    const packet = { id: "residue", task_type: "execution", project: "SafetyProj", ask: "test" };
    await writeJson(path.join(queueDir(root, packet.task_type, "pending"), `${packet.id}.json`), packet);
    const env = { ...process.env, AIBOSS_QUEUE_ROOT: root };

    await execFileAsync(process.execPath, ["scripts/task-clean-test-residue.mjs"], { env });
    await fs.access(path.join(queueDir(root, packet.task_type, "pending"), `${packet.id}.json`));

    await execFileAsync(process.execPath, ["scripts/task-clean-test-residue.mjs", "--apply"], { env });
    await fs.access(path.join(queueDir(root, packet.task_type, "blocked"), `${packet.id}.json`));
  });
});
