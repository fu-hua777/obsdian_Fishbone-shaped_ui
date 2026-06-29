const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function requireFile(relativePath) {
  assert(fs.existsSync(path.join(root, relativePath)), `缺少文件: ${relativePath}`);
}

function requireText(relativePath, patterns) {
  const content = read(relativePath);
  for (const pattern of patterns) {
    assert(content.includes(pattern), `${relativePath} 缺少关键文本: ${pattern}`);
  }
}

function main() {
  requireFile("PLANS/M5.1-fishbone-timeline-layout.md");
  requireFile("plugin/src/views/fishboneViewport.ts");
  requireFile("tests/plugin/m5-1-manual-test-checklist.md");

  requireText("plugin/src/views/fishboneViewport.ts", [
    "FishboneViewportState",
    "mode: \"week\"",
    "buildViewportDateColumns",
    "moveViewportWeek",
    "moveViewportToToday",
    "showAllViewport",
    "Array.from({ length: 7 }",
    "isToday",
    "isWeekend"
  ]);

  requireText("plugin/src/views/fishboneLayout.ts", [
    "buildFishboneLayout(tasks: PlanningTask[], mainlines: Mainline[], dates: FishboneDateColumn[])",
    "createTaskNode",
    "branchSide",
    "branchIndex",
    "continue"
  ]);

  requireText("plugin/src/views/FishboneTimelineView.ts", [
    "renderViewportControls",
    "上一周",
    "下一周",
    "今天",
    "显示全部",
    "周视图",
    "fishbone-branch-",
    "fishbone-task-status",
    "fishbone-task-priority"
  ]);

  requireText("plugin/styles.css", [
    ".fishbone-viewport-controls",
    ".fishbone-timeline-date.is-today",
    ".fishbone-lane-cell.is-today",
    ".fishbone-branch-above",
    ".fishbone-branch-below",
    ".fishbone-task-doing",
    ".fishbone-task-done",
    ".fishbone-task-blocked",
    ".fishbone-priority-high",
    ".fishbone-priority-medium"
  ]);

  const combined = [
    read("plugin/src/views/fishboneViewport.ts"),
    read("plugin/src/views/fishboneLayout.ts"),
    read("plugin/src/views/FishboneTimelineView.ts")
  ].join("\n");
  const forbiddenDefaultMainlines = ["健康", "学习", "事业", "生活", "财务"];
  for (const name of forbiddenDefaultMainlines) {
    assert(!combined.includes(`name: "${name}"`), `M5.1 代码疑似写死默认主线: ${name}`);
    assert(!combined.includes(`text: "${name}"`), `M5.1 代码疑似显示默认主线: ${name}`);
  }

  console.log("M5.1 timeline layout validation passed.");
}

main();
