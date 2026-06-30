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

function requireBranchConnectorContinuity() {
  const content = read("plugin/src/views/FishboneTimelineView.ts");
  const methodMatch = content.match(/private getBranchConnectorPath[\s\S]*?\n  \}/);
  assert(methodMatch, "缺少 getBranchConnectorPath 方法");
  const method = methodMatch[0];
  assert(method.includes("const startX = branch.xStart - left"), "分支连接线起点必须使用分支起点 x");
  assert(method.includes("const startY = branch.parentY - top"), "分支连接线起点必须落在父主线 y");
  assert(method.includes("const endX = branch.xStart - left"), "分支连接线终点必须落在分支线起点 x，避免断开");
  assert(method.includes("const endY = branch.y - top"), "分支连接线终点必须落在分支线 y");
  assert(method.includes("const tailX = endX + 56"), "分支连接线必须沿分支线重叠一段");
  assert(method.includes("L ${tailX} ${endY}"), "分支连接线 path 必须包含贴合分支线的尾段");
  assert(!method.includes("branch.xStart + 32 - left"), "分支连接线不能停在分支线附近而不是分支线本体");
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
    "renderCanvasBranchMainlineLabel",
    "fishbone-branch-mainline-connector-path",
    "fishbone-branch-mainline-label-layer",
    "const targetDate = canvasPointToDate(point, this.viewport) ?? drag.taskNode.task.date",
    "drag.element.style.left = `${drag.taskNode.x}px`",
    "branch.side",
    "hasHiddenMainlines",
    "renderMainlineControls(toolbar, mainlines)",
    "startCanvasY",
    "startBranchOffset",
    "elementStartTop"
  ]);
  requireBranchConnectorContinuity();

  requireText("plugin/styles.css", [
    ".fishbone-branch-mainline-connector-path",
    ".fishbone-branch-mainline-layer",
    ".fishbone-branch-mainline-label-layer",
    ".fishbone-branch-mainline-floating-label",
    "z-index: 6"
  ]);

  console.log("M5.5-M5.7 canvas polish validation passed.");
}

main();
