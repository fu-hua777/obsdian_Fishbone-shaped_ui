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
  requireFile("PLANS/M6.1-M6.2-dashboard-foundation.md");
  requireFile("plugin/src/dashboard/dashboardSummary.ts");
  requireFile("tests/plugin/m6-1-dashboard-summary.ts");
  requireFile("tests/plugin/m6-1-2-manual-test-checklist.md");
  requireFile("scripts/validate-m6-1-dashboard-summary.js");

  requireText("plugin/src/dashboard/dashboardSummary.ts", [
    "export interface DashboardSummary",
    "buildDashboardSummary",
    "todayTasks",
    "weekTasks",
    "highPriorityWeekTasks",
    "mainlineProgress",
    "buildProgress",
    "UNASSIGNED_MAINLINE_NAME",
    "getWeekRange"
  ]);

  requireText("plugin/src/settings.ts", [
    "dashboardState",
    "showDashboard",
    "dashboardWidth"
  ]);

  requireText("plugin/src/views/FishboneTimelineView.ts", [
    "buildDashboardSummary",
    "showDashboard",
    "dashboardWidth",
    "renderDashboardPanel",
    "fishbone-workspace",
    "fishbone-canvas-shell",
    "fishbone-dashboard-modules",
    "fishbone-dashboard-progress-grid",
    "fishbone-dashboard-panel",
    "fishbone-dashboard-resizer",
    "persistDashboardState",
    "隐藏辅助",
    "显示辅助"
  ]);

  requireText("plugin/styles.css", [
    ".fishbone-workspace",
    ".fishbone-canvas-shell",
    ".fishbone-dashboard-panel",
    ".fishbone-dashboard-modules",
    ".fishbone-dashboard-progress-grid",
    ".fishbone-dashboard-resizer",
    ".fishbone-dashboard-section",
    ".fishbone-dashboard-progress-bar"
  ]);

  const styles = read("plugin/styles.css");
  const panelMatch = styles.match(/\.fishbone-dashboard-panel \{[\s\S]*?\n\}/);
  assert(panelMatch, "缺少 fishbone-dashboard-panel 样式块");
  assert(panelMatch[0].includes("overflow: hidden;"), "右侧面板外层必须隐藏整体滚动");
  assert(!panelMatch[0].includes("overflow: hidden auto"), "右侧面板外层不能使用整体纵向滚动");
  assert(styles.includes("grid-template-rows: auto minmax(0, 1.2fr)"), "辅助面板模块应按视口高度分配空间");
  assert(styles.includes("overflow: hidden auto;"), "任务列表或主线列表模块内部应允许独立滚动");

  console.log("M6.1-M6.2 dashboard foundation validation passed.");
}

main();
