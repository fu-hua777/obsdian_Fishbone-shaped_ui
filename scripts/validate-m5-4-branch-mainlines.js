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

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
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

function validateFixture() {
  const fixture = readJson("tests/plugin/m5-4-branch-mainline-fixture.json");
  const mainlines = fixture.mainlines;
  const tasks = fixture.tasks;
  assert(Array.isArray(mainlines) && mainlines.length >= 2, "fixture 需要至少 1 条普通主线和 1 条分支主线");
  assert(Array.isArray(tasks) && tasks.length >= 2, "fixture 需要至少 2 个分支任务");

  const rootMainline = mainlines.find((item) => item.type === "mainline");
  const branch = mainlines.find((item) => item.type === "branch");
  assert(rootMainline, "fixture 缺少普通主线");
  assert(branch, "fixture 缺少分支主线");
  assert(branch.parent_mainline_id === rootMainline.id, "分支主线 parent_mainline_id 必须指向普通主线");
  assert(/^\d{4}-\d{2}-\d{2}$/.test(branch.start_date), "分支主线 start_date 非法");
  assert(/^\d{4}-\d{2}-\d{2}$/.test(branch.end_date), "分支主线 end_date 非法");
  assert(branch.start_date <= branch.end_date, "分支主线日期范围应为正向");
  assert(typeof branch.branch_offset === "number", "分支主线需要 branch_offset 用于保存垂直偏移");

  for (const task of tasks.filter((item) => item.branch_mainline_id)) {
    assert(task.branch_mainline_id === branch.id, `${task.task_id} 未挂载到分支主线 id`);
    assert(task.branch_mainline === branch.name, `${task.task_id} 未保留分支主线名称`);
  }
}

function main() {
  requireFile("PLANS/M5.4-branch-mainlines.md");
  requireFile("tests/plugin/m5-4-branch-mainline-fixture.json");
  requireFile("tests/plugin/m5-4-manual-test-checklist.md");

  requireText("plugin/src/data/taskTypes.ts", [
    "branchMainline",
    "branchMainlineId",
    "type: \"mainline\" | \"branch\"",
    "parentMainlineId",
    "startDate",
    "endDate",
    "branchOffset"
  ]);

  requireText("plugin/src/data/taskParser.ts", [
    "branch_mainline",
    "branch_mainline_id"
  ]);

  requireText("plugin/src/data/mainlineRepository.ts", [
    "RawMainline",
    "normalizeMainline",
    "serializeMainlinesFile",
    "parent_mainline_id",
    "start_date",
    "end_date",
    "branch_offset",
    "createBranchMainline",
    "updateBranchMainline",
    "updateBranchMainlineOffset",
    "value.type === \"branch\" ? \"branch\" : \"mainline\""
  ]);

  requireText("plugin/src/data/taskRepository.ts", [
    "branchMainline",
    "branchMainlineId",
    "branch_mainline",
    "branch_mainline_id",
    "frontmatterKeyForPatch"
  ]);

  requireText("plugin/src/views/fishboneCanvasLayout.ts", [
    "FishboneCanvasBranchMainline",
    "branchMainlines",
    "canvasPointToBranchMainline",
    "buildCanvasBranchMainlines",
    "resolveTaskBranch",
    "resolveTaskBranchMainline",
    "createBranchTaskLane",
    "clampDateToRange",
    "branchMainlineId",
    "effectiveDate"
  ]);

  requireText("plugin/src/views/FishboneTimelineView.ts", [
    "openCreateBranchFromTaskModal",
    "openEditBranchMainlineModal",
    "bindBranchMainlineContextMenu",
    "bindBranchMainlineDrag",
    "BranchMainlineEditorModal",
    "转换为分支主线",
    "移出分支主线",
    "renderCanvasBranchMainline",
    "fishbone-branch-mainline-layer",
    "is-branch-task",
    "分支主线",
    "显示日期"
  ]);

  requireText("plugin/styles.css", [
    ".fishbone-branch-mainline-layer",
    ".fishbone-branch-mainline-connector",
    ".fishbone-branch-mainline",
    ".fishbone-branch-mainline-line",
    ".fishbone-branch-mainline-label",
    ".fishbone-task-node.is-branch-task",
    ".fishbone-branch-mainline.fishbone-branch-dragging",
    ".fishbone-task-drop-hint.is-branch-target"
  ]);

  const sampleMainlines = readJson("sample-vault/PlanningSystem/Mainlines/mainlines.json");
  assert(Array.isArray(sampleMainlines.mainlines), "sample-vault mainlines 必须是数组");
  assert(sampleMainlines.mainlines.length === 0, "sample-vault 仍应保持默认无主线");

  validateFixture();
  console.log("M5.4 branch mainlines validation passed.");
}

main();
