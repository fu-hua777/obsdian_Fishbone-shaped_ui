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
  assert(!method.includes("const tailX"), "分支连接线不能再渲染横向尾段，避免重复生成一条分支主线");
  assert(!method.includes("L ${tailX} ${endY}"), "分支连接线 path 不能包含贴合整条分支线的尾段");
  assert(!method.includes("branch.xStart + 32 - left"), "分支连接线不能停在分支线附近而不是分支线本体");
  assert(!method.includes("endX + 56"), "分支连接线不能只使用固定短尾巴");
}

function requireBranchLabelPolish() {
  const view = read("plugin/src/views/FishboneTimelineView.ts");
  const labelMethodMatch = view.match(/private renderCanvasBranchMainlineLabel[\s\S]*?\n  \}/);
  assert(labelMethodMatch, "缺少 renderCanvasBranchMainlineLabel 方法");
  const labelMethod = labelMethodMatch[0];
  assert(labelMethod.includes("label.createSpan({ cls: \"fishbone-branch-mainline-name\", text: branch.name })"), "短期主线标签应只显示名称");
  assert(!labelMethod.includes("fishbone-branch-mainline-meta"), "短期主线标签不应直接显示日期或数量元信息");
  assert(!labelMethod.includes("branch.startDate} - ${branch.endDate} · ${branch.taskCount}"), "短期主线标签不应显示时间范围");

  const styles = read("plugin/styles.css");
  assert(styles.includes(".fishbone-branch-mainline-label"), "缺少短期主线标签样式");
  assert(styles.includes("background: transparent"), "短期主线标签应为透明背景");
  assert(styles.includes("box-shadow: none"), "短期主线标签不应使用实体卡片阴影");
  assert(styles.includes("border: 0"), "短期主线标签不应使用实体边框");
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
    "fishbone-branch-mainline-junction",
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
  requireBranchLabelPolish();

  requireText("plugin/styles.css", [
    ".fishbone-branch-mainline-connector-path",
    ".fishbone-branch-mainline-layer",
    ".fishbone-branch-mainline-junction",
    ".fishbone-branch-mainline-label-layer",
    ".fishbone-branch-mainline-floating-label",
    "z-index: 6"
  ]);

  console.log("M5.5-M5.7 canvas polish validation passed.");
}

main();
