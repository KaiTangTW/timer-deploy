const NOTE_RE = /(筆記|note|記一下|幫我記|紀錄|記錄|備忘|memo)/i;
const BACKGROUND_RE = /(查背景|學員背景|背景資料|research|調查)/i;
const FACT_RE = /(是|為|出生|生日|電話|email|信箱|地址|公司|職稱|喜歡|偏好|禁忌|事實|fact)/i;

function normalizeAttachments(input) {
  const attachments = input.attachments ?? input.attachment_metadata ?? input.attachmentMetadata ?? [];
  if (Array.isArray(attachments)) return attachments;
  return attachments ? [attachments] : [];
}

export function hasAttachment(input = {}) {
  return normalizeAttachments(input).length > 0 || input.has_attachment === true || input.hasAttachment === true;
}

export function classifyTaskType(input = {}) {
  const text = [
    input.subject,
    input.body,
    input.text,
    input.intent,
    input.ask,
  ]
    .filter(Boolean)
    .join("\n");
  const noteIntent = input.intent === "note" || NOTE_RE.test(text);
  const attachment = hasAttachment(input);

  if (attachment) return "attachment_analysis";
  if (BACKGROUND_RE.test(text)) return "research";
  if (noteIntent && FACT_RE.test(text)) return "memory_note";
  if (noteIntent) return "memory_note";
  return input.task_type || input.taskType || "execution";
}

export function buildTaskPacket(input = {}) {
  const taskType = classifyTaskType(input);
  return {
    id: input.id || `task-${Date.now()}`,
    task_type: taskType,
    source: input.source || "gmail",
    subject: input.subject || "",
    body: input.body || input.text || "",
    attachments: normalizeAttachments(input),
    created_at: input.created_at || new Date().toISOString(),
    metadata: input.metadata || {},
  };
}
