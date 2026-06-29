const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const planningRoot = path.join(root, "sample-vault", "PlanningSystem");

const allowedStatuses = new Set(["todo", "doing", "done", "blocked", "canceled", "inbox"]);
const allowedPriorities = new Set(["high", "medium", "low"]);
const allowedReviewStatuses = new Set(["pending", "confirmed", "rejected"]);
const allowedRelationTypes = new Set(["普通关联", "前置", "依赖", "阻塞", "参考", "支撑", "影响"]);
const allowedDirections = new Set(["in", "out", "both"]);

function readJson(relativePath) {
  const fullPath = path.join(root, relativePath);
  return JSON.parse(fs.readFileSync(fullPath, "utf8"));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function parseScalar(value) {
  const trimmed = value.trim();
  if (trimmed === "null") return null;
  if (trimmed === "[]") return [];
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseFrontmatter(markdown) {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  assert(match, "任务 md 缺少 frontmatter");

  const data = {};
  const lines = match[1].split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.trim()) continue;
    const keyValue = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!keyValue) continue;
    const key = keyValue[1];
    const value = keyValue[2];
    data[key] = parseScalar(value);
  }

  if (!Array.isArray(data.relations)) {
    data.relations = [];
  }

  return data;
}

function walkMarkdownFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkMarkdownFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(fullPath);
    }
  }
  return files;
}

function validateMainlines() {
  const mainlines = readJson("sample-vault/PlanningSystem/Mainlines/mainlines.json");
  assert(typeof mainlines.version === "string", "mainlines.json 缺少 version");
  assert(Array.isArray(mainlines.mainlines), "mainlines.json 的 mainlines 必须是数组");

  const ids = new Set();
  for (const item of mainlines.mainlines) {
    assert(typeof item.id === "string" && item.id.length > 0, "mainline.id 必须存在");
    assert(!ids.has(item.id), `mainline.id 重复: ${item.id}`);
    ids.add(item.id);
    assert(typeof item.name === "string" && item.name.length > 0, "mainline.name 必须存在");
    assert(/^#[0-9a-fA-F]{6}$/.test(item.color), `mainline.color 非法: ${item.color}`);
    assert(Number.isInteger(item.order), "mainline.order 必须是整数");
    assert(typeof item.visible === "boolean", "mainline.visible 必须是布尔值");
    assert(typeof item.collapsed === "boolean", "mainline.collapsed 必须是布尔值");
    assert(typeof item.pinned === "boolean", "mainline.pinned 必须是布尔值");
  }

  return mainlines;
}

function validateTask(frontmatter, relativePath, mainlineNames) {
  assert(frontmatter.type === "planning-task", `${relativePath}: type 必须是 planning-task`);
  assert(/^task_[0-9]{8}_[0-9]{3,}$/.test(frontmatter.task_id), `${relativePath}: task_id 非法`);
  assert(typeof frontmatter.title === "string" && frontmatter.title.length > 0, `${relativePath}: title 缺失`);
  assert(frontmatter.date === null || /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(frontmatter.date), `${relativePath}: date 非法`);
  assert(frontmatter.mainline === null || typeof frontmatter.mainline === "string", `${relativePath}: mainline 必须是字符串或 null`);
  if (frontmatter.mainline !== null && mainlineNames.size > 0) {
    assert(mainlineNames.has(frontmatter.mainline), `${relativePath}: mainline 不在 mainlines.json 中`);
  }
  assert(allowedStatuses.has(frontmatter.status), `${relativePath}: status 非法`);
  assert(allowedPriorities.has(frontmatter.priority), `${relativePath}: priority 非法`);
  assert(Array.isArray(frontmatter.relations), `${relativePath}: relations 必须是数组`);
  for (const relation of frontmatter.relations) {
    assert(typeof relation.target === "string", `${relativePath}: relation.target 缺失`);
    assert(allowedRelationTypes.has(relation.type), `${relativePath}: relation.type 非法`);
    assert(allowedDirections.has(relation.direction), `${relativePath}: relation.direction 非法`);
  }
  assert(allowedReviewStatuses.has(frontmatter.review_status), `${relativePath}: review_status 非法`);
  assert(typeof frontmatter.confidence === "number" && frontmatter.confidence >= 0 && frontmatter.confidence <= 1, `${relativePath}: confidence 非法`);
}

function validateTasks(mainlines) {
  const mainlineNames = new Set(mainlines.mainlines.map((item) => item.name));
  const taskDir = path.join(planningRoot, "Tasks");
  const files = walkMarkdownFiles(taskDir);
  assert(files.length > 0, "sample-vault 中至少需要一个示例任务");

  const tasks = [];
  const ids = new Set();
  for (const file of files) {
    const markdown = fs.readFileSync(file, "utf8");
    const frontmatter = parseFrontmatter(markdown);
    const relativePath = path.relative(path.join(root, "sample-vault"), file).replace(/\\/g, "/");
    validateTask(frontmatter, relativePath, mainlineNames);
    assert(!ids.has(frontmatter.task_id), `task_id 重复: ${frontmatter.task_id}`);
    ids.add(frontmatter.task_id);
    tasks.push({ frontmatter, relativePath });
  }
  return tasks;
}

function validateIndex(tasks) {
  const index = readJson("sample-vault/PlanningSystem/Index/task-index.json");
  assert(typeof index.version === "string", "task-index.json 缺少 version");
  assert(typeof index.generated_at === "string", "task-index.json 缺少 generated_at");
  assert(Array.isArray(index.tasks), "task-index.json 的 tasks 必须是数组");

  const byId = new Map(tasks.map((task) => [task.frontmatter.task_id, task]));
  for (const item of index.tasks) {
    assert(byId.has(item.task_id), `task-index 中存在找不到 md 的任务: ${item.task_id}`);
    const task = byId.get(item.task_id);
    assert(item.title === task.frontmatter.title, `${item.task_id}: index title 与 md 不一致`);
    assert(item.date === task.frontmatter.date, `${item.task_id}: index date 与 md 不一致`);
    assert(item.mainline === task.frontmatter.mainline, `${item.task_id}: index mainline 与 md 不一致`);
    assert(item.status === task.frontmatter.status, `${item.task_id}: index status 与 md 不一致`);
    assert(item.priority === task.frontmatter.priority, `${item.task_id}: index priority 与 md 不一致`);
    assert(item.path === task.relativePath, `${item.task_id}: index path 与 md 路径不一致`);
  }
}

function main() {
  const mainlines = validateMainlines();
  const tasks = validateTasks(mainlines);
  validateIndex(tasks);
  console.log(`Schema validation passed: ${tasks.length} task(s), ${mainlines.mainlines.length} mainline(s).`);
}

main();
