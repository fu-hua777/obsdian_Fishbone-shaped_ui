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
  requireFile("PLANS/M6.3-M6.4-dashboard-modules.md");
  requireFile("PLANS/M6-concept-gap-and-bottom-modules.md");
  requireFile("tests/plugin/m6-3-4-manual-test-checklist.md");

  requireText("plugin/src/dashboard/dashboardSummary.ts", [
    "weekFocusTasks",
    "overdueTasks",
    "highPriority",
    "overdue",
    "uniqueTasks",
    "countHighPriority",
    "countOverdue"
  ]);

  requireText("tests/plugin/m6-1-dashboard-summary.ts", [
    "昨日遗留高优先",
    "overdueTasks",
    "weekFocusTasks",
    "项目高优先未完成任务应为 2",
    "项目过期未完成任务应为 1"
  ]);

  requireText("plugin/src/views/FishboneTimelineView.ts", [
    "showCheckbox",
    "showStatusSelect",
    "showReasonChips",
    "renderDashboardStatusSelect",
    "updateDashboardTaskDone",
    "updateDashboardTaskStatus",
    "dashboardModuleOrder",
    "dashboardModuleHeights",
    "bindDashboardModuleDrag",
    "moveDashboardModule",
    "renderDashboardModuleResizeHandle",
    "bindDashboardModuleResize",
    "normalizeDashboardModuleOrder",
    "normalizeDashboardModuleHeights",
    "normalizeDashboardModuleHeight",
    "setTaskDone",
    "setTaskStatus",
    "weekFocusTasks",
    "getDashboardTaskReasons",
    "formatDashboardReason",
    "fishbone-dashboard-mainline-meta"
  ]);
  const view = read("plugin/src/views/FishboneTimelineView.ts");
  assert(!view.includes("状态速览"), "右侧辅助面板不应再渲染状态速览模块");
  assert(!view.includes("renderDashboardStatusSection"), "状态速览渲染方法应移除，避免和下方看板重复");

  requireText("plugin/styles.css", [
    ".fishbone-dashboard-task-checkbox",
    ".fishbone-dashboard-status-select",
    ".fishbone-dashboard-reason",
    ".fishbone-dashboard-module-resize-handle",
    ".fishbone-dashboard-section.is-dashboard-module-resizing",
    ".is-dashboard-module-drop-target",
    ".fishbone-dashboard-mainline-meta"
  ]);
  const viewAfterModules = read("plugin/src/views/FishboneTimelineView.ts");
  const stylesAfterModules = read("plugin/styles.css");
  assert(!viewAfterModules.includes("toggleDashboardModuleSpan"), "右侧模块不应保留宽/窄切换逻辑");
  assert(!viewAfterModules.includes("fishbone-dashboard-module-width"), "右侧模块不应保留宽/窄按钮");
  assert(!stylesAfterModules.includes(".fishbone-dashboard-section.is-wide"), "右侧模块不应保留宽模块样式");
  assert(!stylesAfterModules.includes(".fishbone-dashboard-section.is-narrow"), "右侧模块不应保留窄模块样式");

  requireText("PLANS/M6-concept-gap-and-bottom-modules.md", [
    "下方三列工作台",
    "待办",
    "进行中",
    "已完成",
    "快速笔记 / Codex 输入",
    "每日总结",
    "M6.5：L 型工作台与下方状态工作台"
  ]);

  console.log("M6.3-M6.4 dashboard modules validation passed.");
}

main();
