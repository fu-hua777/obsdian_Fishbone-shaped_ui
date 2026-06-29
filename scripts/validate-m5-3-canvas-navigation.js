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
  requireFile("PLANS/M5.3-canvas-navigation-and-visual-polish.md");
  requireFile("tests/plugin/m5-3-manual-test-checklist.md");

  requireText("plugin/src/views/fishboneCanvasViewport.ts", [
    "TimeAxisMode",
    "timeAxisMode",
    "normalizeFishboneCanvasViewport",
    "setTimeAxisMode",
    "setViewportCenterDate",
    "fitCanvasViewportToDateRange",
    "getDateTickStep",
    "getDateTickRangePadding",
    "getDateRangeFromValues"
  ]);

  requireText("plugin/src/views/fishboneCanvasLayout.ts", [
    "FishboneCanvasLayoutOptions",
    "clusters",
    "FishboneCanvasTaskCluster",
    "COMPACT_BUCKET_THRESHOLD",
    "expandedClusters",
    "buildDateScale",
    "dateToCanvasXWithScale",
    "getDateSlotWidth",
    "TASK_NODE_COLUMN_GAP",
    "isCollapsed",
    "isPinned",
    "isHidden",
    "taskCount"
  ]);

  requireText("plugin/src/views/FishboneTimelineView.ts", [
    "TIME_AXIS_MODES",
    "showHiddenMainlines",
    "expandedClusters",
    "renderViewportControls",
    "renderMainlineControls",
    "今天",
    "跳转",
    "适应窗口",
    "显示全部",
    "管理隐藏",
    "显示全部主线",
    "renderTaskCluster",
    "bindCanvasKeyboard",
    "persistViewState",
    "updateMainlineFlags",
    "const targetDate = drag.taskNode.task.date"
  ]);

  requireText("plugin/src/data/mainlineRepository.ts", [
    "updateMainlineFlags",
    "showAllMainlines",
    "visible",
    "collapsed",
    "pinned"
  ]);

  requireText("plugin/src/settings.ts", [
    "fishboneViewState",
    "FishbonePersistedViewState",
    "timeAxisMode",
    "showRelations",
    "showHiddenMainlines",
    "expandedClusters"
  ]);

  requireText("plugin/styles.css", [
    ".fishbone-title-group",
    ".fishbone-segmented-control",
    ".fishbone-zoom-readout",
    ".fishbone-date-tick.is-center-date",
    ".fishbone-canvas-lane.is-collapsed",
    ".fishbone-canvas-lane-label.is-pinned",
    ".fishbone-lane-chip",
    ".fishbone-task-cluster",
    ".fishbone-task-node.is-compacted"
  ]);

  const combined = [
    read("plugin/src/views/fishboneCanvasViewport.ts"),
    read("plugin/src/views/fishboneCanvasLayout.ts"),
    read("plugin/src/views/FishboneTimelineView.ts")
  ].join("\n");
  const forbiddenDefaultMainlines = ["健康", "学习", "事业", "生活", "财务"];
  for (const name of forbiddenDefaultMainlines) {
    assert(!combined.includes(`name: "${name}"`), `M5.3 代码疑似写死默认主线: ${name}`);
    assert(!combined.includes(`text: "${name}"`), `M5.3 代码疑似显示默认主线: ${name}`);
  }

  console.log("M5.3 canvas navigation and visual polish validation passed.");
}

main();
