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
  assert(fs.existsSync(path.join(root, relativePath)), `Missing file: ${relativePath}`);
}

function requireText(relativePath, patterns) {
  const content = read(relativePath);
  for (const pattern of patterns) {
    assert(content.includes(pattern), `${relativePath} missing required text: ${pattern}`);
  }
}

function main() {
  requireFile("PLANS/M6.6-M6.9-detailed-plan.md");
  requireFile("tests/plugin/m6-6-manual-test-checklist.md");

  requireText("plugin/src/data/taskRepository.ts", [
    "sourceType?: \"manual\" | \"quick-input\"",
    "source_type: ${input.sourceType ?? \"manual\"}",
    "createTask(input: CreatePlanningTaskInput)"
  ]);

  requireText("plugin/src/views/FishboneTimelineView.ts", [
    "interface QuickInputCandidate",
    "buildQuickInputCandidateV2",
    "hasMultipleCandidates",
    "检测到多条输入",
    "sourceType: \"quick-input\"",
    "sourceExcerpt: candidate.text",
    "confirm.addEventListener(\"click\", async",
    "编辑后创建",
    "initial?: Partial<CreatePlanningTaskInput>",
    "sourceType: this.sourceType",
    "await this.plugin.taskRepository.createTask"
  ]);

  const view = read("plugin/src/views/FishboneTimelineView.ts");
  assert(view.includes("date: string | null"), "Quick-input candidate date should allow inbox/null.");
  assert(view.includes("mainline: string | null"), "Quick-input candidate mainline should allow unassigned/null.");
  assert(view.includes("未匹配到现有主线"), "Quick input should warn instead of auto-creating unknown mainlines.");
  assert(view.includes("YYYY-MM-DD") || view.includes("\\d{4}-\\d{2}-\\d{2}"), "Quick input should recognize ISO dates.");
  assert(view.includes("明天") && view.includes("后天"), "Quick input should recognize relative Chinese dates.");

  console.log("M6.6 quick input validation passed.");
}

main();
