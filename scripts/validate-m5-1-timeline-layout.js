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
  requireFile("plugin/src/views/fishboneCanvasViewport.ts");
  requireFile("plugin/src/views/fishboneCanvasLayout.ts");
  requireFile("tests/plugin/m5-1-manual-test-checklist.md");

  requireText("plugin/src/views/fishboneCanvasViewport.ts", [
    "FishboneCanvasViewport",
    "panX",
    "panY",
    "canvasZoom",
    "timeScale",
    "focusedLaneId",
    "laneZooms",
    "panCanvasViewport",
    "zoomCanvasViewport",
    "zoomTimeScale",
    "zoomLane",
    "dateToCanvasX"
  ]);

  requireText("plugin/src/views/fishboneCanvasLayout.ts", [
    "FishboneCanvasLayout",
    "FishboneCanvasDateTick",
    "FishboneCanvasLane",
    "FishboneCanvasTaskNode",
    "buildFishboneCanvasLayout",
    "dateToCanvasX",
    "spineY",
    "branchSide"
  ]);

  requireText("plugin/src/views/FishboneTimelineView.ts", [
    "fishbone-canvas-viewport",
    "fishbone-canvas-stage",
    "fishbone-fixed-date-axis-layer",
    "fishbone-mainline-layer",
    "fishbone-task-layer",
    "fishbone-canvas-label-layer",
    "renderFixedDateAxis",
    "updateFixedDateAxis",
    "dataset.dateX",
    "bindCanvasViewport",
    "renderCanvasLaneLabel",
    "mainlinePointerDrag",
    "finishPointerDrag",
    "240",
    "moveMainlineByCanvasDrop",
    "moveMainlineByClientY",
    "renderGeneration",
    "queuePersistViewState",
    "updateViewportReadouts",
    "panCanvasViewport",
    "zoomCanvasViewport",
    "zoomLane",
    "event.ctrlKey && lane?.dataset.laneId"
  ]);

  requireText("plugin/styles.css", [
    ".fishbone-canvas-viewport",
    ".fishbone-canvas-stage",
    ".fishbone-fixed-date-axis-layer",
    ".fishbone-mainline-layer",
    ".fishbone-task-layer",
    ".fishbone-canvas-label-layer",
    ".fishbone-canvas-viewport.is-mainline-drag-over",
    ".fishbone-date-tick",
    ".fishbone-canvas-lane",
    ".fishbone-canvas-spine",
    ".fishbone-canvas-lane-label"
  ]);

  const view = read("plugin/src/views/FishboneTimelineView.ts");
  assert(!view.includes("fishbone-timeline-grid"), "M5.1 主渲染不应继续依赖 fishbone-timeline-grid");

  const combined = [
    read("plugin/src/views/fishboneCanvasViewport.ts"),
    read("plugin/src/views/fishboneCanvasLayout.ts"),
    view
  ].join("\n");
  const forbiddenDefaultMainlines = ["健康", "学习", "事业", "生活", "财务"];
  for (const name of forbiddenDefaultMainlines) {
    assert(!combined.includes(`name: "${name}"`), `M5.1 代码疑似写死默认主线: ${name}`);
    assert(!combined.includes(`text: "${name}"`), `M5.1 代码疑似显示默认主线: ${name}`);
  }

  console.log("M5.1 canvas view validation passed.");
}

main();
