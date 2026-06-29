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
  requireFile("PLANS/M5-fishbone-interaction.md");
  requireFile("tests/plugin/m5-manual-test-checklist.md");

  requireText("plugin/src/data/mainlineRepository.ts", [
    "createMainline",
    "updateMainline",
    "deleteMainline",
    "moveMainline",
    "placement: \"before\" | \"after\"",
    "主线名称不能为空",
    "主线已存在",
    "visible: true",
    "collapsed: false",
    "pinned: false",
    "writeMainlinesFile"
  ]);

  requireText("plugin/src/data/taskRepository.ts", [
    "setTaskMainline",
    "setTaskDone",
    "updateTaskFields",
    "frontmatter.mainline",
    "frontmatter.status",
    "frontmatter.updated"
  ]);

  requireText("plugin/src/views/FishboneTimelineView.ts", [
    "renderMainlineControls",
    "MainlineEditorModal",
    "主线名称",
    "新建主线",
    "openEditMainlineModal",
    "contextmenu",
    "bindMainlineDrag",
    "moveMainlineByClientY",
    "fishbone-lane-drag-ready",
    "fishbone-lane-dragging",
    "type: \"checkbox\"",
    "pointerdown",
    "setTaskDone",
    "setTaskMainline",
    "TaskEditorModal",
    "编辑任务属性"
  ]);

  requireText("plugin/styles.css", [
    ".fishbone-toolbar-actions",
    ".fishbone-lane-label-interactive",
    ".fishbone-lane-drag-ready",
    ".fishbone-lane-dragging",
    ".fishbone-task-header",
    ".fishbone-task-node"
  ]);

  const interactionCode = [
    read("plugin/src/data/mainlineRepository.ts"),
    read("plugin/src/views/FishboneTimelineView.ts")
  ].join("\n");
  const forbiddenHardcodedMainlines = ["健康", "学习", "事业", "生活", "财务"];
  for (const name of forbiddenHardcodedMainlines) {
    assert(!interactionCode.includes(`name: "${name}"`), `M5 代码疑似写死默认主线: ${name}`);
    assert(!interactionCode.includes(`text: "${name}"`), `M5 代码疑似显示默认主线: ${name}`);
  }

  console.log("M5 interaction validation passed.");
}

main();
