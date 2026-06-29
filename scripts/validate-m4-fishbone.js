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

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function requireFile(relativePath) {
  assert(exists(relativePath), `缺少文件: ${relativePath}`);
}

function requireText(relativePath, patterns) {
  const content = read(relativePath);
  for (const pattern of patterns) {
    assert(content.includes(pattern), `${relativePath} 缺少关键文本: ${pattern}`);
  }
}

function main() {
  requireFile("PLANS/M4-fishbone-static.md");
  requireFile("plugin/src/views/FishboneTimelineView.ts");
  requireFile("plugin/src/views/fishboneLayout.ts");
  requireFile("plugin/src/views/fishboneRenderTypes.ts");
  requireFile("tests/plugin/m4-manual-test-checklist.md");

  requireText("plugin/src/main.ts", [
    "FISHBONE_TIMELINE_VIEW_TYPE",
    "open-fishbone-timeline",
    "refresh-fishbone-timeline",
    "activateTimelineView"
  ]);

  requireText("plugin/src/views/FishboneTimelineView.ts", [
    "fishbone-planner-timeline",
    "未分配",
    "当前没有用户主线",
    "buildFishboneCanvasLayout",
    "openTask"
  ]);

  requireText("plugin/src/views/fishboneLayout.ts", [
    "UNASSIGNED_LANE_ID",
    "mainlines.length === 0",
    "mainline",
    "relations"
  ]);

  requireText("plugin/styles.css", [
    ".fishbone-timeline-view",
    ".fishbone-timeline-grid",
    ".fishbone-lane-label",
    ".fishbone-task-node",
    ".fishbone-relation-line"
  ]);

  const combined = [
    read("plugin/src/views/fishboneLayout.ts"),
    read("plugin/src/views/FishboneTimelineView.ts")
  ].join("\n");
  const forbiddenDefaultMainlines = [
    "健康",
    "学习",
    "事业",
    "生活",
    "财务"
  ];
  for (const name of forbiddenDefaultMainlines) {
    assert(!combined.includes(`name: "${name}"`), `M4 代码疑似写死默认主线: ${name}`);
  }

  console.log("M4 fishbone validation passed.");
}

main();
