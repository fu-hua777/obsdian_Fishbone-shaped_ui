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
  requireFile("PLANS/M5.5-M5.7-fishbone-canvas-polish.md");
  requireFile("tests/plugin/m5-5-7-manual-test-checklist.md");
  requireFile("tests/plugin/m5-5-7-layout-regression.ts");
  requireFile("scripts/validate-m5-5-7-layout-regression.js");

  requireText("plugin/src/views/fishboneCanvasLayout.ts", [
    "TASK_SIDE_BASE_OFFSET",
    "TASK_SIDE_TRACK_GAP",
    "TASK_TRACK_COLLISION_GAP",
    "resolveTaskNodeTracks",
    "moveTaskNodeToTrack",
    "getBucketBaseSide",
    "getRelationAnchors",
    "getRelationRouteOffset",
    "...taskNodes.map((node) => node.y + node.height + 220)",
    "side: \"above\" | \"below\""
  ]);

  requireText("tests/plugin/m5-5-7-layout-regression.ts", [
    "rectsOverlap",
    "isNodeEdgeAnchor",
    "branch.side === \"above\"",
    "effectiveDate === \"2026-07-05\"",
    "layout.relationLines.length === 1",
    "M5.5-M5.7 layout regression passed."
  ]);

  requireText("scripts/validate-m5-5-7-layout-regression.js", [
    "esbuild.buildSync",
    "m5-5-7-layout-regression.ts",
    "layout-regression.cjs"
  ]);

  requireText("plugin/src/views/FishboneTimelineView.ts", [
    "getBranchConnectorBounds",
    "getBranchConnectorPath",
    "fishbone-branch-mainline-connector-path",
    "const targetDate = canvasPointToDate(point, this.viewport) ?? drag.taskNode.task.date",
    "drag.element.style.left = `${drag.taskNode.x}px`",
    "branch.side"
  ]);

  requireText("plugin/styles.css", [
    ".fishbone-branch-mainline-connector-path",
    ".fishbone-branch-mainline.fishbone-branch-below .fishbone-branch-mainline-label",
    ".fishbone-branch-mainline-layer",
    "z-index: 5"
  ]);

  console.log("M5.5-M5.7 canvas polish validation passed.");
}

main();
