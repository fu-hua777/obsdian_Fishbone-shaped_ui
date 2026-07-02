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
  requireFile("PLANS/M8-ui-polish.md");
  requireFile("tests/plugin/m8-ui-polish-checklist.md");

  const styles = read("plugin/styles.css");
  const view = read("plugin/src/views/FishboneTimelineView.ts");

  requireText("plugin/styles.css", [
    "M8 UI visual polish",
    ".fishbone-timeline-view",
    ".fishbone-timeline-toolbar",
    ".fishbone-timeline-summary span",
    ".fishbone-toolbar-actions",
    ".fishbone-toolbar-local-time",
    ".fishbone-canvas-viewport",
    ".fishbone-fixed-date-axis-layer::before",
    ".fishbone-date-tick.is-today",
    ".fishbone-canvas-label-layer .fishbone-canvas-lane-label",
    ".fishbone-task-node",
    ".fishbone-relation-label",
    ".fishbone-branch-mainline-label",
    ".fishbone-dashboard-section",
    ".fishbone-workbench-panel",
    ".fishbone-workbench-task",
    ".fishbone-quick-input-form"
  ]);

  assert(styles.includes("backdrop-filter: blur(14px)") || styles.includes("backdrop-filter: blur(12px)"), "M8 toolbar/panel polish should use subtle backdrop blur.");
  assert(styles.includes("text-shadow:"), "Canvas labels should remain readable on the dark canvas.");
  assert(styles.includes("linear-gradient(180deg") && styles.includes("radial-gradient("), "Canvas should use layered dark background.");
  assert(styles.includes("grid-template-columns: minmax(0, 1fr) auto"), "Quick input should remain a compact input plus action button.");
  assert(styles.includes("overflow: hidden auto"), "Dashboard/workbench lists should keep internal scrolling.");
  assert(styles.includes("white-space: nowrap"), "Compact labels should protect one-line task rows.");
  assert(!view.includes("renderTimeWeatherModule"), "M8 should not reintroduce the removed weather module.");
  assert(view.includes("renderQuickInput(canvasShell"), "Quick note input should remain on the canvas.");

  console.log("M8 UI polish validation passed.");
}

main();
