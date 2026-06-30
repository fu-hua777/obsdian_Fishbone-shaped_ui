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

function main() {
  requireFile("PLANS/M5.8-M5.9-fishbone-visual-qa.md");
  requireFile("tests/plugin/m5-8-9-manual-test-checklist.md");

  const view = read("plugin/src/views/FishboneTimelineView.ts");
  const styles = read("plugin/styles.css");

  assert(view.includes("connector.setAttribute(\"data-branch-mainline-id\", branch.id)"), "SVG 分支线必须带 branch id");
  assert(view.includes("spine.setAttr(\"data-branch-mainline-id\", branch.id)"), "分支命中区必须带 branch id");
  assert(view.includes("label.setAttr(\"data-branch-mainline-id\", branch.id)"), "分支标签必须带 branch id");
  assert(view.includes("bindBranchVisualActivation"), "必须绑定分支视觉 active 状态");
  assert(view.includes("setBranchVisualActive"), "必须能同步切换分支视觉 active 状态");
  assert(view.includes("this.setBranchVisualActive(branch.id, true)"), "拖拽开始必须高亮对应分支");
  assert(view.includes("this.setBranchVisualActive(drag.branch.id, false)"), "拖拽结束必须清除分支高亮");

  assert(view.includes("const tailX = branch.xEnd - left"), "单一 SVG path 必须延伸到分支结束位置");
  assert(view.includes("L ${tailX} ${endY}"), "单一 SVG path 必须包含横向分支段");
  assert(!view.includes("spine.createDiv({ cls: \"fishbone-branch-mainline-line\" })"), "不能再创建 DOM 分支横线");
  assert(!styles.includes(".fishbone-branch-mainline-line"), "不能保留旧 DOM 分支横线样式");
  assert(!styles.includes(".fishbone-branch-mainline-junction"), "不能保留旧接头点样式");

  assert(styles.includes(".fishbone-branch-mainline-connector.is-branch-active .fishbone-branch-mainline-connector-path"), "必须存在分支 active 高亮样式");
  assert(styles.includes("background: transparent"), "短期主线标签必须是透明背景");
  assert(styles.includes("box-shadow: none"), "短期主线标签不能是实体卡片");

  console.log("M5.8-M5.9 visual QA validation passed.");
}

main();
