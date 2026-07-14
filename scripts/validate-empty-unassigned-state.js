const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const layout = fs.readFileSync(path.join(root, "plugin/src/views/fishboneCanvasLayout.ts"), "utf8");
const dashboard = fs.readFileSync(path.join(root, "plugin/src/dashboard/dashboardSummary.ts"), "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(
  layout.includes("const hasUnassignedTask = tasks.some"),
  "unassigned lane must depend on an actual unassigned or orphaned task"
);
assert(
  !layout.includes("const hasUnassignedTask = mainlines.length === 0"),
  "an empty mainline list must not create an unassigned placeholder lane"
);
assert(
  dashboard.includes("if (unassignedProgress.total > 0)"),
  "dashboard must show unassigned progress only when unassigned tasks exist"
);
assert(
  !dashboard.includes("unassignedProgress.total > 0 || groups.length === 0"),
  "an empty dashboard must not create an unassigned placeholder group"
);

console.log("Empty unassigned state validation passed.");
