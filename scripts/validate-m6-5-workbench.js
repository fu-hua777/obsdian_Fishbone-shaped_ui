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
  assert(fs.existsSync(path.join(root, relativePath)), `Missing file: ${relativePath}`);
}

function requireText(relativePath, patterns) {
  const content = read(relativePath);
  for (const pattern of patterns) {
    assert(content.includes(pattern), `${relativePath} missing required text: ${pattern}`);
  }
}

function main() {
  requireFile("PLANS/M6.5-l-dock-workbench.md");
  requireFile("PLANS/M6.5.6-workbench-layout-stabilization.md");
  requireFile("tests/plugin/m6-5-manual-test-checklist.md");

  requireText("plugin/src/settings.ts", [
    "progress-overview",
    "workbenchHeight",
    "workbenchColumnOrder",
    "[\"todo\", \"doing\", \"done\"]"
  ]);

  requireText("plugin/src/views/FishboneTimelineView.ts", [
    "type WorkbenchColumnId",
    "WORKBENCH_COLUMN_IDS",
    "WORKBENCH_COLUMN_META",
    "QuickInputCandidate",
    "renderDashboardProgressOverview",
    "renderDashboardProgressBar",
    "this.renderQuickInput(canvasShell",
    "renderWorkbenchPanel",
    "renderQuickInput",
    "renderWorkbenchColumn",
    "renderWorkbenchTask",
    "setIcon(icon, mainlineVisual?.icon || \"circle\")",
    "moveWorkbenchTaskToColumn",
    "moveWorkbenchColumn",
    "dashboardModuleSortDrag",
    "workbenchColumnSortDrag",
    "updateDashboardModuleSortTarget",
    "updateWorkbenchColumnSortTarget",
    "clearDashboardModuleSortFeedback",
    "clearWorkbenchColumnSortFeedback",
    "draggedWorkbenchTaskId",
    "bindWorkbenchResize",
    "setTaskStatus(task, status)",
    "fishbone-quick-input-preview"
  ]);

  requireText("plugin/styles.css", [
    "grid-template-areas:",
    "\"canvas dashboard\"",
    "\"workbench dashboard\"",
    ".fishbone-workbench-panel",
    ".fishbone-workbench-resizer",
    ".fishbone-workbench-columns",
    ".fishbone-workbench-column",
    ".fishbone-workbench-task",
    ".fishbone-workbench-task-icon",
    ".fishbone-workbench-mainline-tag",
    ".fishbone-dashboard-mainline-rings",
    ".fishbone-dashboard-drag-handle",
    ".fishbone-workbench-drag-handle",
    ".is-dashboard-module-drop-before",
    ".is-dashboard-module-drop-after",
    ".is-workbench-column-drop-before",
    ".is-workbench-column-drop-after",
    ".fishbone-quick-input",
    ".fishbone-quick-input-preview"
  ]);

  const view = read("plugin/src/views/FishboneTimelineView.ts");
  assert(!view.includes("text: \"辅助面板\""), "Right workbench should not render the old auxiliary-panel header.");
  assert(!view.includes("case \"today-progress\"") && !view.includes("case \"week-progress\""), "Today/week progress should be merged into one progress overview module.");
  assert(!view.includes("header.draggable = true"), "Module and column ordering should not rely on native HTML5 draggable.");
  assert(view.includes("bindDashboardModuleDrag(section, header, moduleId)") && view.includes("this.dashboardModuleSortDrag"), "Dashboard module ordering should use pointer drag state.");
  assert(view.includes("bindWorkbenchColumnDrag(column, header, columnId)") && view.includes("this.workbenchColumnSortDrag"), "Workbench column ordering should use pointer drag state.");
  assert(view.includes("event.dataTransfer.effectAllowed = \"move\"") && view.includes("event.dataTransfer.dropEffect = \"move\""), "Task cross-column drag should keep explicit move feedback.");
  assert(view.includes("status: \"inbox\""), "Quick-input candidate should default to inbox.");

  const styles = read("plugin/styles.css");
  assert(!styles.includes(".fishbone-dashboard-header"), "Old dashboard header styles should be removed.");
  assert(styles.includes("conic-gradient(var(--mainline-color) var(--progress-deg)"), "Mainline progress should use circular rings.");
  assert(styles.includes("grid-template-columns: repeat(3, minmax(0, 1fr))"), "Bottom workbench should stay in three columns.");
  assert(styles.includes("grid-area: dashboard;"), "Right workbench should occupy the independent dashboard area.");
  assert(styles.includes("grid-area: workbench;"), "Bottom workbench should occupy only the area below the canvas.");
  assert(styles.includes("bottom: 16px;") && styles.includes("transform: translateX(-50%);"), "Quick input should stay fixed at the bottom center of the canvas.");
  assert(styles.includes("overflow: hidden auto;"), "Workbench column contents should scroll internally.");

  console.log("M6.5/M6.5.6 L dock workbench validation passed.");
}

main();
