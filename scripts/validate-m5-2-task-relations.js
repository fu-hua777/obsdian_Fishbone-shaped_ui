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
  requireFile("PLANS/M5.2-task-node-and-relations.md");
  requireFile("tests/plugin/m5-2-manual-test-checklist.md");

  requireText("plugin/src/data/taskRepository.ts", [
    "TaskFieldPatch",
    "updateTaskFields",
    "setTaskDate",
    "setTaskPriority",
    "setTaskStatus",
    "frontmatter.updated",
    "processFrontMatter"
  ]);

  requireText("plugin/src/views/fishboneCanvasLayout.ts", [
    "TASK_NODE_WIDTH",
    "TASK_NODE_HEIGHT",
    "anchorTop",
    "anchorBottom",
    "anchorLeft",
    "anchorRight",
    "spineAnchor",
    "relationLines",
    "taskNodeByTaskId",
    "taskNodeByPath",
    "taskNodeByTitle",
    "FishboneCanvasRelationLine",
    "clientPointToCanvasPoint",
    "canvasPointToDate",
    "canvasPointToMainline",
    "resolveRelationTarget"
  ]);

  requireText("plugin/src/views/FishboneTimelineView.ts", [
    "showRelations",
    "renderRelationLayer",
    "fishbone-relation-layer",
    "group.addClass(\"fishbone-relation\")",
    "group.addClass(line.className)",
    "renderTaskBranchLine",
    "fishbone-task-branch-line",
    "bindTaskDrag",
    "taskPointerDrag",
    "fishbone-task-dragging",
    "fishbone-task-drop-hint",
    "updateTaskFields",
    "TaskEditorModal",
    "showTaskTooltip",
    "highlightTaskRelations",
    "clearRelationHighlights",
    "关系：",
    "来源：",
    "目标："
  ]);

  requireText("plugin/styles.css", [
    ".fishbone-relation-layer",
    ".fishbone-relation",
    ".fishbone-relation-path",
    ".fishbone-relation-label",
    ".fishbone-task-branch-layer",
    ".fishbone-task-branch-line",
    ".fishbone-task-node.fishbone-task-dragging",
    ".fishbone-task-node.is-relation-highlight",
    ".fishbone-task-drop-hint",
    ".fishbone-task-tooltip"
  ]);

  const combined = [
    read("plugin/src/views/fishboneCanvasLayout.ts"),
    read("plugin/src/views/FishboneTimelineView.ts")
  ].join("\n");
  const forbiddenDefaultMainlines = ["健康", "学习", "事业", "生活", "财务"];
  for (const name of forbiddenDefaultMainlines) {
    assert(!combined.includes(`name: "${name}"`), `M5.2 代码疑似写死默认主线: ${name}`);
    assert(!combined.includes(`text: "${name}"`), `M5.2 代码疑似显示默认主线: ${name}`);
  }
  assert(
    !combined.includes("fishbone-relation ${line.className}"),
    "关系线 SVG class 不能把多个 class 作为一个 DOMTokenList token 添加"
  );

  console.log("M5.2 task interaction and relation validation passed.");
}

main();
