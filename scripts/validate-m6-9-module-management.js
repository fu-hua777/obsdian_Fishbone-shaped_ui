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
  requireFile("plugin/src/dashboard/dashboardModules.ts");
  requireFile("tests/plugin/m6-9-manual-test-checklist.md");

  requireText("plugin/src/dashboard/dashboardModules.ts", [
    "DashboardModuleMeta",
    "DASHBOARD_MODULES",
    "DASHBOARD_MODULE_IDS",
    "DEFAULT_DASHBOARD_MODULE_HEIGHTS",
    "getDashboardModuleTitle",
    "daily-summary",
    "time-weather"
  ]);

  requireText("plugin/src/settings.ts", [
    "moduleVisibility",
    "moduleCollapsed"
  ]);

  requireText("plugin/src/views/FishboneTimelineView.ts", [
    "DashboardModuleManagerModal",
    "模块管理",
    "dashboardModuleVisibility",
    "dashboardModuleCollapsed",
    "normalizeDashboardModuleVisibility",
    "normalizeDashboardModuleCollapsed",
    "createDefaultDashboardModuleVisibility",
    "createDefaultDashboardModuleCollapsed",
    "is-dashboard-module-collapsed",
    "所有模块已隐藏",
    "恢复默认布局",
    "moduleVisibility: { ...this.dashboardModuleVisibility }",
    "moduleCollapsed: { ...this.dashboardModuleCollapsed }"
  ]);

  requireText("plugin/styles.css", [
    ".fishbone-dashboard-section.is-dashboard-module-collapsed",
    ".fishbone-dashboard-module-button",
    ".fishbone-module-manager-desc"
  ]);

  const view = read("plugin/src/views/FishboneTimelineView.ts");
  assert(!view.includes("折叠模块"), "Module manager should not render a second collapse-toggle column.");

  console.log("M6.9 module management validation passed.");
}

main();
