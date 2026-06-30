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
    "setTaskDone",
    "setTaskStatus",
    "weekFocusTasks",
    "getDashboardTaskReasons",
    "formatDashboardReason",
    "fishbone-dashboard-status-column",
    "fishbone-dashboard-mainline-meta"
  ]);

  requireText("plugin/styles.css", [
    ".fishbone-dashboard-task-checkbox",
    ".fishbone-dashboard-status-select",
    ".fishbone-dashboard-reason",
    ".fishbone-dashboard-status-column",
    ".fishbone-dashboard-status-task-list",
    ".fishbone-dashboard-mainline-meta"
  ]);

  console.log("M6.3-M6.4 dashboard modules validation passed.");
}

main();
