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
    "M8.2 interaction detail polish",
    "M8.6 top chrome overlap guard",
    "M8.11 top chrome separation",
    "M8.12 dashboard/workbench scan polish",
    "M8.13 canvas lane/date polish",
    "M8.14 canvas task focus polish",
    "M8.15 top chrome flow guard",
    ".fishbone-timeline-view",
    ".fishbone-timeline-toolbar",
    ".fishbone-top-meta-row",
    ".fishbone-timeline-summary span",
    ".fishbone-toolbar-actions",
    ".fishbone-toolbar-button",
    ".fishbone-toolbar-button-icon",
    ".fishbone-toolbar-button-label",
    ".fishbone-zoom-control",
    ".fishbone-zoom-percent",
    ".fishbone-time-scale-readout",
    ".fishbone-toolbar-local-time",
    ".fishbone-canvas-viewport",
    ".fishbone-fixed-date-axis-layer::before",
    ".fishbone-date-tick.is-today",
    ".fishbone-canvas-label-layer .fishbone-canvas-lane-label",
    ".fishbone-lane-icon",
    ".fishbone-lane-count",
    ".fishbone-task-node",
    ".fishbone-task-node::before",
    ".fishbone-task-checkbox",
    ".fishbone-relation-label",
    ".fishbone-branch-mainline-label",
    ".fishbone-dashboard-section",
    ".fishbone-dashboard-module-icon",
    ".fishbone-dashboard-module-icon-button",
    ".fishbone-dashboard-module-button-icon",
    ".fishbone-dashboard-task-color-dot",
    ".fishbone-dashboard-task-priority",
    ".fishbone-dashboard-status-select.fishbone-status-done",
    ".fishbone-workbench-panel",
    ".fishbone-workbench-column-icon",
    ".fishbone-workbench-column-title",
    ".fishbone-workbench-task",
    ".fishbone-workbench-column.is-workbench-drop-target",
    ".fishbone-quick-input-form",
    ".fishbone-quick-input-submit",
    ".fishbone-quick-input-submit-icon"
  ]);

  assert(styles.includes("backdrop-filter: blur(14px)") || styles.includes("backdrop-filter: blur(12px)"), "M8 toolbar/panel polish should use subtle backdrop blur.");
  assert(styles.includes("text-shadow:"), "Canvas labels should remain readable on the dark canvas.");
  assert(styles.includes("linear-gradient(180deg") && styles.includes("radial-gradient("), "Canvas should use layered dark background.");
  assert(styles.includes("grid-template-columns: minmax(0, 1fr) auto"), "Quick input should remain a compact input plus action button.");
  assert(styles.includes("overflow: hidden auto"), "Dashboard/workbench lists should keep internal scrolling.");
  assert(styles.includes("white-space: nowrap"), "Compact labels should protect one-line task rows.");
  assert(styles.includes(".fishbone-quick-input-form:focus-within"), "Quick input should have a visible focus state.");
  assert(styles.includes(".fishbone-dashboard-section.is-dashboard-module-dragging"), "Dashboard module drag state should stay visually distinct.");
  assert(view.includes("icon?: string"), "Toolbar helper should support icon labels.");
  assert(view.includes("updateToolbarButton"), "Toolbar labels/icons should be centrally rendered.");
  assert(view.includes("setIcon(iconEl, icon)"), "Toolbar icons should use Obsidian/lucide icons.");
  assert(view.includes("\"plus-circle\"") && view.includes("\"refresh-cw\"") && view.includes("\"calendar-days\""), "Primary toolbar actions should be iconized.");
  assert(view.includes("zoomCanvasFromToolbar") && view.includes("\"缩小\"") && view.includes("\"放大\""), "Toolbar should expose explicit canvas zoom controls.");
  assert(view.includes("fishbone-zoom-percent") && view.includes("fishbone-time-scale-readout"), "Zoom readouts should use stable classes instead of span order.");
  assert(view.includes("getDashboardModuleIcon"), "Dashboard modules should render stable module icons.");
  assert(view.includes("fishbone-dashboard-task-color-dot"), "Dashboard task rows should expose mainline color dots.");
  assert(view.includes("fishbone-workbench-column-icon"), "Workbench columns should render status icons.");
  assert(view.includes("setIcon(laneIcon") && view.includes("mainline?.icon"), "Canvas mainline labels should render configured mainline icons.");
  assert(view.includes(".setName(\"图标\")"), "Mainline editor should expose icon input.");
  assert(view.includes("createMainline(name, color, icon)") && view.includes("updateMainline(mainline.id, name, color, icon)"), "Mainline icon edits should be persisted.");
  assert(styles.includes(".fishbone-lane-icon svg"), "Canvas mainline icon badge should style SVG icons.");
  assert(styles.includes(".fishbone-canvas-label-layer .fishbone-canvas-lane-label::before"), "Canvas mainline labels should have a subtle colored rail.");
  assert(styles.includes(".fishbone-date-tick.is-center-date::before") && styles.includes(".fishbone-date-tick.is-today::before"), "Center/today date ticks should have anchor dots.");
  assert(styles.includes(".fishbone-dashboard-task {") && styles.includes("border-left: 2px solid"), "Dashboard task rows should have a mainline color stripe.");
  assert(styles.includes(".fishbone-zoom-control .fishbone-toolbar-button-label") && styles.includes("display: none"), "Zoom stepper buttons should stay compact.");
  assert(view.includes("const topMetaRow = container.createDiv({ cls: \"fishbone-top-meta-row\" })") && view.includes("this.renderToolbarLocalTime(topMetaRow)") && !view.includes("renderToolbarLocalTime(toolbar"), "Local time should render in its own top meta row, not as a toolbar child.");
  assert(styles.includes("grid-template-columns: minmax(190px, 320px) minmax(0, 1fr) auto"), "Top toolbar should use stable columns to prevent title/control overlap.");
  assert(styles.includes("grid-template-columns: minmax(160px, 300px) minmax(320px, 1fr) max-content"), "M8.15 should tighten top toolbar columns so the title cannot collide with right controls.");
  assert(styles.includes("position: static") && styles.includes("align-items: flex-end"), "Local time readout should be static and right aligned.");
  assert(styles.includes(".fishbone-top-meta-row") && styles.includes("min-height: 32px") && styles.includes("clear: both"), "Top meta row should reserve vertical space before summary chips.");
  assert(styles.includes("border: 0 !important") && styles.includes("background: transparent !important"), "Top title/control containers should be borderless enough to avoid title overlap.");
  assert(view.includes("data-task-status") && view.includes("data-task-priority"), "Task nodes should expose stable status/priority attributes for visual polish.");
  assert(view.includes("data-task-date"), "Task nodes should expose display date for visual focus states.");
  assert(view.includes("fishbone-task-checkbox"), "Task checkbox should have a stable class for status styling.");
  assert(styles.includes(".fishbone-task-done::before") && styles.includes(".fishbone-task-blocked::before"), "Task status styling should distinguish done and blocked tasks.");
  assert(styles.includes(".fishbone-task-doing::after"), "Doing task nodes should have a subtle active state.");
  assert(view.includes("is-today-task") && view.includes("is-center-task") && view.includes("is-overdue-task"), "Canvas task nodes should expose today/center/overdue visual states.");
  assert(view.includes("task.status !== \"done\" && task.status !== \"canceled\""), "Done/canceled tasks should not be classified as overdue.");
  assert(styles.includes(".fishbone-task-node.is-today-task") && styles.includes(".fishbone-task-node.is-overdue-task"), "Task focus states should be styled.");
  assert(styles.includes(".fishbone-priority-high .fishbone-task-priority") && styles.includes(".fishbone-priority-medium .fishbone-task-priority"), "Task priority pills should have visible severity styling.");
  assert(view.includes("fishbone-quick-input-submit") && view.includes("send-horizontal"), "Quick input submit action should use an icon button.");
  assert(!view.includes("form.createEl(\"button\", { text: \"预览\" })"), "Quick input should not render the old plain text preview button.");
  assert(styles.includes("width: 34px") && styles.includes("height: 34px"), "Quick input send button should keep a stable square size.");
  assert(view.includes("fishbone-dashboard-module-icon-button") && view.includes("chevron-up") && view.includes("chevron-down") && view.includes("eye-off"), "Dashboard module header actions should be icon buttons.");
  assert(!view.includes("createEl(\"button\", { text: this.dashboardModuleCollapsed") && !view.includes("createEl(\"button\", { text: \"隐藏\" })"), "Dashboard module header should not use old text action buttons.");
  assert(styles.includes(".fishbone-dashboard-module-count") && styles.includes("border-radius: 999px"), "Dashboard module counts should render as compact pills.");
  assert(view.includes("panel.setAttr(\"aria-label\", \"状态工作台\")"), "Workbench should keep semantic labeling after removing the visible explanatory header.");
  assert(!view.includes("fishbone-workbench-title") && !view.includes("待办、进行中、已完成与鱼骨任务状态同步"), "Workbench should not render the old bulky visible header/subtitle.");
  assert(styles.includes(".fishbone-workbench-columns") && styles.includes("height: 100%"), "Workbench columns should use the vertical space freed by removing the header.");
  assert(!view.includes("renderTimeWeatherModule"), "M8 should not reintroduce the removed weather module.");
  assert(view.includes("renderQuickInput(canvasShell"), "Quick note input should remain on the canvas.");
  assert(view.includes("function formatStatus(status: TaskStatus): string"), "Visible task statuses should be localized through a single helper.");
  assert(view.includes("dropdown.addOption(status, formatStatus(status))"), "Task status dropdowns should display localized labels while keeping original values.");
  assert(view.includes("select.createEl(\"option\", { text: formatStatus(status), value: status })"), "Dashboard status select should localize labels without changing values.");
  assert(view.includes("formatStatus(candidate.status)") && view.includes("formatStatus(task.status)"), "Quick input and task views should not expose raw status labels.");
  assert(view.includes("状态：${formatStatus(status)}") && view.includes("任务状态已更新为 ${formatStatus(status)}"), "Context menus and notifications should localize status labels.");
  assert(view.includes("fishbone-dashboard-task-priority"), "Dashboard task priority should render in the top row for scanability.");
  assert(view.includes("fishbone-dashboard-status-select fishbone-status-${task.status}"), "Dashboard status selects should expose status-specific classes for compact status pills.");
  assert(view.includes("fishbone-lane-count") && view.includes("String(lane.taskCount)"), "Canvas lane labels should expose task count as a separate badge.");
  assert(view.includes("lane.isUnassigned ? \"临时泳道\" : \"用户主线\""), "Canvas lane subtitles should remain type descriptions after task count moves to a badge.");
  const dashboardTaskSectionStart = view.indexOf("private renderDashboardTaskSection");
  const dashboardTaskSectionEnd = view.indexOf("private renderDashboardMainlineProgress");
  const dashboardTaskSection = view.slice(dashboardTaskSectionStart, dashboardTaskSectionEnd);
  assert(dashboardTaskSection.includes("fishbone-dashboard-task-priority"), "Dashboard task priority should be rendered by the dashboard task section.");
  assert(!dashboardTaskSection.includes("meta.createSpan({ cls: `fishbone-dashboard-priority"), "Dashboard priority should not remain in the right-side module meta row.");
  assert(styles.includes(".fishbone-workbench-task {") && styles.includes("min-height: 34px"), "Workbench task rows should be compact enough for the bottom workbench.");
  assert(styles.includes(".fishbone-dashboard-status-select {") && styles.includes("width: 52px"), "Dashboard status selects should be compact pill controls.");

  console.log("M8 UI polish validation passed.");
}

main();
