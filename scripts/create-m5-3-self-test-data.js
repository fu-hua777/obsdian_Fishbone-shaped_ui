const fs = require("fs");
const path = require("path");

const vaultPath = process.argv[2] || "E:\\主线规划\\主线规划";
const planningRoot = path.join(vaultPath, "PlanningSystem");
const mainlinesPath = path.join(planningRoot, "Mainlines", "mainlines.json");

const mainlinesToEnsure = [
  { id: "m5-3-project", name: "M5.3项目", color: "#4f8cff", icon: "folder", order: 910, visible: true, collapsed: false, pinned: true },
  { id: "m5-3-study", name: "M5.3学习", color: "#7c3aed", icon: "book-open", order: 920, visible: true, collapsed: false, pinned: false }
];

const tasks = [
  {
    id: "task_m53_001",
    title: "M5.3 自测：修正时间轴模式",
    date: "2026-06-29",
    mainline: "M5.3项目",
    status: "doing",
    priority: "high",
    relations: [
      {
        target: "task_m53_002",
        type: "前置",
        direction: "out",
        label: "完成后",
        note: "时间轴模式稳定后再测试适应窗口"
      }
    ]
  },
  {
    id: "task_m53_002",
    title: "M5.3 自测：验证适应窗口",
    date: "2026-06-30",
    mainline: "M5.3项目",
    status: "todo",
    priority: "medium",
    relations: [
      {
        target: "task_m53_004",
        type: "支撑",
        direction: "out",
        label: "支撑",
        note: "适应窗口结果支撑视觉验收"
      }
    ]
  },
  {
    id: "task_m53_003",
    title: "M5.3 自测：主线折叠隐藏",
    date: "2026-06-29",
    mainline: "M5.3项目",
    status: "todo",
    priority: "medium",
    relations: [
      {
        target: "task_m53_006",
        type: "影响",
        direction: "out",
        label: "影响",
        note: "主线显示控制会影响关系线密度"
      }
    ]
  },
  {
    id: "task_m53_004",
    title: "M5.3 自测：概念图视觉打磨",
    date: "2026-07-02",
    mainline: "M5.3学习",
    status: "todo",
    priority: "high",
    relations: [
      {
        target: "task_m53_005",
        type: "前置",
        direction: "out",
        label: "先做视觉",
        note: "视觉打磨后再测试聚合展开"
      }
    ]
  },
  {
    id: "task_m53_005",
    title: "M5.3 自测：聚合节点展开",
    date: "2026-06-29",
    mainline: "M5.3项目",
    status: "todo",
    priority: "low",
    relations: []
  },
  {
    id: "task_m53_006",
    title: "M5.3 自测：关系线高亮",
    date: "2026-07-04",
    mainline: "M5.3学习",
    status: "blocked",
    priority: "medium",
    relations: [
      {
        target: "task_m53_001",
        type: "阻塞",
        direction: "out",
        label: "阻塞",
        note: "用于检查阻塞关系样式"
      }
    ]
  },
  {
    id: "task_m53_007",
    title: "M5.3 自测：同日密集任务 A",
    date: "2026-06-29",
    mainline: "M5.3项目",
    status: "todo",
    priority: "low",
    relations: []
  },
  {
    id: "task_m53_008",
    title: "M5.3 自测：同日密集任务 B",
    date: "2026-06-29",
    mainline: "M5.3项目",
    status: "todo",
    priority: "low",
    relations: []
  }
];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function ensureMainlines() {
  ensureDir(path.dirname(mainlinesPath));
  let data = { version: "1.0", mainlines: [] };
  if (fs.existsSync(mainlinesPath)) {
    data = JSON.parse(fs.readFileSync(mainlinesPath, "utf8"));
    if (!Array.isArray(data.mainlines)) data.mainlines = [];
  }

  for (const mainline of mainlinesToEnsure) {
    const existing = data.mainlines.find((item) => item.id === mainline.id || item.name === mainline.name);
    if (existing) {
      Object.assign(existing, {
        color: mainline.color,
        visible: true,
        collapsed: false,
        pinned: mainline.pinned
      });
    } else {
      data.mainlines.push(mainline);
    }
  }

  fs.writeFileSync(mainlinesPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function writeTask(task) {
  const [year, month] = task.date.split("-");
  const tasksRoot = path.join(planningRoot, "Tasks", year, month);
  ensureDir(tasksRoot);
  const fileName = `${task.date}_${task.mainline}_${task.title.replace(/[\\/:*?"<>|]/g, "")}.md`;
  const filePath = path.join(tasksRoot, fileName);
  const relations = task.relations.length === 0
    ? "[]"
    : `\n${task.relations.map((relation) => [
      `  - target: "${relation.target}"`,
      `    type: "${relation.type}"`,
      `    direction: "${relation.direction}"`,
      `    label: "${relation.label}"`,
      `    note: "${relation.note}"`
    ].join("\n")).join("\n")}`;
  const content = `---\n` +
    `type: planning-task\n` +
    `task_id: ${task.id}\n` +
    `title: ${task.title}\n` +
    `date: ${task.date}\n` +
    `mainline: ${task.mainline}\n` +
    `status: ${task.status}\n` +
    `priority: ${task.priority}\n` +
    `source_type: m5_3_self_test\n` +
    `source_file: scripts/create-m5-3-self-test-data.js\n` +
    `source_excerpt: "M5.3 自测任务，用于验证时间轴模式、聚合节点和 relation。"\n` +
    `relations: ${relations}\n` +
    `created: 2026-06-29 13:30\n` +
    `updated: 2026-06-29 13:30\n` +
    `review_status: confirmed\n` +
    `confidence: 1\n` +
    `---\n\n` +
    `# ${task.title}\n\n` +
    `## 任务描述\n\n` +
    `用于 M5.3 自测。\n\n` +
    `## 完成标准\n\n` +
    `- [ ] 在鱼骨画布中显示正确\n` +
    `- [ ] 与 relation 或聚合测试目标一致\n`;
  fs.writeFileSync(filePath, content, "utf8");
  return filePath;
}

function main() {
  ensureMainlines();
  const written = tasks.map(writeTask);
  console.log(`Created M5.3 self-test data in ${vaultPath}`);
  for (const file of written) {
    console.log(file);
  }
}

main();
