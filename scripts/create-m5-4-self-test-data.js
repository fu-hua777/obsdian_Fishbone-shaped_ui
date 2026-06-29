const fs = require("fs");
const path = require("path");

const vaultPath = process.argv[2] || process.env.FISHBONE_TEST_VAULT || "E:\\主线规划\\主线规划";
const planningRoot = path.join(vaultPath, "PlanningSystem");
const mainlinesPath = path.join(planningRoot, "Mainlines", "mainlines.json");

const mainlinesToEnsure = [
  {
    id: "m5-4-project",
    type: "mainline",
    name: "M5.4项目",
    color: "#4f8cff",
    icon: "folder",
    order: 940,
    visible: true,
    collapsed: false,
    pinned: true
  },
  {
    id: "m5-4-branch-ui",
    type: "branch",
    name: "M5.4短期分支",
    color: "#22c55e",
    icon: "git-branch",
    order: 941,
    visible: true,
    collapsed: false,
    pinned: false,
    parent_mainline_id: "m5-4-project",
    start_date: "2026-07-01",
    end_date: "2026-07-07"
  }
];

const tasks = [
  {
    id: "task_m54_001",
    title: "M5.4 分支主线：搭建短期主线",
    date: "2026-07-01",
    mainline: "M5.4项目",
    branchMainlineId: "m5-4-branch-ui",
    branchMainline: "M5.4短期分支",
    status: "doing",
    priority: "high",
    relations: [{ target: "task_m54_002", type: "前置", direction: "out", label: "先搭主线", note: "分支主线稳定后再挂载范围外任务" }]
  },
  {
    id: "task_m54_002",
    title: "M5.4 分支主线：验证日期范围夹取",
    date: "2026-07-12",
    mainline: "M5.4项目",
    branchMainlineId: "m5-4-branch-ui",
    branchMainline: "M5.4短期分支",
    status: "todo",
    priority: "medium",
    relations: []
  },
  {
    id: "task_m54_003",
    title: "M5.4 分支主线：同日分支任务 A",
    date: "2026-07-03",
    mainline: "M5.4项目",
    branchMainlineId: "m5-4-branch-ui",
    branchMainline: "M5.4短期分支",
    status: "todo",
    priority: "low",
    relations: []
  },
  {
    id: "task_m54_004",
    title: "M5.4 分支主线：同日分支任务 B",
    date: "2026-07-03",
    mainline: "M5.4项目",
    branchMainlineId: "m5-4-branch-ui",
    branchMainline: "M5.4短期分支",
    status: "todo",
    priority: "low",
    relations: []
  }
];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readMainlinesFile() {
  if (!fs.existsSync(mainlinesPath)) {
    return { version: "1.0", mainlines: [] };
  }
  const data = JSON.parse(fs.readFileSync(mainlinesPath, "utf8"));
  if (!Array.isArray(data.mainlines)) data.mainlines = [];
  if (typeof data.version !== "string") data.version = "1.0";
  return data;
}

function ensureMainlines() {
  ensureDir(path.dirname(mainlinesPath));
  const data = readMainlinesFile();
  for (const mainline of mainlinesToEnsure) {
    const existing = data.mainlines.find((item) => item.id === mainline.id || item.name === mainline.name);
    if (existing) {
      Object.assign(existing, mainline);
    } else {
      data.mainlines.push(mainline);
    }
  }
  fs.writeFileSync(mainlinesPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function relationYaml(relations) {
  if (relations.length === 0) return "[]";
  return `\n${relations.map((relation) => [
    `  - target: "${relation.target}"`,
    `    type: "${relation.type}"`,
    `    direction: "${relation.direction}"`,
    `    label: "${relation.label}"`,
    `    note: "${relation.note}"`
  ].join("\n")).join("\n")}`;
}

function writeTask(task) {
  const [year, month] = task.date.split("-");
  const tasksRoot = path.join(planningRoot, "Tasks", year, month);
  ensureDir(tasksRoot);
  const safeTitle = task.title.replace(/[\\/:*?"<>|]/g, "");
  const filePath = path.join(tasksRoot, `${task.date}_${task.mainline}_${safeTitle}.md`);
  const content = `---\n` +
    `type: planning-task\n` +
    `task_id: ${task.id}\n` +
    `title: ${task.title}\n` +
    `date: ${task.date}\n` +
    `mainline: ${task.mainline}\n` +
    `branch_mainline_id: ${task.branchMainlineId}\n` +
    `branch_mainline: ${task.branchMainline}\n` +
    `status: ${task.status}\n` +
    `priority: ${task.priority}\n` +
    `source_type: m5_4_self_test\n` +
    `source_file: scripts/create-m5-4-self-test-data.js\n` +
    `source_excerpt: "M5.4 自测任务，用于验证短期分支主线和子任务挂载。"\n` +
    `relations: ${relationYaml(task.relations)}\n` +
    `created: 2026-06-29 18:00\n` +
    `updated: 2026-06-29 18:00\n` +
    `review_status: confirmed\n` +
    `confidence: 1\n` +
    `---\n\n` +
    `# ${task.title}\n\n` +
    `## 任务描述\n\n` +
    `用于 M5.4 分支主线自测。\n\n` +
    `## 完成标准\n\n` +
    `- [ ] 在鱼骨画布中挂载到 M5.4短期分支\n`;
  fs.writeFileSync(filePath, content, "utf8");
  return filePath;
}

function main() {
  if (!fs.existsSync(vaultPath)) {
    throw new Error(`测试 Vault 不存在: ${vaultPath}`);
  }
  if (!fs.existsSync(path.join(vaultPath, ".obsidian"))) {
    throw new Error(`目标不是 Obsidian Vault，缺少 .obsidian: ${vaultPath}`);
  }
  ensureMainlines();
  const written = tasks.map(writeTask);
  console.log(`Created M5.4 self-test data in ${vaultPath}`);
  for (const file of written) {
    console.log(file);
  }
}

main();
