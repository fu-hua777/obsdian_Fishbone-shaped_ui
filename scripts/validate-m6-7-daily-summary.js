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
  requireFile("plugin/src/dashboard/dailySummary.ts");
  requireFile("plugin/src/data/dailySummaryRepository.ts");
  requireFile("tests/plugin/m6-7-manual-test-checklist.md");

  requireText("plugin/src/dashboard/dailySummary.ts", [
    "buildDailySummaryMarkdown",
    "buildDailySummaryStats",
    "type: daily-summary",
    "## 1. 今日概览",
    "## 9. 需要用户确认的事项",
    "sourceType === \"quick-input\"",
    "relations.length"
  ]);

  requireText("plugin/src/data/dailySummaryRepository.ts", [
    "DailySummaryRepository",
    "planningSystemPath",
    "DailyReports",
    "writeSummary",
    "openSummary",
    "getSummaryPath",
    "app.vault.modify",
    "app.vault.create"
  ]);

  requireText("plugin/src/main.ts", [
    "DailySummaryRepository",
    "dailySummaryRepository",
    "new DailySummaryRepository"
  ]);

  requireText("plugin/src/settings.ts", [
    "daily-summary",
    "\"daily-summary\": 156"
  ]);

  requireText("plugin/src/views/FishboneTimelineView.ts", [
    "daily-summary",
    "renderDailySummaryModule",
    "buildDailySummaryMarkdown",
    "dailySummaryRepository.writeSummary",
    "dailySummaryRepository.openSummary",
    "生成总结",
    "查看总结"
  ]);

  requireText("plugin/styles.css", [
    ".fishbone-daily-summary-module",
    ".fishbone-daily-summary-actions"
  ]);

  const view = read("plugin/src/views/FishboneTimelineView.ts");
  assert(!view.includes("fishbone-daily-summary-metrics"), "Daily summary module should not render the four metric tags.");

  console.log("M6.7 daily summary validation passed.");
}

main();
