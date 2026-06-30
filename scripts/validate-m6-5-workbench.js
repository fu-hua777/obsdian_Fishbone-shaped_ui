const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

function assert(condition, message) {
  if (!condition) throw new Error(message);
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
  requireFile("PLANS/M6.5-l-dock-workbench.md");
  requireFile("tests/plugin/m6-5-manual-test-checklist.md");

  requireText("plugin/src/settings.ts", [
    "workbenchHeight",
    "workbenchColumnOrder",
    "[\"todo\", \"doing\", \"done\"]"
  ]);

  requireText("plugin/src/views/FishboneTimelineView.ts", [
    "type WorkbenchColumnId",
    "WORKBENCH_COLUMN_IDS",
    "WORKBENCH_COLUMN_META",
    "QuickInputCandidate",
    "fishbone-dock-main",
    "renderWorkbenchPanel",
    "renderQuickInput",
    "renderWorkbenchColumn",
    "renderWorkbenchTask",
    "moveWorkbenchTaskToColumn",
    "moveWorkbenchColumn",
    "bindWorkbenchResize",
    "setTaskStatus(task, status)",
    "隐藏工作台",
    "显示工作台",
    "M6.5 仅提供候选预览"
  ]);

  requireText("plugin/styles.css", [
    ".fishbone-dock-main",
    ".fishbone-workbench-panel",
    ".fishbone-workbench-resizer",
    ".fishbone-workbench-columns",
    ".fishbone-workbench-column",
    ".fishbone-workbench-task",
    ".fishbone-quick-input",
    ".fishbone-quick-input-preview"
  ]);

  const view = read("plugin/src/views/FishboneTimelineView.ts");
  assert(view.includes("status: \"inbox\""), "快速输入候选任务应默认进入 inbox");
  assert(!view.includes("createQuickInputTask"), "M6.5 不应直接写入快速输入任务");

  const styles = read("plugin/styles.css");
  assert(styles.includes("grid-template-columns: repeat(3, minmax(0, 1fr))"), "下方工作台应为三列布局");
  assert(styles.includes("position: absolute;") && styles.includes(".fishbone-quick-input"), "快速输入应为悬浮定位");
  assert(styles.includes("overflow: hidden auto;"), "工作台列内部应允许独立滚动");

  console.log("M6.5 L dock workbench validation passed.");
}

main();
