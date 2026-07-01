import { ItemView, Menu, Modal, Notice, setIcon, Setting, WorkspaceLeaf } from "obsidian";
import FishbonePlannerPlugin from "../main";
import { buildDailySummaryMarkdown, buildDailySummaryStats } from "../dashboard/dailySummary";
import { DashboardProgress, DashboardSummary, buildDashboardSummary } from "../dashboard/dashboardSummary";
import { CreatePlanningTaskInput, TaskFieldPatch } from "../data/taskRepository";
import { Mainline, PlanningTask, TaskPriority, TaskStatus } from "../data/taskTypes";
import {
  buildFishboneCanvasLayout,
  canvasPointToBranchMainline,
  canvasPointToDate,
  canvasPointToLane,
  canvasPointToMainline,
  clientPointToCanvasPoint,
  FishboneCanvasBranchMainline,
  FishboneCanvasLane,
  FishboneCanvasLayout,
  FishboneCanvasRelationLine,
  FishboneCanvasTaskCluster,
  FishboneCanvasTaskNode
} from "./fishboneCanvasLayout";
import {
  createDefaultFishboneCanvasViewport,
  DateRange,
  FishboneCanvasViewport,
  TimeAxisMode,
  fitCanvasViewportToDateRange,
  formatPercent,
  getDateRangeFromValues,
  getLocalDateString,
  normalizeFishboneCanvasViewport,
  panCanvasViewport,
  parseDateString,
  resetCanvasViewport,
  setFocusedLane,
  setTimeAxisMode,
  setViewportCenterDate,
  zoomCanvasViewport,
  zoomLane
} from "./fishboneCanvasViewport";

export const FISHBONE_TIMELINE_VIEW_TYPE = "fishbone-planner-timeline";
const TASK_STATUSES: TaskStatus[] = ["todo", "doing", "done", "blocked", "canceled", "inbox"];
const TASK_PRIORITIES: TaskPriority[] = ["high", "medium", "low"];
const TIME_AXIS_MODES: Array<{ id: TimeAxisMode; label: string }> = [
  { id: "day", label: "日" },
  { id: "week", label: "周" },
  { id: "month", label: "月" },
  { id: "overview", label: "总览" }
];

interface DashboardTaskRenderOptions {
  showCheckbox?: boolean;
  showStatusSelect?: boolean;
  showReasonChips?: boolean;
  summary?: DashboardSummary;
}

type DashboardModuleId = "progress-overview" | "today-focus" | "week-focus" | "mainline-progress" | "daily-summary";
type WorkbenchColumnId = "todo" | "doing" | "done";

const DASHBOARD_MODULE_IDS: DashboardModuleId[] = ["progress-overview", "today-focus", "week-focus", "mainline-progress", "daily-summary"];
const DEFAULT_DASHBOARD_MODULE_HEIGHTS: Record<DashboardModuleId, number> = {
  "progress-overview": 128,
  "today-focus": 188,
  "week-focus": 188,
  "mainline-progress": 190,
  "daily-summary": 156
};
const WORKBENCH_COLUMN_IDS: WorkbenchColumnId[] = ["todo", "doing", "done"];
const WORKBENCH_COLUMN_META: Record<WorkbenchColumnId, { title: string; targetStatus: TaskStatus; emptyText: string }> = {
  todo: { title: "待办", targetStatus: "todo", emptyText: "暂无待办任务" },
  doing: { title: "进行中", targetStatus: "doing", emptyText: "暂无进行中任务" },
  done: { title: "已完成", targetStatus: "done", emptyText: "暂无已完成任务" }
};

interface QuickInputCandidate {
  text: string;
  title: string;
  date: string | null;
  mainline: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  hasMultipleCandidates: boolean;
  warnings: string[];
}

export class FishboneTimelineView extends ItemView {
  private plugin: FishbonePlannerPlugin;
  private viewport: FishboneCanvasViewport = createDefaultFishboneCanvasViewport();
  private showRelations = true;
  private showHiddenMainlines = false;
  private showDashboard = true;
  private dashboardWidth = 340;
  private dashboardModuleOrder: DashboardModuleId[] = [...DASHBOARD_MODULE_IDS];
  private dashboardModuleHeights: Record<DashboardModuleId, number> = { ...DEFAULT_DASHBOARD_MODULE_HEIGHTS };
  private workbenchHeight = 260;
  private workbenchColumnOrder: WorkbenchColumnId[] = [...WORKBENCH_COLUMN_IDS];
  private quickInputCandidate: QuickInputCandidate | null = null;
  private expandedClusters = new Set<string>();
  private renderGeneration = 0;
  private persistViewStateTimer: number | null = null;
  private dashboardResizeDrag: { pointerId: number; startX: number; startWidth: number; panel: HTMLElement } | null = null;
  private workbenchResizeDrag: {
    pointerId: number;
    timer: number | null;
    active: boolean;
    startY: number;
    startHeight: number;
    panel: HTMLElement;
  } | null = null;
  private dashboardModuleResizeDrag: {
    moduleId: DashboardModuleId;
    pointerId: number;
    timer: number | null;
    active: boolean;
    startY: number;
    startHeight: number;
    section: HTMLElement;
  } | null = null;
  private dashboardModuleSortDrag: {
    moduleId: DashboardModuleId;
    pointerId: number;
    startX: number;
    startY: number;
    active: boolean;
    source: HTMLElement;
    targetId: DashboardModuleId | null;
    insertAfter: boolean;
  } | null = null;
  private workbenchColumnSortDrag: {
    columnId: WorkbenchColumnId;
    pointerId: number;
    startX: number;
    startY: number;
    active: boolean;
    source: HTMLElement;
    targetId: WorkbenchColumnId | null;
    insertAfter: boolean;
  } | null = null;
  private draggedWorkbenchTaskId: string | null = null;
  private panDrag: { pointerId: number; x: number; y: number } | null = null;
  private suppressNextMainlineClick = false;
  private suppressNextTaskClick = false;
  private suppressNextBranchClick = false;
  private mainlinePointerDrag: {
    sourceId: string;
    pointerId: number;
    timer: number | null;
    active: boolean;
    layout: FishboneCanvasLayout;
    mainlines: Mainline[];
    canvas: HTMLElement;
    label: HTMLElement;
  } | null = null;
  private taskPointerDrag: {
    taskNode: FishboneCanvasTaskNode;
    pointerId: number;
    timer: number | null;
    active: boolean;
    layout: FishboneCanvasLayout;
    mainlines: Mainline[];
    canvas: HTMLElement;
    element: HTMLElement;
  } | null = null;
  private branchPointerDrag: {
    branch: FishboneCanvasBranchMainline;
    pointerId: number;
    timer: number | null;
    active: boolean;
    canvas: HTMLElement;
    element: HTMLElement;
    startCanvasY: number;
    startBranchOffset: number;
    elementStartTop: number;
  } | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: FishbonePlannerPlugin) {
    super(leaf);
    this.plugin = plugin;
    const saved = plugin.settings.fishboneViewState ?? {};
    this.viewport = normalizeFishboneCanvasViewport(saved);
    this.showRelations = saved.showRelations !== false;
    this.showHiddenMainlines = saved.showHiddenMainlines === true;
    this.showDashboard = plugin.settings.dashboardState?.showDashboard !== false;
    this.dashboardWidth = normalizeDashboardWidth(plugin.settings.dashboardState?.dashboardWidth);
    this.dashboardModuleOrder = normalizeDashboardModuleOrder(plugin.settings.dashboardState?.moduleOrder);
    this.dashboardModuleHeights = normalizeDashboardModuleHeights(plugin.settings.dashboardState?.moduleHeights);
    this.workbenchHeight = normalizeWorkbenchHeight(plugin.settings.dashboardState?.workbenchHeight);
    this.workbenchColumnOrder = normalizeWorkbenchColumnOrder(plugin.settings.dashboardState?.workbenchColumnOrder);
    this.expandedClusters = new Set(saved.expandedClusters ?? []);
  }

  getViewType(): string {
    return FISHBONE_TIMELINE_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Fishbone Planner 鱼骨画布视图";
  }

  async onOpen(): Promise<void> {
    await this.render();
  }

  async render(): Promise<void> {
    const renderId = ++this.renderGeneration;
    const container = this.containerEl.children[1];

    try {
      const [mainlines, tasks] = await Promise.all([
        this.plugin.mainlineRepository.listMainlines(),
        this.plugin.taskRepository.listTasks()
      ]);
      if (renderId !== this.renderGeneration) return;

      container.empty();
      container.addClass("fishbone-timeline-view");

      const layout = buildFishboneCanvasLayout(tasks, mainlines, this.viewport, {
        showHiddenMainlines: this.showHiddenMainlines,
        expandedClusters: this.expandedClusters
      });
      const dateRange = getDateRangeFromValues([
        ...tasks.map((task) => task.date),
        ...mainlines.flatMap((mainline) => mainline.type === "branch" ? [mainline.startDate, mainline.endDate] : [])
      ]);
      const dashboardSummary = buildDashboardSummary(tasks, mainlines, { today: getLocalDateString(new Date()) });

      const toolbar = container.createDiv({ cls: "fishbone-timeline-toolbar" });
      const titleGroup = toolbar.createDiv({ cls: "fishbone-title-group" });
      titleGroup.createDiv({ cls: "fishbone-timeline-title", text: "鱼骨画布视图" });
      titleGroup.createDiv({ cls: "fishbone-toolbar-subtitle", text: `${formatMode(this.viewport.timeAxisMode)} · 中心 ${this.viewport.centerDate}` });
      this.renderViewportControls(toolbar, tasks, dateRange);
      this.renderMainlineControls(toolbar, mainlines);

      const summary = container.createDiv({ cls: "fishbone-timeline-summary" });
      summary.createSpan({ text: `任务 ${tasks.length}` });
      summary.createSpan({ text: `主线 ${mainlines.length}` });
      summary.createSpan({ text: `泳道 ${layout.lanes.length}` });
      summary.createSpan({ text: `关系 ${layout.relationLines.length}` });
      summary.createSpan({ text: `聚合 ${layout.clusters.length}` });
      summary.createSpan({ text: `范围 ${formatDateRange(dateRange)}` });
      summary.createSpan({ text: `画布 ${formatPercent(this.viewport.canvasZoom)}` });
      summary.createSpan({ text: `时间 ${Math.round(this.viewport.timeScale)}px/天` });

      if (mainlines.length === 0) {
        container.createDiv({
          cls: "fishbone-timeline-warning",
          text: "当前没有用户主线。系统不会创建默认主线；未分配任务会显示在临时泳道中。"
        });
      }

      const workspace = container.createDiv({
        cls: [
          "fishbone-workspace",
          this.showDashboard ? "" : "is-dashboard-hidden"
        ].filter(Boolean).join(" ")
      });
      const canvasShell = workspace.createDiv({ cls: "fishbone-canvas-shell" });
      this.renderCanvas(canvasShell, layout, mainlines, tasks);
      if (this.showDashboard) {
        this.renderQuickInput(canvasShell, dashboardSummary, mainlines);
        this.renderDashboardPanel(workspace, dashboardSummary, tasks, mainlines);
        this.renderWorkbenchPanel(workspace, dashboardSummary, mainlines);
      }
    } catch (error) {
      if (renderId !== this.renderGeneration) return;
      container.empty();
      container.addClass("fishbone-timeline-view");
      console.error("Fishbone Planner: timeline render failed", error);
      await this.renderDiagnostics(container, error);
    }
  }

  private renderViewportControls(toolbar: HTMLElement, tasks: PlanningTask[], dateRange: DateRange): void {
    const controls = toolbar.createDiv({ cls: "fishbone-viewport-controls" });
    const modeGroup = controls.createDiv({ cls: "fishbone-segmented-control" });
    for (const mode of TIME_AXIS_MODES) {
      const button = modeGroup.createEl("button", { text: mode.label });
      button.toggleClass("is-active", this.viewport.timeAxisMode === mode.id);
      button.addEventListener("click", async () => {
        this.viewport = setTimeAxisMode(this.viewport, mode.id);
        await this.persistViewState();
        await this.render();
      });
    }

    this.createToolbarButton(controls, "今天", async () => {
      this.viewport = setViewportCenterDate(this.viewport, getLocalDateString(new Date()));
      await this.persistViewState();
      await this.render();
    });
    this.createToolbarButton(controls, "跳转", async () => {
      const value = window.prompt("跳转到日期（YYYY-MM-DD）", this.viewport.centerDate);
      if (!value) return;
      if (!parseDateString(value.trim())) {
        new Notice("日期格式应为 YYYY-MM-DD");
        return;
      }
      this.viewport = setViewportCenterDate(this.viewport, value.trim());
      await this.persistViewState();
      await this.render();
    });
    this.createToolbarButton(controls, "适应窗口", async () => {
      this.viewport = fitCanvasViewportToDateRange(this.viewport, dateRange, this.containerEl.clientWidth);
      await this.persistViewState();
      await this.render();
    });
    this.createToolbarButton(controls, "显示全部", async () => {
      this.viewport = setTimeAxisMode(this.viewport, "overview");
      this.viewport = fitCanvasViewportToDateRange(this.viewport, dateRange, this.containerEl.clientWidth);
      await this.persistViewState();
      await this.render();
    });
    this.createToolbarButton(controls, "重置", async () => {
      this.viewport = resetCanvasViewport(this.viewport);
      await this.persistViewState();
      await this.render();
    });
    const relationButton = controls.createEl("button", { text: this.showRelations ? "隐藏关系" : "显示关系" });
    relationButton.addEventListener("click", async (event) => {
      event.preventDefault();
      this.showRelations = !this.showRelations;
      await this.persistViewState();
      relationButton.textContent = this.showRelations ? "隐藏关系" : "显示关系";
      this.updateRelationLayerVisibility();
    });
    const dashboardButton = controls.createEl("button", { text: this.showDashboard ? "隐藏工作台" : "显示工作台" });
    dashboardButton.addEventListener("click", async (event) => {
      event.preventDefault();
      this.showDashboard = !this.showDashboard;
      await this.persistDashboardState();
      await this.render();
    });

    const zoomGroup = controls.createDiv({ cls: "fishbone-zoom-readout" });
    zoomGroup.createSpan({ text: formatPercent(this.viewport.canvasZoom) });
    zoomGroup.createSpan({ text: `${Math.round(this.viewport.timeScale)}px/天` });
  }

  private renderMainlineControls(toolbar: HTMLElement, mainlines: Mainline[]): void {
    const actionGroup = toolbar.createDiv({ cls: "fishbone-toolbar-actions" });
    const hasHiddenMainlines = mainlines.some((mainline) => mainline.visible === false);
    if (hasHiddenMainlines || this.showHiddenMainlines) {
      this.createToolbarButton(actionGroup, this.showHiddenMainlines ? "隐藏已隐藏" : "管理隐藏", async () => {
        this.showHiddenMainlines = !this.showHiddenMainlines;
        await this.persistViewState();
        await this.render();
      });
    }
    if (hasHiddenMainlines) {
      this.createToolbarButton(actionGroup, "显示全部主线", async () => {
        await this.plugin.mainlineRepository.showAllMainlines();
        this.showHiddenMainlines = false;
        await this.persistViewState();
        await this.render();
      });
    }
    this.createToolbarButton(actionGroup, "新建主线", async () => {
      new NewTaskModal(this.plugin, mainlines, async (input) => {
        const file = await this.plugin.taskRepository.createTask(input);
        new Notice(`已创建任务：${input.title}`);
        await this.render();
        await this.app.workspace.getLeaf(false).openFile(file);
      }).open();
    }, true);
    const newTaskButton = actionGroup.lastElementChild;
    if (newTaskButton instanceof HTMLButtonElement) {
      newTaskButton.textContent = "新建任务";
    }
    this.createToolbarButton(actionGroup, "新建主线", async () => {
      new MainlineEditorModal(this.plugin, {
        title: "新建主线",
        submitText: "创建",
        name: "",
        color: "#4f8cff",
        onSubmit: async (name, color) => {
          try {
            await this.plugin.mainlineRepository.createMainline(name, color);
          } catch (error) {
            this.renderInlineError(this.containerEl.children[1], error);
            throw error;
          }
          new Notice(`已创建主线：${name.trim()}`);
          await this.render();
        }
      }).open();
    }, true);
    this.createToolbarButton(actionGroup, "刷新", async () => {
      await this.render();
    });
  }

  private createToolbarButton(parent: HTMLElement, text: string, onClick: () => Promise<void>, cta = false): HTMLButtonElement {
    const button = parent.createEl("button", { text });
    if (cta) button.addClass("mod-cta");
    button.addEventListener("click", (event) => {
      event.preventDefault();
      void onClick();
    });
    return button;
  }

  private async renderDiagnostics(container: Element, error: unknown): Promise<void> {
    const panel = container.createDiv({ cls: "fishbone-diagnostic-panel" });
    panel.createDiv({ cls: "fishbone-diagnostic-title", text: "Fishbone Planner 诊断" });
    panel.createDiv({ text: `错误：${formatError(error)}` });
    panel.createDiv({ text: `PlanningSystem 路径：${this.plugin.settings.planningSystemPath}` });

    const mainlinesPath = `${this.plugin.settings.planningSystemPath}/Mainlines/mainlines.json`;
    const tasksPath = `${this.plugin.settings.planningSystemPath}/Tasks`;
    try {
      const mainlinesExists = await this.plugin.app.vault.adapter.exists(mainlinesPath);
      const tasksExists = await this.plugin.app.vault.adapter.exists(tasksPath);
      panel.createDiv({ text: `主线文件：${mainlinesPath} · ${mainlinesExists ? "存在" : "不存在"}` });
      panel.createDiv({ text: `任务目录：${tasksPath} · ${tasksExists ? "存在" : "不存在"}` });
      if (mainlinesExists) {
        const raw = await this.plugin.app.vault.adapter.read(mainlinesPath);
        const parsed = JSON.parse(raw) as { mainlines?: unknown[] };
        panel.createDiv({ text: `主线数量：${Array.isArray(parsed.mainlines) ? parsed.mainlines.length : 0}` });
      }
    } catch (diagnosticError) {
      panel.createDiv({ text: `诊断读取失败：${formatError(diagnosticError)}` });
    }

    this.createToolbarButton(panel, "重置视图状态", async () => {
      this.viewport = createDefaultFishboneCanvasViewport();
      this.showRelations = true;
      this.showHiddenMainlines = false;
      this.expandedClusters.clear();
      await this.persistViewState();
      await this.render();
    });
  }

  private renderInlineError(container: Element, error: unknown): void {
    const panel = container.createDiv({ cls: "fishbone-inline-error" });
    panel.createSpan({ text: `Fishbone Planner 错误：${formatError(error)}` });
  }

  private renderDashboardPanel(parent: HTMLElement, summary: DashboardSummary, tasks: PlanningTask[], mainlines: Mainline[]): void {
    const panel = parent.createDiv({ cls: "fishbone-dashboard-panel" });
    panel.style.width = `${this.dashboardWidth}px`;
    const resizer = panel.createDiv({ cls: "fishbone-dashboard-resizer" });
    this.bindDashboardResize(resizer, panel);

    const modules = panel.createDiv({ cls: "fishbone-dashboard-modules" });
    for (const moduleId of this.dashboardModuleOrder) {
      this.renderDashboardModule(modules, moduleId, summary, tasks, mainlines);
    }
  }

  private renderDashboardModule(parent: HTMLElement, moduleId: DashboardModuleId, summary: DashboardSummary, tasks: PlanningTask[], mainlines: Mainline[]): void {
    const section = parent.createDiv({
      cls: [
        "fishbone-dashboard-section",
        `fishbone-dashboard-module-${moduleId}`,
        isDashboardProgressModule(moduleId) ? "fishbone-dashboard-progress-module" : "fishbone-dashboard-scroll-module"
      ].join(" ")
    });
    section.style.height = `${this.dashboardModuleHeights[moduleId]}px`;
    section.setAttr("data-dashboard-module-id", moduleId);

    switch (moduleId) {
      case "progress-overview":
        this.renderDashboardProgressOverview(section, moduleId, summary);
        break;
      case "today-focus":
        this.renderDashboardTaskSection(section, moduleId, "今日聚焦", summary.todayTasks.slice(0, 8), "今日暂无任务", {
          showCheckbox: true,
          showStatusSelect: true
        });
        break;
      case "week-focus":
        this.renderDashboardTaskSection(section, moduleId, "本周重点", summary.weekFocusTasks.slice(0, 8), "本周暂无重点任务", {
          showStatusSelect: true,
          showReasonChips: true,
          summary
        });
        break;
      case "mainline-progress":
        this.renderDashboardMainlineProgress(section, moduleId, summary);
        break;
      case "daily-summary":
        this.renderDailySummaryModule(section, moduleId, summary, tasks, mainlines);
        break;
    }
    this.renderDashboardModuleResizeHandle(section, moduleId);
  }

  private renderDashboardModuleHeader(section: HTMLElement, moduleId: DashboardModuleId, title: string, countText: string): HTMLElement {
    const header = section.createDiv({ cls: "fishbone-dashboard-section-header" });
    header.setAttr("title", "拖动模块标题可调整模块位置");
    header.createSpan({ cls: "fishbone-dashboard-drag-handle", text: "⋮⋮" });
    header.createSpan({ text: title });
    const controls = header.createDiv({ cls: "fishbone-dashboard-module-controls" });
    controls.createSpan({ cls: "fishbone-dashboard-module-count", text: countText });
    this.bindDashboardModuleDrag(section, header, moduleId);
    return header;
  }

  private renderDashboardProgressOverview(section: HTMLElement, moduleId: DashboardModuleId, summary: DashboardSummary): void {
    this.renderDashboardModuleHeader(section, moduleId, "进度概览", `${summary.todayProgress.done}/${summary.todayProgress.total}`);
    const rows = section.createDiv({ cls: "fishbone-dashboard-progress-overview" });
    this.renderDashboardProgressBar(rows, "今日", summary.todayProgress);
    this.renderDashboardProgressBar(rows, "本周", summary.weekProgress);
  }

  private renderDashboardProgressBar(parent: HTMLElement, label: string, progress: DashboardProgress): void {
    const row = parent.createDiv({ cls: "fishbone-dashboard-progress-row" });
    const top = row.createDiv({ cls: "fishbone-dashboard-progress-row-top" });
    top.createSpan({ text: label });
    top.createSpan({ text: `${Math.round(progress.rate * 100)}%` });
    const bar = row.createDiv({ cls: "fishbone-dashboard-progress-bar" });
    const fill = bar.createDiv({ cls: "fishbone-dashboard-progress-fill" });
    fill.style.width = `${Math.round(progress.rate * 100)}%`;
    const meta = row.createDiv({ cls: "fishbone-dashboard-meta-row" });
    meta.createSpan({ text: `完成 ${progress.done}/${progress.total}` });
    meta.createSpan({ text: `进 ${progress.doing}` });
    meta.createSpan({ text: `阻 ${progress.blocked}` });
  }

  private renderDashboardTaskSection(
    section: HTMLElement,
    moduleId: DashboardModuleId,
    title: string,
    tasks: PlanningTask[],
    emptyText: string,
    options: DashboardTaskRenderOptions = {}
  ): void {
    this.renderDashboardModuleHeader(section, moduleId, title, String(tasks.length));
    if (tasks.length === 0) {
      section.createDiv({ cls: "fishbone-dashboard-empty", text: emptyText });
      return;
    }
    const list = section.createDiv({ cls: "fishbone-dashboard-task-list" });
    for (const task of tasks) {
      const row = list.createDiv({ cls: `fishbone-dashboard-task fishbone-task-${task.status}` });
      row.setAttr("title", `${task.title}\n${task.date ?? "无日期"} · ${task.mainline ?? "未分配"}`);
      row.addEventListener("click", () => {
        void this.plugin.taskRepository.openTask(task);
      });
      const top = row.createDiv({ cls: "fishbone-dashboard-task-top" });
      if (options.showCheckbox) {
        const checkbox = top.createEl("input", { type: "checkbox", cls: "fishbone-dashboard-task-checkbox" });
        checkbox.checked = task.status === "done";
        checkbox.addEventListener("click", (event) => event.stopPropagation());
        checkbox.addEventListener("change", (event) => {
          event.stopPropagation();
          void this.updateDashboardTaskDone(task, checkbox.checked);
        });
      }
      top.createDiv({ cls: "fishbone-dashboard-task-title", text: task.title });
      if (options.showStatusSelect) {
        this.renderDashboardStatusSelect(top, task);
      }
      const meta = row.createDiv({ cls: "fishbone-dashboard-task-meta" });
      meta.createSpan({ text: task.mainline ?? "未分配" });
      meta.createSpan({ text: task.date ?? "无日期" });
      meta.createSpan({ cls: `fishbone-dashboard-priority is-${task.priority}`, text: formatPriority(task.priority) });
      if (options.showReasonChips && options.summary) {
        const reasons = getDashboardTaskReasons(task, options.summary);
        if (reasons.length > 0) {
          const chips = row.createDiv({ cls: "fishbone-dashboard-reason-row" });
          for (const reason of reasons) {
            chips.createSpan({ cls: `fishbone-dashboard-reason is-${reason}`, text: formatDashboardReason(reason) });
          }
        }
      }
    }
  }

  private renderDashboardMainlineProgress(section: HTMLElement, moduleId: DashboardModuleId, summary: DashboardSummary): void {
    this.renderDashboardModuleHeader(section, moduleId, "主线进度", String(summary.mainlineProgress.length));
    const grid = section.createDiv({ cls: "fishbone-dashboard-mainline-rings" });
    for (const item of summary.mainlineProgress.slice(0, 8)) {
      const ringItem = grid.createDiv({ cls: "fishbone-dashboard-mainline-ring-item" });
      ringItem.style.setProperty("--mainline-color", item.color);
      ringItem.style.setProperty("--progress-deg", `${Math.round(item.rate * 360)}deg`);
      const ring = ringItem.createDiv({ cls: "fishbone-dashboard-mainline-ring" });
      ring.createSpan({ text: `${Math.round(item.rate * 100)}%` });
      ringItem.createDiv({ cls: "fishbone-dashboard-mainline-ring-name", text: item.name });
      ringItem.createDiv({ cls: "fishbone-dashboard-mainline-ring-meta", text: `总 ${item.total} · 进 ${item.doing} · 阻 ${item.blocked}` });
    }
  }

  private renderDailySummaryModule(
    section: HTMLElement,
    moduleId: DashboardModuleId,
    summary: DashboardSummary,
    tasks: PlanningTask[],
    mainlines: Mainline[]
  ): void {
    const file = this.plugin.dailySummaryRepository.getSummaryFile(summary.today);
    this.renderDashboardModuleHeader(section, moduleId, "每日总结", file ? "已生成" : "未生成");
    const stats = buildDailySummaryStats(tasks, summary.today);
    const body = section.createDiv({ cls: "fishbone-daily-summary-module" });
    body.createDiv({
      cls: "fishbone-daily-summary-status",
      text: file ? `已生成 ${formatLocalDateTimeForSummary(new Date(file.stat.mtime))}` : "今日总结尚未生成"
    });
    const metrics = body.createDiv({ cls: "fishbone-daily-summary-metrics" });
    metrics.createSpan({ text: `任务 ${stats.taskCount}` });
    metrics.createSpan({ text: `完成 ${stats.doneCount}` });
    metrics.createSpan({ text: `阻塞 ${stats.blockedCount}` });
    metrics.createSpan({ text: `快输 ${stats.quickInputCount}` });
    const actions = body.createDiv({ cls: "fishbone-daily-summary-actions" });
    const generateButton = actions.createEl("button", { text: file ? "重新生成" : "生成总结" });
    generateButton.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      const content = buildDailySummaryMarkdown({
        date: summary.today,
        summary,
        tasks,
        mainlines,
        generatedAt: formatLocalDateTimeForSummary(new Date())
      });
      await this.plugin.dailySummaryRepository.writeSummary(summary.today, content);
      new Notice(file ? "已重新生成今日总结" : "已生成今日总结");
      await this.render();
    });
    const openButton = actions.createEl("button", { text: "查看总结" });
    if (!file) openButton.disabled = true;
    openButton.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      const opened = await this.plugin.dailySummaryRepository.openSummary(summary.today);
      if (!opened) new Notice("今日总结尚未生成");
    });
  }

  private renderDashboardStatusSelect(parent: HTMLElement, task: PlanningTask): void {
    const select = parent.createEl("select", { cls: "fishbone-dashboard-status-select" });
    for (const status of TASK_STATUSES) {
      select.createEl("option", { text: status, value: status });
    }
    select.value = task.status;
    select.addEventListener("click", (event) => event.stopPropagation());
    select.addEventListener("change", (event) => {
      event.stopPropagation();
      void this.updateDashboardTaskStatus(task, select.value as TaskStatus);
    });
  }

  private bindDashboardModuleDrag(section: HTMLElement, handle: HTMLElement, moduleId: DashboardModuleId): void {
    handle.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || (event.target as HTMLElement).closest("button, select, input")) return;
      event.preventDefault();
      event.stopPropagation();
      handle.setPointerCapture(event.pointerId);
      this.dashboardModuleSortDrag = {
        moduleId,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        active: false,
        source: section,
        targetId: null,
        insertAfter: false
      };
    });

    handle.addEventListener("pointermove", (event) => {
      const drag = this.dashboardModuleSortDrag;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
      if (!drag.active && distance < 4) return;
      event.preventDefault();
      event.stopPropagation();
      drag.active = true;
      drag.source.addClass("is-dashboard-module-dragging");
      this.updateDashboardModuleSortTarget(event.clientY);
    });

    const finish = async (event: PointerEvent) => {
      const drag = this.dashboardModuleSortDrag;
      if (!drag || drag.pointerId !== event.pointerId) return;
      this.clearDashboardModuleSortFeedback();
      this.dashboardModuleSortDrag = null;
      if (drag.active && drag.targetId && drag.targetId !== drag.moduleId) {
        await this.moveDashboardModule(drag.moduleId, drag.targetId, drag.insertAfter);
      }
    };
    handle.addEventListener("pointerup", (event) => {
      void finish(event);
    });
    handle.addEventListener("pointercancel", (event) => {
      void finish(event);
    });
  }

  private updateDashboardModuleSortTarget(clientY: number): void {
    const drag = this.dashboardModuleSortDrag;
    if (!drag) return;
    let nextTargetId: DashboardModuleId | null = null;
    let nextInsertAfter = false;
    this.containerEl.querySelectorAll<HTMLElement>(".fishbone-dashboard-section[data-dashboard-module-id]").forEach((section) => {
      const id = section.getAttr("data-dashboard-module-id") ?? "";
      if (!isDashboardModuleId(id) || id === drag.moduleId) return;
      const rect = section.getBoundingClientRect();
      if (clientY >= rect.top && clientY <= rect.bottom) {
        nextTargetId = id;
        nextInsertAfter = clientY > rect.top + rect.height / 2;
      }
    });
    drag.targetId = nextTargetId;
    drag.insertAfter = nextInsertAfter;
    this.clearDashboardModuleSortFeedback();
    drag.source.addClass("is-dashboard-module-dragging");
    if (!nextTargetId) return;
    const target = this.containerEl.querySelector<HTMLElement>(`.fishbone-dashboard-section[data-dashboard-module-id="${nextTargetId}"]`);
    target?.addClass(nextInsertAfter ? "is-dashboard-module-drop-after" : "is-dashboard-module-drop-before");
  }

  private clearDashboardModuleSortFeedback(): void {
    this.containerEl.querySelectorAll<HTMLElement>(".is-dashboard-module-dragging, .is-dashboard-module-drop-before, .is-dashboard-module-drop-after").forEach((target) => {
      target.removeClass("is-dashboard-module-dragging");
      target.removeClass("is-dashboard-module-drop-before");
      target.removeClass("is-dashboard-module-drop-after");
    });
  }

  private async moveDashboardModule(sourceId: DashboardModuleId, targetId: DashboardModuleId, insertAfter: boolean): Promise<void> {
    const order = this.dashboardModuleOrder.filter((id) => id !== sourceId);
    const targetIndex = order.indexOf(targetId);
    if (targetIndex < 0) return;
    order.splice(targetIndex + (insertAfter ? 1 : 0), 0, sourceId);
    this.dashboardModuleOrder = normalizeDashboardModuleOrder(order);
    await this.persistDashboardState();
    await this.render();
  }

  private renderDashboardModuleResizeHandle(section: HTMLElement, moduleId: DashboardModuleId): void {
    const handle = section.createDiv({ cls: "fishbone-dashboard-module-resize-handle" });
    handle.setAttr("title", "长按后上下拖动调整模块高度");
    handle.draggable = false;
    handle.addEventListener("dragstart", (event) => event.preventDefault());
    this.bindDashboardModuleResize(handle, section, moduleId);
  }

  private bindDashboardModuleResize(handle: HTMLElement, section: HTMLElement, moduleId: DashboardModuleId): void {
    const clearTimer = () => {
      const drag = this.dashboardModuleResizeDrag;
      if (drag?.timer !== null && drag?.timer !== undefined) {
        window.clearTimeout(drag.timer);
        drag.timer = null;
      }
    };
    const finish = async (event: PointerEvent) => {
      const drag = this.dashboardModuleResizeDrag;
      if (!drag || drag.pointerId !== event.pointerId) return;
      clearTimer();
      const shouldSave = drag.active;
      drag.section.removeClass("is-dashboard-module-resizing");
      this.dashboardModuleResizeDrag = null;
      if (shouldSave) await this.persistDashboardState();
    };

    handle.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      handle.setPointerCapture(event.pointerId);
      clearTimer();
      const startHeight = this.dashboardModuleHeights[moduleId];
      this.dashboardModuleResizeDrag = {
        moduleId,
        pointerId: event.pointerId,
        timer: null,
        active: false,
        startY: event.clientY,
        startHeight,
        section
      };
      const timer = window.setTimeout(() => {
        const drag = this.dashboardModuleResizeDrag;
        if (!drag || drag.pointerId !== event.pointerId) return;
        drag.active = true;
        drag.timer = null;
        section.addClass("is-dashboard-module-resizing");
      }, 220);
      this.dashboardModuleResizeDrag.timer = timer;
    });

    handle.addEventListener("pointermove", (event) => {
      const drag = this.dashboardModuleResizeDrag;
      if (!drag || drag.pointerId !== event.pointerId || !drag.active) return;
      event.preventDefault();
      event.stopPropagation();
      const nextHeight = normalizeDashboardModuleHeight(drag.startHeight + event.clientY - drag.startY);
      this.dashboardModuleHeights[drag.moduleId] = nextHeight;
      drag.section.style.height = `${nextHeight}px`;
    });

    handle.addEventListener("pointerup", (event) => {
      void finish(event);
    });
    handle.addEventListener("pointercancel", (event) => {
      void finish(event);
    });
  }

  private async updateDashboardTaskDone(task: PlanningTask, done: boolean): Promise<void> {
    await this.plugin.taskRepository.setTaskDone(task, done);
    await this.render();
  }

  private async updateDashboardTaskStatus(task: PlanningTask, status: TaskStatus): Promise<void> {
    await this.plugin.taskRepository.setTaskStatus(task, status);
    await this.render();
  }

  private bindDashboardResize(resizer: HTMLElement, panel: HTMLElement): void {
    resizer.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      resizer.setPointerCapture(event.pointerId);
      this.dashboardResizeDrag = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startWidth: this.dashboardWidth,
        panel
      };
      panel.addClass("is-resizing");
    });
    resizer.addEventListener("pointermove", (event) => {
      const drag = this.dashboardResizeDrag;
      if (!drag || drag.pointerId !== event.pointerId) return;
      event.preventDefault();
      const nextWidth = normalizeDashboardWidth(drag.startWidth - (event.clientX - drag.startX));
      this.dashboardWidth = nextWidth;
      drag.panel.style.width = `${nextWidth}px`;
    });
    const finish = async (event: PointerEvent) => {
      const drag = this.dashboardResizeDrag;
      if (!drag || drag.pointerId !== event.pointerId) return;
      this.dashboardResizeDrag = null;
      drag.panel.removeClass("is-resizing");
      await this.persistDashboardState();
    };
    resizer.addEventListener("pointerup", (event) => {
      void finish(event);
    });
    resizer.addEventListener("pointercancel", (event) => {
      void finish(event);
    });
  }

  private renderWorkbenchPanel(parent: HTMLElement, summary: DashboardSummary, mainlines: Mainline[]): void {
    const panel = parent.createDiv({ cls: "fishbone-workbench-panel" });
    panel.style.height = `${this.workbenchHeight}px`;
    const resizer = panel.createDiv({ cls: "fishbone-workbench-resizer" });
    this.bindWorkbenchResize(resizer, panel);

    const header = panel.createDiv({ cls: "fishbone-workbench-header" });
    header.createDiv({ cls: "fishbone-workbench-title", text: "状态工作台" });
    header.createDiv({ cls: "fishbone-workbench-subtitle", text: "待办、进行中、已完成与鱼骨任务状态同步" });

    const columns = panel.createDiv({ cls: "fishbone-workbench-columns" });
    columns.addEventListener("dragover", (event) => {
      if (this.getDraggedWorkbenchTaskId(event)) {
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
      }
    });
    const mainlineVisuals = new Map(mainlines
      .filter((mainline) => mainline.type !== "branch")
      .map((mainline) => [mainline.name, { color: mainline.color, icon: mainline.icon }]));
    for (const columnId of this.workbenchColumnOrder) {
      this.renderWorkbenchColumn(columns, columnId, getWorkbenchColumnTasks(summary, columnId), mainlineVisuals);
    }
  }

  private renderQuickInput(parent: HTMLElement, summary: DashboardSummary, mainlines: Mainline[]): void {
    const wrapper = parent.createDiv({ cls: "fishbone-quick-input" });
    const form = wrapper.createEl("form", { cls: "fishbone-quick-input-form" });
    const input = form.createEl("input", {
      type: "text",
      cls: "fishbone-quick-input-field",
      placeholder: "输入一句自然语言，生成候选任务..."
    });
    form.createEl("button", { text: "预览" });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      this.quickInputCandidate = buildQuickInputCandidateV2(text, summary, mainlines);
      if (this.quickInputCandidate.hasMultipleCandidates) {
        new Notice("检测到多条输入，M6.6 暂按一条候选处理，批量创建会在后续阶段补充。");
      }
      void this.render();
    });

    if (!this.quickInputCandidate) return;
    const candidate = this.quickInputCandidate;
    const preview = wrapper.createDiv({ cls: "fishbone-quick-input-preview" });
    const top = preview.createDiv({ cls: "fishbone-quick-input-preview-top" });
    top.createSpan({ text: "候选任务" });
    const closeButton = top.createEl("button", { text: "×" });
    closeButton.setAttr("title", "关闭候选预览");
    closeButton.addEventListener("click", (event) => {
      event.preventDefault();
      this.quickInputCandidate = null;
      void this.render();
    });
    preview.createDiv({ cls: "fishbone-quick-input-title", text: candidate.title });
    const meta = preview.createDiv({ cls: "fishbone-quick-input-meta" });
    meta.createSpan({ text: candidate.date ?? "未定日期" });
    meta.createSpan({ text: candidate.mainline ?? "未分配" });
    meta.createSpan({ text: formatPriority(candidate.priority) });
    meta.createSpan({ text: candidate.status });
    for (const warning of candidate.warnings) {
      preview.createDiv({ cls: "fishbone-quick-input-warning", text: warning });
    }
    const actions = preview.createDiv({ cls: "fishbone-quick-input-actions" });
    const confirm = actions.createEl("button", { text: "确认写入" });
    confirm.addEventListener("click", async (event) => {
      event.preventDefault();
      await this.plugin.taskRepository.createTask({
        title: candidate.title,
        date: candidate.date,
        mainline: candidate.mainline,
        status: candidate.status,
        priority: candidate.priority,
        sourceType: "quick-input",
        sourceExcerpt: candidate.text
      });
      this.quickInputCandidate = null;
      new Notice("已通过快速输入创建任务");
      await this.render();
    });

    const edit = actions.createEl("button", { text: "编辑后创建" });
    edit.addEventListener("click", (event) => {
      event.preventDefault();
      new NewTaskModal(this.plugin, mainlines, async (input) => {
        await this.plugin.taskRepository.createTask(input);
        this.quickInputCandidate = null;
        new Notice(`已创建任务：${input.title}`);
        await this.render();
      }, {
        title: candidate.title,
        date: candidate.date,
        mainline: candidate.mainline,
        status: candidate.status,
        priority: candidate.priority,
        sourceType: "quick-input",
        sourceExcerpt: candidate.text
      }).open();
    });
  }

  private renderWorkbenchColumn(
    parent: HTMLElement,
    columnId: WorkbenchColumnId,
    tasks: PlanningTask[],
    mainlineVisuals: Map<string, { color: string; icon: string }>
  ): void {
    const meta = WORKBENCH_COLUMN_META[columnId];
    const column = parent.createDiv({ cls: `fishbone-workbench-column fishbone-workbench-column-${columnId}` });
    column.setAttr("data-workbench-column-id", columnId);
    const header = column.createDiv({ cls: "fishbone-workbench-column-header" });
    header.setAttr("title", "拖动列标题可调整下方工作台顺序");
    header.createSpan({ cls: "fishbone-workbench-drag-handle", text: "⋮⋮" });
    header.createSpan({ text: meta.title });
    header.createSpan({ cls: "fishbone-workbench-count", text: String(tasks.length) });
    this.bindWorkbenchColumnDrag(column, header, columnId);

    const list = column.createDiv({ cls: "fishbone-workbench-task-list" });
    if (tasks.length === 0) {
      list.createDiv({ cls: "fishbone-dashboard-empty", text: meta.emptyText });
      return;
    }
    for (const task of tasks) {
      this.renderWorkbenchTask(list, task, mainlineVisuals);
    }
  }

  private renderWorkbenchTask(parent: HTMLElement, task: PlanningTask, mainlineVisuals: Map<string, { color: string; icon: string }>): void {
    const row = parent.createDiv({ cls: `fishbone-workbench-task fishbone-task-${task.status}` });
    row.draggable = true;
    row.setAttr("data-task-id", task.taskId);
    row.setAttr("title", `${task.title}\n${task.date ?? "无日期"} · ${task.mainline ?? "未分配"}`);
    const mainlineVisual = task.mainline ? mainlineVisuals.get(task.mainline) : undefined;
    row.style.setProperty("--mainline-color", mainlineVisual?.color ?? "#94a3b8");
    row.addEventListener("click", () => {
      void this.plugin.taskRepository.openTask(task);
    });
    row.addEventListener("dragstart", (event) => {
      event.stopPropagation();
      this.draggedWorkbenchTaskId = task.taskId;
      if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
      event.dataTransfer?.setData("text/fishbone-workbench-task-id", task.taskId);
      event.dataTransfer?.setData("text/plain", task.taskId);
      event.dataTransfer?.setDragImage(row, 16, 12);
      row.addClass("is-workbench-task-dragging");
    });
    row.addEventListener("dragend", () => {
      this.draggedWorkbenchTaskId = null;
      row.removeClass("is-workbench-task-dragging");
      this.containerEl.querySelectorAll<HTMLElement>(".is-workbench-drop-target").forEach((target) => {
        target.removeClass("is-workbench-drop-target");
      });
    });

    const checkbox = row.createEl("input", { type: "checkbox", cls: "fishbone-dashboard-task-checkbox" });
    checkbox.checked = task.status === "done";
    checkbox.addEventListener("click", (event) => event.stopPropagation());
    checkbox.addEventListener("change", (event) => {
      event.stopPropagation();
      void this.updateDashboardTaskDone(task, checkbox.checked);
    });
    const icon = row.createDiv({ cls: "fishbone-workbench-task-icon" });
    setIcon(icon, mainlineVisual?.icon || "circle");
    const body = row.createDiv({ cls: "fishbone-workbench-task-body" });
    body.createDiv({ cls: "fishbone-workbench-task-title", text: task.title });
    const meta = body.createDiv({ cls: "fishbone-workbench-task-meta" });
    meta.createSpan({ text: task.date ?? "无日期" });
    meta.createSpan({ cls: `fishbone-dashboard-priority is-${task.priority}`, text: formatPriority(task.priority) });
    if (task.status === "blocked") {
      meta.createSpan({ cls: "fishbone-dashboard-reason is-blocked", text: "阻塞" });
    }
    row.createSpan({ cls: "fishbone-workbench-mainline-tag", text: task.mainline ?? "未分配" });
  }

  private bindWorkbenchColumnDrag(column: HTMLElement, header: HTMLElement, columnId: WorkbenchColumnId): void {
    header.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || (event.target as HTMLElement).closest("button, select, input")) return;
      event.preventDefault();
      event.stopPropagation();
      header.setPointerCapture(event.pointerId);
      this.workbenchColumnSortDrag = {
        columnId,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        active: false,
        source: column,
        targetId: null,
        insertAfter: false
      };
    });
    header.addEventListener("pointermove", (event) => {
      const drag = this.workbenchColumnSortDrag;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
      if (!drag.active && distance < 4) return;
      event.preventDefault();
      event.stopPropagation();
      drag.active = true;
      drag.source.addClass("is-workbench-column-dragging");
      this.updateWorkbenchColumnSortTarget(event.clientX);
    });
    const finishSort = async (event: PointerEvent) => {
      const drag = this.workbenchColumnSortDrag;
      if (!drag || drag.pointerId !== event.pointerId) return;
      this.clearWorkbenchColumnSortFeedback();
      this.workbenchColumnSortDrag = null;
      if (drag.active && drag.targetId && drag.targetId !== drag.columnId) {
        await this.moveWorkbenchColumn(drag.columnId, drag.targetId, drag.insertAfter);
      }
    };
    header.addEventListener("pointerup", (event) => {
      void finishSort(event);
    });
    header.addEventListener("pointercancel", (event) => {
      void finishSort(event);
    });
    column.addEventListener("dragover", (event) => {
      if (this.getDraggedWorkbenchTaskId(event)) {
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
        column.addClass("is-workbench-drop-target");
      }
    });
    column.addEventListener("dragleave", () => {
      column.removeClass("is-workbench-drop-target");
    });
    column.addEventListener("drop", (event) => {
      event.preventDefault();
      column.removeClass("is-workbench-drop-target");
      const taskId = this.getDraggedWorkbenchTaskId(event);
      if (taskId) {
        void this.moveWorkbenchTaskToColumn(taskId, columnId);
      }
    });
  }

  private getDraggedWorkbenchTaskId(event: DragEvent): string | null {
    const value = event.dataTransfer?.getData("text/fishbone-workbench-task-id") ?? "";
    return value.length > 0 ? value : this.draggedWorkbenchTaskId;
  }

  private updateWorkbenchColumnSortTarget(clientX: number): void {
    const drag = this.workbenchColumnSortDrag;
    if (!drag) return;
    let nextTargetId: WorkbenchColumnId | null = null;
    let nextInsertAfter = false;
    this.containerEl.querySelectorAll<HTMLElement>(".fishbone-workbench-column[data-workbench-column-id]").forEach((column) => {
      const id = column.getAttr("data-workbench-column-id") ?? "";
      if (!isWorkbenchColumnId(id) || id === drag.columnId) return;
      const rect = column.getBoundingClientRect();
      if (clientX >= rect.left && clientX <= rect.right) {
        nextTargetId = id;
        nextInsertAfter = clientX > rect.left + rect.width / 2;
      }
    });
    drag.targetId = nextTargetId;
    drag.insertAfter = nextInsertAfter;
    this.clearWorkbenchColumnSortFeedback();
    drag.source.addClass("is-workbench-column-dragging");
    if (!nextTargetId) return;
    const target = this.containerEl.querySelector<HTMLElement>(`.fishbone-workbench-column[data-workbench-column-id="${nextTargetId}"]`);
    target?.addClass(nextInsertAfter ? "is-workbench-column-drop-after" : "is-workbench-column-drop-before");
  }

  private clearWorkbenchColumnSortFeedback(): void {
    this.containerEl.querySelectorAll<HTMLElement>(".is-workbench-column-dragging, .is-workbench-column-drop-before, .is-workbench-column-drop-after").forEach((target) => {
      target.removeClass("is-workbench-column-dragging");
      target.removeClass("is-workbench-column-drop-before");
      target.removeClass("is-workbench-column-drop-after");
    });
  }

  private async moveWorkbenchColumn(sourceId: WorkbenchColumnId, targetId: WorkbenchColumnId, insertAfter: boolean): Promise<void> {
    const order = this.workbenchColumnOrder.filter((id) => id !== sourceId);
    const targetIndex = order.indexOf(targetId);
    if (targetIndex < 0) return;
    order.splice(targetIndex + (insertAfter ? 1 : 0), 0, sourceId);
    this.workbenchColumnOrder = normalizeWorkbenchColumnOrder(order);
    await this.persistDashboardState();
    await this.render();
  }

  private async moveWorkbenchTaskToColumn(taskId: string, columnId: WorkbenchColumnId): Promise<void> {
    const task = (await this.plugin.taskRepository.listTasks()).find((item) => item.taskId === taskId);
    if (!task) {
      new Notice("找不到要移动的任务");
      return;
    }
    const status = WORKBENCH_COLUMN_META[columnId].targetStatus;
    if (task.status === status) return;
    await this.plugin.taskRepository.setTaskStatus(task, status);
    await this.render();
  }

  private bindWorkbenchResize(handle: HTMLElement, panel: HTMLElement): void {
    const clearTimer = () => {
      const drag = this.workbenchResizeDrag;
      if (drag?.timer !== null && drag?.timer !== undefined) {
        window.clearTimeout(drag.timer);
        drag.timer = null;
      }
    };
    const finish = async (event: PointerEvent) => {
      const drag = this.workbenchResizeDrag;
      if (!drag || drag.pointerId !== event.pointerId) return;
      clearTimer();
      const shouldSave = drag.active;
      drag.panel.removeClass("is-workbench-resizing");
      this.workbenchResizeDrag = null;
      if (shouldSave) await this.persistDashboardState();
    };

    handle.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      handle.setPointerCapture(event.pointerId);
      clearTimer();
      this.workbenchResizeDrag = {
        pointerId: event.pointerId,
        timer: null,
        active: false,
        startY: event.clientY,
        startHeight: this.workbenchHeight,
        panel
      };
      const timer = window.setTimeout(() => {
        const drag = this.workbenchResizeDrag;
        if (!drag || drag.pointerId !== event.pointerId) return;
        drag.active = true;
        drag.timer = null;
        panel.addClass("is-workbench-resizing");
      }, 220);
      this.workbenchResizeDrag.timer = timer;
    });

    handle.addEventListener("pointermove", (event) => {
      const drag = this.workbenchResizeDrag;
      if (!drag || drag.pointerId !== event.pointerId || !drag.active) return;
      event.preventDefault();
      event.stopPropagation();
      const nextHeight = normalizeWorkbenchHeight(drag.startHeight - (event.clientY - drag.startY));
      this.workbenchHeight = nextHeight;
      drag.panel.style.height = `${nextHeight}px`;
    });
    handle.addEventListener("pointerup", (event) => {
      void finish(event);
    });
    handle.addEventListener("pointercancel", (event) => {
      void finish(event);
    });
  }

  private renderCanvas(container: Element, layout: FishboneCanvasLayout, mainlines: Mainline[], tasks: PlanningTask[]): void {
    const canvas = container.createDiv({ cls: "fishbone-canvas-viewport" });
    canvas.tabIndex = 0;
    canvas.setAttr("data-time-axis-mode", this.viewport.timeAxisMode);
    this.bindCanvasViewport(canvas, layout, mainlines, tasks);
    this.bindCanvasKeyboard(canvas, tasks, mainlines);

    const dateLayer = canvas.createDiv({ cls: "fishbone-fixed-date-axis-layer" });
    this.renderFixedDateAxis(dateLayer, layout);

    const stage = canvas.createDiv({ cls: "fishbone-canvas-stage" });
    stage.style.width = `${layout.stageWidth}px`;
    stage.style.height = `${layout.stageHeight}px`;
    this.applyStageTransform(stage);

    const laneLayer = stage.createDiv({ cls: "fishbone-mainline-layer" });
    for (const lane of layout.lanes) {
      try {
        this.renderCanvasLane(laneLayer, lane, mainlines);
      } catch (error) {
        console.error("Fishbone Planner: failed to render lane", lane, error);
      }
    }

    const branchMainlineLayer = stage.createDiv({ cls: "fishbone-branch-mainline-layer" });
    for (const branch of layout.branchMainlines) {
      try {
        this.renderCanvasBranchMainline(branchMainlineLayer, branch, mainlines, tasks);
      } catch (error) {
        console.error("Fishbone Planner: failed to render branch mainline", branch.id, error);
      }
    }

    const taskBranchLayer = stage.createDiv({ cls: "fishbone-task-branch-layer" });
    for (const taskNode of layout.tasks) {
      try {
        this.renderTaskBranchLine(taskBranchLayer, taskNode);
      } catch (error) {
        console.error("Fishbone Planner: failed to render task branch", taskNode.task.taskId, error);
      }
    }

    const taskLayer = stage.createDiv({ cls: "fishbone-task-layer" });
    for (const taskNode of layout.tasks) {
      try {
        this.renderCanvasTaskNode(taskLayer, taskNode, mainlines, layout);
      } catch (error) {
        console.error("Fishbone Planner: failed to render task", taskNode.task.taskId, error);
      }
    }
    for (const cluster of layout.clusters) {
      try {
        this.renderTaskCluster(taskLayer, cluster);
      } catch (error) {
        console.error("Fishbone Planner: failed to render cluster", cluster.id, error);
      }
    }

    const branchMainlineLabelLayer = stage.createDiv({ cls: "fishbone-branch-mainline-label-layer" });
    for (const branch of layout.branchMainlines) {
      try {
        this.renderCanvasBranchMainlineLabel(branchMainlineLabelLayer, branch, mainlines, tasks);
      } catch (error) {
        console.error("Fishbone Planner: failed to render branch mainline label", branch.id, error);
      }
    }

    const labelLayer = canvas.createDiv({ cls: "fishbone-canvas-label-layer" });
    for (const lane of layout.lanes) {
      try {
        this.renderCanvasLaneLabel(labelLayer, lane, mainlines, layout);
      } catch (error) {
        console.error("Fishbone Planner: failed to render lane label", lane.id, error);
      }
    }
    try {
      this.renderRelationLayer(stage, layout.relationLines);
    } catch (error) {
      console.error("Fishbone Planner: failed to render relation layer", error);
      this.renderInlineError(container, error);
    }
    canvas.createDiv({ cls: "fishbone-task-drop-hint" });
    this.applyCanvasTransform(canvas);
  }

  private renderFixedDateAxis(parent: HTMLElement, layout: FishboneCanvasLayout): void {
    for (const tick of layout.dateTicks) {
      const tickEl = parent.createDiv({
        cls: [
          "fishbone-date-tick",
          tick.isToday ? "is-today" : "",
          tick.isWeekend ? "is-weekend" : "",
          tick.isMajor ? "is-major" : "",
          tick.id === this.viewport.centerDate ? "is-center-date" : ""
        ].filter(Boolean).join(" ")
      });
      tickEl.dataset.dateX = String(tick.x);
      tickEl.style.left = `${this.viewport.panX + tick.x * this.viewport.canvasZoom}px`;
      tickEl.createDiv({ cls: "fishbone-date-label", text: tick.label });
      tickEl.createDiv({ cls: "fishbone-date-detail", text: tick.detail });
    }
  }

  private renderTaskBranchLine(parent: HTMLElement, taskNode: FishboneCanvasTaskNode): void {
    const nodeEdgeY = taskNode.branchSide === "above"
      ? taskNode.y + taskNode.height / 2
      : taskNode.y - taskNode.height / 2;
    const top = Math.min(taskNode.spineAnchor.y, nodeEdgeY);
    const height = Math.max(6, Math.abs(taskNode.spineAnchor.y - nodeEdgeY));
    const line = parent.createDiv({
      cls: [
        "fishbone-task-branch-line",
        `fishbone-branch-${taskNode.branchSide}`
      ].join(" ")
    });
    line.style.setProperty("--lane-color", taskNode.color);
    line.style.left = `${taskNode.x}px`;
    line.style.top = `${top}px`;
    line.style.height = `${height}px`;
  }

  private renderCanvasBranchMainline(parent: HTMLElement, branch: FishboneCanvasBranchMainline, mainlines: Mainline[], tasks: PlanningTask[]): void {
    const branchMainline = mainlines.find((mainline) => mainline.id === branch.id);
    const connectorBounds = this.getBranchConnectorBounds(branch);
    const connector = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    connector.addClass("fishbone-branch-mainline-connector");
    connector.addClass(`fishbone-branch-${branch.side}`);
    connector.style.setProperty("--lane-color", branch.color);
    connector.setAttribute("data-branch-mainline-id", branch.id);
    connector.style.left = `${connectorBounds.left}px`;
    connector.style.top = `${connectorBounds.top}px`;
    connector.style.width = `${connectorBounds.width}px`;
    connector.style.height = `${connectorBounds.height}px`;
    connector.setAttribute("viewBox", `0 0 ${connectorBounds.width} ${connectorBounds.height}`);
    const connectorPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    connectorPath.addClass("fishbone-branch-mainline-connector-path");
    connectorPath.setAttribute("d", this.getBranchConnectorPath(branch, connectorBounds.left, connectorBounds.top));
    connector.appendChild(connectorPath);
    parent.appendChild(connector);

    const spine = parent.createDiv({
      cls: [
        "fishbone-branch-mainline",
        `fishbone-branch-${branch.side}`,
        branch.isCollapsed ? "is-collapsed" : ""
      ].filter(Boolean).join(" ")
    });
    spine.style.setProperty("--lane-color", branch.color);
    spine.style.left = `${branch.xStart}px`;
    spine.style.top = `${branch.y}px`;
    spine.style.width = `${Math.max(80, branch.xEnd - branch.xStart)}px`;
    spine.setAttr("data-branch-mainline-id", branch.id);
    spine.setAttr("title", `${branch.name}\n${branch.startDate} - ${branch.endDate}`);

    if (branchMainline) {
      spine.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (this.suppressNextBranchClick) return;
        this.openEditBranchMainlineModal(branchMainline, mainlines);
      });
      this.bindBranchMainlineContextMenu(spine, branchMainline, mainlines, tasks);
      this.bindBranchMainlineDrag(spine, branch);
      this.bindBranchVisualActivation(spine, branch.id);
    }
  }

  private renderCanvasBranchMainlineLabel(parent: HTMLElement, branch: FishboneCanvasBranchMainline, mainlines: Mainline[], tasks: PlanningTask[]): void {
    const branchMainline = mainlines.find((mainline) => mainline.id === branch.id);
    const label = parent.createDiv({
      cls: [
        "fishbone-branch-mainline-label",
        "fishbone-branch-mainline-floating-label",
        `fishbone-branch-${branch.side}`,
        branch.isCollapsed ? "is-collapsed" : ""
      ].filter(Boolean).join(" ")
    });
    label.style.setProperty("--lane-color", branch.color);
    label.style.left = `${branch.xStart + 8}px`;
    label.style.top = `${branch.y - 24}px`;
    label.setAttr("data-branch-mainline-id", branch.id);
    label.setAttr("title", `${branch.name}\n${branch.startDate} - ${branch.endDate}`);
    label.createSpan({ cls: "fishbone-branch-mainline-name", text: branch.name });
    if (branchMainline) {
      label.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (this.suppressNextBranchClick) return;
        this.openEditBranchMainlineModal(branchMainline, mainlines);
      });
      this.bindBranchMainlineContextMenu(label, branchMainline, mainlines, tasks);
      this.bindBranchMainlineDrag(label, branch);
      this.bindBranchVisualActivation(label, branch.id);
    }
  }

  private bindBranchVisualActivation(node: HTMLElement, branchId: string): void {
    node.addEventListener("mouseenter", () => this.setBranchVisualActive(branchId, true));
    node.addEventListener("mouseleave", () => {
      if (this.branchPointerDrag?.branch.id === branchId && this.branchPointerDrag.active) return;
      this.setBranchVisualActive(branchId, false);
    });
  }

  private setBranchVisualActive(branchId: string, active: boolean): void {
    this.containerEl.querySelectorAll<HTMLElement | SVGElement>("[data-branch-mainline-id]").forEach((element) => {
      if (element.getAttribute("data-branch-mainline-id") === branchId) {
        element.classList.toggle("is-branch-active", active);
      }
    });
  }

  private getBranchConnectorBounds(branch: FishboneCanvasBranchMainline): { left: number; top: number; width: number; height: number } {
    const left = branch.xStart - 84;
    const right = branch.xEnd + 16;
    const top = Math.min(branch.parentY, branch.y) - 30;
    const bottom = Math.max(branch.parentY, branch.y) + 30;
    return {
      left,
      top,
      width: Math.max(96, right - left),
      height: Math.max(64, bottom - top)
    };
  }

  private getBranchConnectorPath(branch: FishboneCanvasBranchMainline, left: number, top: number): string {
    const startX = branch.xStart - left;
    const startY = branch.parentY - top;
    const endX = branch.xStart - left;
    const endY = branch.y - top;
    const bendX = startX - 36;
    const tailX = branch.xEnd - left;
    return `M ${startX} ${startY} C ${bendX} ${startY}, ${bendX} ${endY}, ${endX} ${endY} L ${tailX} ${endY}`;
  }

  private renderRelationLayer(stage: HTMLElement, relationLines: FishboneCanvasRelationLine[]): void {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.addClass("fishbone-relation-layer");
    if (!this.showRelations) {
      svg.addClass("is-hidden");
    }
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    svg.setAttribute("viewBox", `0 0 ${stage.style.width.replace("px", "")} ${stage.style.height.replace("px", "")}`);

    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    const marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
    marker.setAttribute("id", "fishbone-relation-arrow");
    marker.setAttribute("markerWidth", "8");
    marker.setAttribute("markerHeight", "8");
    marker.setAttribute("refX", "7");
    marker.setAttribute("refY", "4");
    marker.setAttribute("orient", "auto");
    marker.setAttribute("markerUnits", "strokeWidth");
    const arrow = document.createElementNS("http://www.w3.org/2000/svg", "path");
    arrow.setAttribute("d", "M 0 0 L 8 4 L 0 8 z");
    arrow.addClass("fishbone-relation-arrow");
    marker.appendChild(arrow);
    defs.appendChild(marker);
    svg.appendChild(defs);

    for (const line of relationLines) {
      const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
      group.addClass("fishbone-relation");
      group.addClass(line.className);
      group.setAttribute("data-relation-id", line.id);
      group.setAttribute("data-source-task-id", line.sourceTaskId);
      group.setAttribute("data-target-task-id", line.targetTaskId);
      const relationPath = `M ${line.start.x} ${line.start.y} C ${line.control1.x} ${line.control1.y}, ${line.control2.x} ${line.control2.y}, ${line.end.x} ${line.end.y}`;

      const hitArea = document.createElementNS("http://www.w3.org/2000/svg", "path");
      hitArea.addClass("fishbone-relation-hit-area");
      hitArea.setAttribute("d", relationPath);
      group.appendChild(hitArea);

      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.addClass("fishbone-relation-path");
      path.setAttribute("d", relationPath);
      path.setAttribute("stroke", line.color);
      if (line.dashed) {
        path.setAttribute("stroke-dasharray", "8 7");
      }
      if (line.arrow === "target" || line.arrow === "both") {
        path.setAttribute("marker-end", "url(#fishbone-relation-arrow)");
      }
      if (line.arrow === "source" || line.arrow === "both") {
        path.setAttribute("marker-start", "url(#fishbone-relation-arrow)");
      }
      group.appendChild(path);

      const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
      label.addClass("fishbone-relation-label");
      label.setAttribute("x", String(line.labelAnchor.x));
      label.setAttribute("y", String(line.labelAnchor.y));
      label.setAttribute("text-anchor", "middle");
      label.textContent = line.label;
      group.appendChild(label);

      group.addEventListener("mouseenter", () => {
        this.highlightTaskRelations(stage, line.sourceTaskId, line.targetTaskId);
      });
      group.addEventListener("mouseleave", () => {
        this.clearRelationHighlights(stage);
      });
      group.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const menu = new Menu();
        menu.addItem((item) => {
          item.setTitle(`关系：${line.label}`).setIcon("git-branch");
        });
        menu.addItem((item) => {
          item.setTitle(`来源：${line.source.task.title}`).onClick(() => {
            void this.plugin.taskRepository.openTask(line.source.task);
          });
        });
        menu.addItem((item) => {
          item.setTitle(`目标：${line.target.task.title}`).onClick(() => {
            void this.plugin.taskRepository.openTask(line.target.task);
          });
        });
        menu.showAtMouseEvent(event);
      });

      svg.appendChild(group);
    }
    stage.appendChild(svg);
  }

  private updateRelationLayerVisibility(): void {
    const relationLayer = this.containerEl.querySelector(".fishbone-relation-layer");
    relationLayer?.classList.toggle("is-hidden", !this.showRelations);
  }

  private bindCanvasViewport(canvas: HTMLElement, layout: FishboneCanvasLayout, mainlines: Mainline[], tasks: PlanningTask[]): void {
    canvas.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || isInteractiveTarget(event.target)) return;
      canvas.setPointerCapture(event.pointerId);
      this.panDrag = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY
      };
      canvas.addClass("is-panning");
      canvas.focus();
    });

    canvas.addEventListener("pointermove", (event) => {
      if (!this.panDrag || this.panDrag.pointerId !== event.pointerId) return;
      const deltaX = event.clientX - this.panDrag.x;
      const deltaY = event.clientY - this.panDrag.y;
      this.panDrag = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY
      };
      this.viewport = panCanvasViewport(this.viewport, deltaX, deltaY);
      this.applyCanvasTransform(canvas);
    });

    const endPan = (event: PointerEvent) => {
      if (this.panDrag?.pointerId === event.pointerId) {
        this.panDrag = null;
        canvas.removeClass("is-panning");
        void this.persistViewState();
      }
    };
    canvas.addEventListener("pointerup", endPan);
    canvas.addEventListener("pointercancel", endPan);

    canvas.addEventListener("wheel", async (event) => {
      event.preventDefault();
      const lane = (event.target as HTMLElement | null)?.closest(".fishbone-canvas-lane, .fishbone-task-node, .fishbone-canvas-lane-label") as HTMLElement | null;
      if (event.ctrlKey && lane?.dataset.laneId) {
        this.viewport = zoomLane(this.viewport, lane.dataset.laneId, event.deltaY);
        await this.persistViewState();
        await this.render();
      } else {
        const rect = canvas.getBoundingClientRect();
        this.viewport = zoomCanvasViewport(this.viewport, event.deltaY, {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top
        });
        this.applyCanvasTransform(canvas);
        this.updateViewportReadouts();
        this.queuePersistViewState();
      }
    }, { passive: false });

    canvas.addEventListener("dragover", (event) => {
      const hasMainlineDrag = Array.from(event.dataTransfer?.types ?? []).includes("text/fishbone-mainline-id");
      if (!hasMainlineDrag) return;
      event.preventDefault();
      canvas.addClass("is-mainline-drag-over");
    });

    canvas.addEventListener("dragleave", (event) => {
      if (event.currentTarget === event.target) {
        canvas.removeClass("is-mainline-drag-over");
      }
    });

    canvas.addEventListener("drop", async (event) => {
      const sourceId = event.dataTransfer?.getData("text/fishbone-mainline-id");
      if (!sourceId) return;
      event.preventDefault();
      canvas.removeClass("is-mainline-drag-over");
      await this.moveMainlineByCanvasDrop(canvas, layout, mainlines, sourceId, event);
    });
  }

  private bindCanvasKeyboard(canvas: HTMLElement, tasks: PlanningTask[], mainlines: Mainline[]): void {
    canvas.addEventListener("keydown", async (event) => {
      if (isFormTarget(event.target)) return;
      const dateRange = getDateRangeFromValues([
        ...tasks.map((task) => task.date),
        ...mainlines.flatMap((mainline) => mainline.type === "branch" ? [mainline.startDate, mainline.endDate] : [])
      ]);
      if (event.key === "t" || event.key === "T") {
        event.preventDefault();
        this.viewport = setViewportCenterDate(this.viewport, getLocalDateString(new Date()));
      } else if (event.key === "0") {
        event.preventDefault();
        this.viewport = resetCanvasViewport(this.viewport);
      } else if (event.key === "f" || event.key === "F") {
        event.preventDefault();
        this.viewport = fitCanvasViewportToDateRange(this.viewport, dateRange, canvas.clientWidth);
      } else if (event.key === "r" || event.key === "R") {
        event.preventDefault();
        this.showRelations = !this.showRelations;
      } else if (["1", "2", "3", "4"].includes(event.key)) {
        event.preventDefault();
        const mode = TIME_AXIS_MODES[Number(event.key) - 1]?.id;
        if (mode) this.viewport = setTimeAxisMode(this.viewport, mode);
      } else {
        return;
      }
      await this.persistViewState();
      await this.render();
    });
  }

  private applyStageTransform(stage: HTMLElement): void {
    stage.style.transform = `translate(${this.viewport.panX}px, ${this.viewport.panY}px) scale(${this.viewport.canvasZoom})`;
  }

  private applyCanvasTransform(canvas: HTMLElement): void {
    const stage = canvas.querySelector(".fishbone-canvas-stage") as HTMLElement | null;
    if (stage) this.applyStageTransform(stage);

    this.updateFixedDateAxis(canvas);

    const labels = canvas.querySelectorAll<HTMLElement>(".fishbone-canvas-lane-label");
    labels.forEach((label) => {
      const spineY = Number(label.dataset.laneSpineY ?? 0);
      label.style.top = `${this.viewport.panY + spineY * this.viewport.canvasZoom}px`;
    });
  }

  private updateFixedDateAxis(canvas: HTMLElement): void {
    const viewportWidth = canvas.clientWidth;
    const viewportCenter = viewportWidth / 2;
    const labelGap = this.getFixedDateAxisLabelGap();
    const positionedTicks = Array.from(canvas.querySelectorAll<HTMLElement>(".fishbone-fixed-date-axis-layer .fishbone-date-tick")).map((tick) => {
      const x = Number(tick.dataset.dateX ?? 0);
      const screenX = this.viewport.panX + x * this.viewport.canvasZoom;
      tick.style.left = `${screenX}px`;
      return {
        tick,
        screenX,
        priority: this.getDateTickLabelPriority(tick),
        distanceFromCenter: Math.abs(screenX - viewportCenter),
        isVisibleInViewport: screenX >= -labelGap && screenX <= viewportWidth + labelGap
      };
    });

    const visibleTicks = positionedTicks
      .filter((item) => item.isVisibleInViewport)
      .sort((a, b) => b.priority - a.priority || a.distanceFromCenter - b.distanceFromCenter);
    const shownTicks = new Set<HTMLElement>();
    const occupiedPositions: number[] = [];
    for (const item of visibleTicks) {
      if (occupiedPositions.every((screenX) => Math.abs(screenX - item.screenX) >= labelGap)) {
        shownTicks.add(item.tick);
        occupiedPositions.push(item.screenX);
      }
    }

    positionedTicks.forEach((item) => {
      item.tick.classList.toggle("is-axis-label-hidden", !shownTicks.has(item.tick));
    });
  }

  private getFixedDateAxisLabelGap(): number {
    if (this.viewport.timeAxisMode === "overview") return 124;
    if (this.viewport.timeAxisMode === "month") return 108;
    return 96;
  }

  private getDateTickLabelPriority(tick: HTMLElement): number {
    if (tick.classList.contains("is-center-date")) return 100;
    if (tick.classList.contains("is-today")) return 90;
    if (tick.classList.contains("is-major")) return 70;
    if (tick.classList.contains("is-weekend")) return 20;
    return 40;
  }

  private updateViewportReadouts(): void {
    const readout = this.containerEl.querySelector(".fishbone-zoom-readout");
    const spans = readout?.querySelectorAll("span");
    if (spans?.[0]) spans[0].setText(formatPercent(this.viewport.canvasZoom));
    if (spans?.[1]) spans[1].setText(`${Math.round(this.viewport.timeScale)}px/天`);
  }

  private queuePersistViewState(): void {
    if (this.persistViewStateTimer !== null) {
      window.clearTimeout(this.persistViewStateTimer);
    }
    this.persistViewStateTimer = window.setTimeout(() => {
      this.persistViewStateTimer = null;
      void this.persistViewState();
    }, 180);
  }

  private renderCanvasLane(layer: HTMLElement, lane: FishboneCanvasLane, mainlines: Mainline[]): void {
    const laneEl = layer.createDiv({
      cls: [
        "fishbone-canvas-lane",
        lane.isUnassigned ? "is-unassigned" : "",
        lane.isCollapsed ? "is-collapsed" : "",
        lane.isPinned ? "is-pinned" : "",
        lane.isHidden ? "is-hidden-mainline" : ""
      ].filter(Boolean).join(" ")
    });
    laneEl.style.setProperty("--lane-color", lane.color);
    laneEl.style.left = "0px";
    laneEl.style.top = `${lane.y}px`;
    laneEl.style.width = "100%";
    laneEl.style.height = `${lane.height}px`;
    laneEl.setAttr("data-lane-id", lane.id);
    laneEl.addEventListener("mouseenter", () => {
      this.viewport = setFocusedLane(this.viewport, lane.id);
    });
    laneEl.addEventListener("mouseleave", () => {
      this.viewport = setFocusedLane(this.viewport, null);
    });

    const spine = laneEl.createDiv({ cls: "fishbone-canvas-spine" });
    spine.style.top = `${lane.height / 2}px`;

    const mainline = mainlines.find((item) => item.id === lane.id);
    if (mainline) {
      this.bindMainlineContextMenu(laneEl, mainline);
    }
  }

  private renderCanvasLaneLabel(layer: HTMLElement, lane: FishboneCanvasLane, mainlines: Mainline[], layout: FishboneCanvasLayout): void {
    const label = layer.createDiv({
      cls: [
        "fishbone-canvas-lane-label",
        lane.isUnassigned ? "is-unassigned" : "",
        lane.isCollapsed ? "is-collapsed" : "",
        lane.isPinned ? "is-pinned" : "",
        lane.isHidden ? "is-hidden-mainline" : ""
      ].filter(Boolean).join(" ")
    });
    label.style.setProperty("--lane-color", lane.color);
    label.setAttr("data-lane-id", lane.id);
    label.setAttr("data-lane-spine-y", String(lane.spineY));
    label.createDiv({ cls: "fishbone-lane-dot" });

    const text = label.createDiv({ cls: "fishbone-lane-text" });
    const top = text.createDiv({ cls: "fishbone-lane-topline" });
    const name = top.createDiv({ cls: "fishbone-lane-name", text: lane.name });
    if (lane.isPinned) top.createSpan({ cls: "fishbone-lane-chip", text: "固定" });
    if (lane.isCollapsed) top.createSpan({ cls: "fishbone-lane-chip", text: "折叠" });
    if (lane.isHidden) top.createSpan({ cls: "fishbone-lane-chip", text: "隐藏" });
    text.createDiv({ cls: "fishbone-lane-kind", text: lane.isUnassigned ? `未分配 · ${lane.taskCount}` : `用户主线 · ${lane.taskCount}` });

    const mainline = mainlines.find((item) => item.id === lane.id);
    if (mainline) {
      label.addClass("fishbone-lane-label-interactive");
      name.setAttr("title", "点击修改；右键显示更多；长按拖动排序");
      name.addEventListener("click", (event) => {
        event.stopPropagation();
        if (this.suppressNextMainlineClick) {
          event.preventDefault();
          this.suppressNextMainlineClick = false;
          return;
        }
        this.openEditMainlineModal(mainline);
      });
      this.bindMainlineContextMenu(label, mainline);
      this.bindMainlineDrag(label, mainline, layout, mainlines);
    }
  }

  private renderCanvasTaskNode(parent: HTMLElement, taskNode: FishboneCanvasTaskNode, mainlines: Mainline[], layout: FishboneCanvasLayout): void {
    const task = taskNode.task;
    const node = parent.createDiv({
      cls: [
        "fishbone-task-node",
        `fishbone-task-${task.status}`,
        `fishbone-priority-${task.priority}`,
        `fishbone-branch-${taskNode.branchSide}`,
        taskNode.branchMainlineId ? "is-branch-task" : "",
        taskNode.isCompacted ? "is-compacted" : ""
      ].filter(Boolean).join(" ")
    });
    node.style.setProperty("--lane-color", taskNode.color);
    node.setAttr("data-lane-id", taskNode.laneId);
    node.setAttr("data-task-id", task.taskId);
    node.setAttr("data-cluster-id", taskNode.bucketId);
    node.style.left = `${taskNode.x}px`;
    node.style.top = `${taskNode.y}px`;
    node.style.width = `${taskNode.width}px`;
    node.style.minHeight = `${taskNode.height}px`;
    node.style.setProperty("--branch-index", String(taskNode.branchIndex));
    node.setAttr("title", `${task.title}\n${task.date ?? "无日期"} · ${task.mainline ?? "未分配"} · ${task.status} · ${task.priority}`);
    const header = node.createDiv({ cls: "fishbone-task-header" });
    const checkbox = header.createEl("input", {
      attr: {
        type: "checkbox",
        "aria-label": "切换任务完成状态"
      }
    });
    checkbox.checked = task.status === "done";
    checkbox.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
    });
    checkbox.addEventListener("click", (event) => {
      event.stopPropagation();
    });
    checkbox.addEventListener("change", async (event) => {
      event.stopPropagation();
      const status = await this.plugin.taskRepository.setTaskDone(task, checkbox.checked);
      if (status) {
        new Notice(`任务状态已更新为 ${status}`);
        await this.render();
      }
    });

    header.createDiv({ cls: "fishbone-task-title", text: task.title });
    header.createSpan({ cls: "fishbone-task-priority", text: formatPriority(task.priority) });
    const meta = node.createDiv({ cls: "fishbone-task-meta" });
    meta.createSpan({ cls: "fishbone-task-status", text: task.status });
    node.addEventListener("mouseenter", () => {
      this.showTaskTooltip(node, task, taskNode);
      const stage = parent.closest(".fishbone-canvas-stage") as HTMLElement | null;
      if (stage) this.highlightTaskRelations(stage, task.taskId);
    });
    node.addEventListener("mouseleave", () => {
      this.hideTaskTooltip(node);
      const stage = parent.closest(".fishbone-canvas-stage") as HTMLElement | null;
      if (stage) this.clearRelationHighlights(stage);
    });
    this.bindTaskContextMenu(node, task, mainlines);
    this.bindTaskDrag(node, taskNode, layout, mainlines);

    node.addEventListener("click", (event) => {
      if (this.suppressNextTaskClick) {
        event.preventDefault();
        this.suppressNextTaskClick = false;
        return;
      }
      void this.plugin.taskRepository.openTask(task);
    });
  }

  private renderTaskCluster(parent: HTMLElement, cluster: FishboneCanvasTaskCluster): void {
    const node = parent.createDiv({ cls: "fishbone-task-cluster" });
    node.style.setProperty("--lane-color", cluster.color);
    node.style.left = `${cluster.x}px`;
    node.style.top = `${cluster.y}px`;
    node.setAttr("data-lane-id", cluster.laneId);
    node.setAttr("data-cluster-id", cluster.id);
    node.createSpan({ cls: "fishbone-task-cluster-count", text: `+${cluster.count}` });
    node.createSpan({ cls: "fishbone-task-cluster-label", text: "展开任务" });
    node.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.expandedClusters.add(cluster.id);
      await this.persistViewState();
      await this.render();
    });
  }

  private showTaskTooltip(node: HTMLElement, task: PlanningTask, taskNode?: FishboneCanvasTaskNode): void {
    if (this.taskPointerDrag?.active) return;
    node.querySelector(".fishbone-task-tooltip")?.remove();
    const tooltip = node.createDiv({ cls: "fishbone-task-tooltip" });
    tooltip.createDiv({ cls: "fishbone-task-tooltip-title", text: task.title });
    tooltip.createDiv({ text: `日期：${task.date ?? "无日期"}` });
    tooltip.createDiv({ text: `主线：${task.mainline ?? "未分配"}` });
    if (task.branchMainline || task.branchMainlineId || taskNode?.branchMainlineId) {
      tooltip.createDiv({ text: `分支主线：${task.branchMainline ?? task.branchMainlineId ?? taskNode?.branchMainlineId}` });
    }
    if (taskNode?.effectiveDate && task.date && taskNode.effectiveDate !== task.date) {
      tooltip.createDiv({ text: `显示日期：${taskNode.effectiveDate}（已限制在分支范围内）` });
    }
    tooltip.createDiv({ text: `状态：${task.status} · 优先级：${task.priority}` });
    tooltip.createDiv({ text: `关系：${task.relations.length}` });
    if (task.sourceExcerpt) {
      tooltip.createDiv({ cls: "fishbone-task-tooltip-excerpt", text: task.sourceExcerpt });
    }
  }

  private hideTaskTooltip(node: HTMLElement): void {
    node.querySelector(".fishbone-task-tooltip")?.remove();
  }

  private bindTaskContextMenu(node: HTMLElement, task: PlanningTask, mainlines: Mainline[]): void {
    node.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const menu = new Menu();
      menu.addItem((item) => {
        item.setTitle("打开任务").setIcon("file-text").onClick(() => {
          void this.plugin.taskRepository.openTask(task);
        });
      });
      menu.addItem((item) => {
        item.setTitle("编辑任务属性").setIcon("pencil").onClick(() => {
          new TaskEditorModal(this.plugin, task, mainlines, async (patch) => {
            await this.plugin.taskRepository.updateTaskFields(task, patch);
            await this.render();
          }).open();
        });
      });
      menu.addItem((item) => {
        item.setTitle("转换为分支主线").setIcon("git-branch").onClick(() => {
          this.openCreateBranchFromTaskModal(task, mainlines);
        });
      });
      if (task.branchMainlineId || task.branchMainline) {
        menu.addItem((item) => {
          item.setTitle("移出分支主线").setIcon("unlink").onClick(async () => {
            await this.plugin.taskRepository.updateTaskFields(task, {
              branchMainlineId: null,
              branchMainline: null
            });
            await this.render();
          });
        });
      }
      for (const status of TASK_STATUSES) {
        menu.addItem((item) => {
          item.setTitle(`状态：${status}`).onClick(async () => {
            await this.plugin.taskRepository.setTaskStatus(task, status);
            await this.render();
          });
        });
      }
      for (const priority of TASK_PRIORITIES) {
        menu.addItem((item) => {
          item.setTitle(`优先级：${priority}`).onClick(async () => {
            await this.plugin.taskRepository.setTaskPriority(task, priority);
            await this.render();
          });
        });
      }
      menu.addItem((item) => {
        item.setTitle("移动到未分配").onClick(async () => {
          await this.plugin.taskRepository.setTaskMainline(task, null);
          await this.render();
        });
      });
      menu.addItem((item) => {
        item.setTitle("复制 task_id").onClick(() => {
          void navigator.clipboard?.writeText(task.taskId);
        });
      });
      menu.addItem((item) => {
        item.setTitle("复制任务路径").onClick(() => {
          void navigator.clipboard?.writeText(task.path);
        });
      });
      menu.showAtMouseEvent(event);
    });
  }

  private bindTaskDrag(node: HTMLElement, taskNode: FishboneCanvasTaskNode, layout: FishboneCanvasLayout, mainlines: Mainline[]): void {
    let timer: number | null = null;
    const clearTimer = () => {
      if (timer !== null) {
        window.clearTimeout(timer);
        timer = null;
      }
    };

    const finishTaskDrag = async (event: PointerEvent) => {
      const drag = this.taskPointerDrag;
      if (!drag || drag.pointerId !== event.pointerId) {
        clearTimer();
        return;
      }
      clearTimer();
      this.taskPointerDrag = null;
      if (node.hasPointerCapture(event.pointerId)) {
        node.releasePointerCapture(event.pointerId);
      }
      node.removeClass("fishbone-task-dragging");
      drag.canvas.removeClass("is-task-drag-over");
      this.hideTaskDropHint(drag.canvas);

      if (!drag.active) return;
      event.preventDefault();
      event.stopPropagation();
      this.suppressNextTaskClick = true;
      window.setTimeout(() => {
        this.suppressNextTaskClick = false;
      }, 250);

      const point = clientPointToCanvasPoint(event.clientX, event.clientY, drag.canvas.getBoundingClientRect(), this.viewport);
      const targetBranch = canvasPointToBranchMainline(drag.layout.branchMainlines, point);
      if (targetBranch) {
        const targetBranchMainline = drag.mainlines.find((mainline) => mainline.id === targetBranch.id);
        const parentMainline = drag.mainlines.find((mainline) => mainline.id === targetBranch.parentMainlineId);
        const candidateDate = canvasPointToDate(point, this.viewport) ?? drag.taskNode.task.date ?? targetBranch.startDate;
        const targetDate = clampIsoDate(candidateDate, targetBranch.startDate, targetBranch.endDate);
        await this.plugin.taskRepository.updateTaskFields(drag.taskNode.task, {
          date: targetDate,
          mainline: parentMainline?.name ?? drag.taskNode.task.mainline,
          branchMainlineId: targetBranch.id,
          branchMainline: targetBranchMainline?.name ?? targetBranch.name
        });
        await this.render();
        return;
      }

      const targetDate = canvasPointToDate(point, this.viewport) ?? drag.taskNode.task.date;
      const targetMainline = canvasPointToMainline(drag.layout.lanes, point);
      if (typeof targetMainline === "undefined") {
        drag.element.style.left = `${drag.taskNode.x}px`;
        drag.element.style.top = `${drag.taskNode.y}px`;
        this.applyCanvasTransform(drag.canvas);
        return;
      }
      await this.plugin.taskRepository.updateTaskFields(drag.taskNode.task, {
        date: targetDate,
        mainline: targetMainline,
        branchMainlineId: null,
        branchMainline: null
      });
      await this.render();
    };

    node.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || isFormTarget(event.target)) return;
      event.stopPropagation();
      clearTimer();
      const canvas = node.closest(".fishbone-canvas-viewport") as HTMLElement | null;
      if (!canvas) return;
      node.setPointerCapture(event.pointerId);
      this.taskPointerDrag = {
        taskNode,
        pointerId: event.pointerId,
        timer: null,
        active: false,
        layout,
        mainlines,
        canvas,
        element: node
      };
      timer = window.setTimeout(() => {
        if (!this.taskPointerDrag || this.taskPointerDrag.pointerId !== event.pointerId) return;
        this.taskPointerDrag.active = true;
        node.addClass("fishbone-task-dragging");
        canvas.addClass("is-task-drag-over");
        this.hideTaskTooltip(node);
      }, 240);
    });

    node.addEventListener("pointermove", (event) => {
      const drag = this.taskPointerDrag;
      if (!drag || drag.pointerId !== event.pointerId || !drag.active) return;
      event.preventDefault();
      event.stopPropagation();
      const point = clientPointToCanvasPoint(event.clientX, event.clientY, drag.canvas.getBoundingClientRect(), this.viewport);
      node.style.left = `${point.x}px`;
      node.style.top = `${point.y}px`;
      this.updateTaskDropHint(drag.canvas, drag.layout, point, drag.taskNode.task.date);
      });

    node.addEventListener("pointerup", (event) => {
      void finishTaskDrag(event);
    });
    node.addEventListener("pointercancel", (event) => {
      void finishTaskDrag(event);
    });
  }

  private updateTaskDropHint(canvas: HTMLElement, layout: FishboneCanvasLayout, point: { x: number; y: number }, lockedDate?: string | null): void {
    const hint = canvas.querySelector<HTMLElement>(".fishbone-task-drop-hint");
    if (!hint) return;
    const branch = canvasPointToBranchMainline(layout.branchMainlines, point);
    if (branch) {
      const candidateDate = canvasPointToDate(point, this.viewport) ?? lockedDate ?? branch.startDate;
      const date = clampIsoDate(candidateDate, branch.startDate, branch.endDate);
      hint.setText(`${date} · 分支 ${branch.name}`);
      hint.addClass("is-visible");
      hint.addClass("is-branch-target");
      return;
    }
    const lane = canvasPointToLane(layout.lanes, point);
    const date = canvasPointToDate(point, this.viewport) ?? lockedDate;
    hint.setText(`${date ?? "无日期"} · ${lane?.name ?? "无主线"}`);
    hint.addClass("is-visible");
    hint.removeClass("is-branch-target");
  }

  private hideTaskDropHint(canvas: HTMLElement): void {
    const hint = canvas.querySelector<HTMLElement>(".fishbone-task-drop-hint");
    if (!hint) return;
    hint.removeClass("is-visible");
    hint.removeClass("is-branch-target");
  }

  private highlightTaskRelations(stage: HTMLElement, sourceTaskId: string, targetTaskId?: string): void {
    this.clearRelationHighlights(stage);
    const taskIds = new Set([sourceTaskId, targetTaskId].filter((value): value is string => Boolean(value)));
    stage.querySelectorAll<HTMLElement>(".fishbone-task-node").forEach((node) => {
      if (taskIds.has(node.dataset.taskId ?? "")) {
        node.addClass("is-relation-highlight");
      }
    });
    stage.querySelectorAll<SVGGElement>(".fishbone-relation").forEach((relation) => {
      const source = relation.dataset.sourceTaskId ?? "";
      const target = relation.dataset.targetTaskId ?? "";
      if (taskIds.has(source) || taskIds.has(target)) {
        relation.addClass("is-relation-highlight");
      }
    });
  }

  private clearRelationHighlights(stage: HTMLElement): void {
    stage.querySelectorAll<HTMLElement>(".is-relation-highlight").forEach((element) => {
      element.removeClass("is-relation-highlight");
    });
  }

  private openEditMainlineModal(mainline: Mainline): void {
    new MainlineEditorModal(this.plugin, {
      title: "修改主线",
      submitText: "保存",
      name: mainline.name,
      color: mainline.color,
      onSubmit: async (name, color) => {
        await this.plugin.mainlineRepository.updateMainline(mainline.id, name, color);
        new Notice(`已修改主线：${name.trim()}`);
        await this.render();
      }
    }).open();
  }

  private openCreateBranchFromTaskModal(task: PlanningTask, mainlines: Mainline[]): void {
    const rootMainlines = mainlines.filter((mainline) => mainline.type !== "branch");
    if (rootMainlines.length === 0) {
      new Notice("请先创建一条普通主线，再转换为分支主线");
      return;
    }
    const parent = rootMainlines.find((mainline) => mainline.name === task.mainline) ?? rootMainlines[0];
    const startDate = task.date && parseDateString(task.date) ? task.date : getLocalDateString(new Date());
    const endDate = addDaysToIsoDate(startDate, 6);
    new BranchMainlineEditorModal(this.plugin, {
      title: "转换为分支主线",
      submitText: "创建分支",
      rootMainlines,
      name: task.title,
      color: parent.color,
      parentMainlineId: parent.id,
      startDate,
      endDate,
      onSubmit: async (values) => {
        const branch = await this.plugin.mainlineRepository.createBranchMainline(values);
        const branchParent = rootMainlines.find((mainline) => mainline.id === branch.parentMainlineId) ?? parent;
        await this.plugin.taskRepository.updateTaskFields(task, {
          mainline: branchParent.name,
          branchMainlineId: branch.id,
          branchMainline: branch.name
        });
        new Notice(`已创建分支主线：${branch.name}`);
        await this.render();
      }
    }).open();
  }

  private openEditBranchMainlineModal(branch: Mainline, mainlines: Mainline[]): void {
    const rootMainlines = mainlines.filter((mainline) => mainline.type !== "branch");
    new BranchMainlineEditorModal(this.plugin, {
      title: "修改分支主线",
      submitText: "保存",
      rootMainlines,
      name: branch.name,
      color: branch.color,
      parentMainlineId: branch.parentMainlineId ?? rootMainlines[0]?.id ?? "",
      startDate: branch.startDate ?? getLocalDateString(new Date()),
      endDate: branch.endDate ?? getLocalDateString(new Date()),
      onSubmit: async (values) => {
        const updated = await this.plugin.mainlineRepository.updateBranchMainline(branch.id, values);
        new Notice(`已修改分支主线：${updated.name}`);
        await this.render();
      }
    }).open();
  }

  private bindBranchMainlineContextMenu(node: HTMLElement, branch: Mainline, mainlines: Mainline[], tasks: PlanningTask[]): void {
    node.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const branchTasks = tasks.filter((task) => task.branchMainlineId === branch.id || task.branchMainline === branch.name);
      const menu = new Menu();
      menu.addItem((item) => {
        item
          .setTitle("修改分支主线")
          .setIcon("pencil")
          .onClick(() => this.openEditBranchMainlineModal(branch, mainlines));
      });
      menu.addItem((item) => {
        item
          .setTitle(branch.collapsed ? "展开分支" : "折叠分支")
          .setIcon(branch.collapsed ? "chevrons-down" : "chevrons-up")
          .onClick(async () => {
            await this.plugin.mainlineRepository.updateMainlineFlags(branch.id, { collapsed: !branch.collapsed });
            await this.render();
          });
      });
      menu.addItem((item) => {
        item
          .setTitle("删除分支主线")
          .setIcon("trash")
          .onClick(async () => {
            const confirmed = window.confirm(`删除分支主线「${branch.name}」？`);
            if (!confirmed) return;
            const clearChildren = branchTasks.length > 0 && window.confirm(`找到 ${branchTasks.length} 个分支任务。是否同时解除这些任务的分支挂载？`);
            const deleted = await this.plugin.mainlineRepository.deleteMainline(branch.id);
            if (deleted && clearChildren) {
              await Promise.all(branchTasks.map((task) => this.plugin.taskRepository.updateTaskFields(task, {
                branchMainlineId: null,
                branchMainline: null
              })));
            }
            if (deleted) {
              new Notice(`已删除分支主线：${deleted.name}`);
              await this.render();
            }
          });
      });
      menu.showAtMouseEvent(event);
    });
  }

  private bindBranchMainlineDrag(node: HTMLElement, branch: FishboneCanvasBranchMainline): void {
    let timer: number | null = null;
    const clearTimer = () => {
      if (timer !== null) {
        window.clearTimeout(timer);
        timer = null;
      }
    };

    const finishBranchDrag = async (event: PointerEvent) => {
      const drag = this.branchPointerDrag;
      if (!drag || drag.pointerId !== event.pointerId) {
        clearTimer();
        return;
      }
      clearTimer();
      this.branchPointerDrag = null;
      if (node.hasPointerCapture(event.pointerId)) {
        node.releasePointerCapture(event.pointerId);
      }
      node.removeClass("fishbone-branch-dragging");
      this.setBranchVisualActive(drag.branch.id, false);
      if (!drag.active) return;

      event.preventDefault();
      event.stopPropagation();
      this.suppressNextBranchClick = true;
      window.setTimeout(() => {
        this.suppressNextBranchClick = false;
      }, 250);

      const point = clientPointToCanvasPoint(event.clientX, event.clientY, drag.canvas.getBoundingClientRect(), this.viewport);
      const nextOffset = drag.startBranchOffset + (point.y - drag.startCanvasY);
      await this.plugin.mainlineRepository.updateBranchMainlineOffset(drag.branch.id, nextOffset);
      await this.render();
    };

    node.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || isFormTarget(event.target)) return;
      event.stopPropagation();
      clearTimer();
      const canvas = node.closest(".fishbone-canvas-viewport") as HTMLElement | null;
      if (!canvas) return;
      const startPoint = clientPointToCanvasPoint(event.clientX, event.clientY, canvas.getBoundingClientRect(), this.viewport);
      node.setPointerCapture(event.pointerId);
      this.branchPointerDrag = {
        branch,
        pointerId: event.pointerId,
        timer: null,
        active: false,
        canvas,
        element: node,
        startCanvasY: startPoint.y,
        startBranchOffset: branch.branchOffset,
        elementStartTop: Number.parseFloat(node.style.top) || branch.y
      };
      timer = window.setTimeout(() => {
        if (!this.branchPointerDrag || this.branchPointerDrag.pointerId !== event.pointerId) return;
        this.branchPointerDrag.active = true;
        node.addClass("fishbone-branch-dragging");
        this.setBranchVisualActive(branch.id, true);
      }, 220);
    });

    node.addEventListener("pointermove", (event) => {
      const drag = this.branchPointerDrag;
      if (!drag || drag.pointerId !== event.pointerId || !drag.active) return;
      event.preventDefault();
      event.stopPropagation();
      const point = clientPointToCanvasPoint(event.clientX, event.clientY, drag.canvas.getBoundingClientRect(), this.viewport);
      node.style.top = `${drag.elementStartTop + point.y - drag.startCanvasY}px`;
    });
    node.addEventListener("pointerup", (event) => {
      void finishBranchDrag(event);
    });
    node.addEventListener("pointercancel", (event) => {
      void finishBranchDrag(event);
    });
  }

  private bindMainlineContextMenu(label: HTMLElement, mainline: Mainline): void {
    label.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const menu = new Menu();
      menu.addItem((item) => {
        item
          .setTitle("修改主线")
          .setIcon("pencil")
          .onClick(() => this.openEditMainlineModal(mainline));
      });
      menu.addItem((item) => {
        item
          .setTitle(mainline.collapsed ? "展开主线" : "折叠主线")
          .setIcon(mainline.collapsed ? "chevrons-down" : "chevrons-up")
          .onClick(async () => {
            await this.plugin.mainlineRepository.updateMainlineFlags(mainline.id, { collapsed: !mainline.collapsed });
            await this.render();
          });
      });
      menu.addItem((item) => {
        item
          .setTitle(mainline.pinned ? "取消固定" : "固定主线")
          .setIcon("pin")
          .onClick(async () => {
            await this.plugin.mainlineRepository.updateMainlineFlags(mainline.id, { pinned: !mainline.pinned });
            await this.render();
          });
      });
      menu.addItem((item) => {
        item
          .setTitle(mainline.visible === false ? "显示主线" : "隐藏主线")
          .setIcon(mainline.visible === false ? "eye" : "eye-off")
          .onClick(async () => {
            await this.plugin.mainlineRepository.updateMainlineFlags(mainline.id, { visible: mainline.visible === false });
            await this.render();
          });
      });
      menu.addItem((item) => {
        item
          .setTitle("删除主线")
          .setIcon("trash")
          .onClick(async () => {
            const confirmed = window.confirm(`删除主线「${mainline.name}」？任务文件不会被批量修改，原本挂在该主线的任务会显示为未分配。`);
            if (!confirmed) return;
            const deleted = await this.plugin.mainlineRepository.deleteMainline(mainline.id);
            if (deleted) {
              new Notice(`已删除主线：${deleted.name}`);
              await this.render();
            }
          });
      });
      menu.showAtMouseEvent(event);
    });
  }

  private bindMainlineDrag(label: HTMLElement, mainline: Mainline, layout: FishboneCanvasLayout, mainlines: Mainline[]): void {
    let timer: number | null = null;

    const clearTimer = () => {
      if (timer !== null) {
        window.clearTimeout(timer);
        timer = null;
      }
    };

    const finishPointerDrag = async (event: PointerEvent) => {
      const drag = this.mainlinePointerDrag;
      if (!drag || drag.pointerId !== event.pointerId) {
        clearTimer();
        return;
      }
      clearTimer();
      this.mainlinePointerDrag = null;
      if (label.hasPointerCapture(event.pointerId)) {
        label.releasePointerCapture(event.pointerId);
      }
      label.removeClass("fishbone-lane-drag-ready");
      label.removeClass("fishbone-lane-dragging");
      drag.canvas.removeClass("is-mainline-drag-over");
      if (!drag.active) return;

      event.preventDefault();
      event.stopPropagation();
      this.suppressNextMainlineClick = true;
      window.setTimeout(() => {
        this.suppressNextMainlineClick = false;
      }, 250);
      await this.moveMainlineByClientY(drag.canvas, drag.layout, drag.mainlines, drag.sourceId, event.clientY);
    };

    label.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      event.stopPropagation();
      clearTimer();
      const canvas = label.closest(".fishbone-canvas-viewport") as HTMLElement | null;
      if (!canvas) return;
      label.draggable = false;
      label.setPointerCapture(event.pointerId);
      this.mainlinePointerDrag = {
        sourceId: mainline.id,
        pointerId: event.pointerId,
        timer: null,
        active: false,
        layout,
        mainlines,
        canvas,
        label
      };
      timer = window.setTimeout(() => {
        if (!this.mainlinePointerDrag || this.mainlinePointerDrag.pointerId !== event.pointerId) return;
        this.mainlinePointerDrag.active = true;
        label.addClass("fishbone-lane-drag-ready");
        label.addClass("fishbone-lane-dragging");
        canvas.addClass("is-mainline-drag-over");
      }, 240);
    });
    label.addEventListener("pointermove", (event) => {
      const drag = this.mainlinePointerDrag;
      if (!drag || drag.pointerId !== event.pointerId || !drag.active) return;
      event.preventDefault();
      event.stopPropagation();
      label.style.top = `${event.clientY - drag.canvas.getBoundingClientRect().top}px`;
    });
    label.addEventListener("pointerup", (event) => {
      void finishPointerDrag(event);
    });
    label.addEventListener("pointercancel", (event) => {
      void finishPointerDrag(event);
    });
  }

  private async moveMainlineByCanvasDrop(
    canvas: HTMLElement,
    layout: FishboneCanvasLayout,
    mainlines: Mainline[],
    sourceId: string,
    event: DragEvent
  ): Promise<void> {
    await this.moveMainlineByClientY(canvas, layout, mainlines, sourceId, event.clientY);
  }

  private async moveMainlineByClientY(
    canvas: HTMLElement,
    layout: FishboneCanvasLayout,
    mainlines: Mainline[],
    sourceId: string,
    clientY: number
  ): Promise<void> {
    const mainlineIds = new Set(mainlines.map((mainline) => mainline.id));
    const lanes = layout.lanes.filter((lane) => mainlineIds.has(lane.id));
    if (lanes.length === 0) return;

    const rect = canvas.getBoundingClientRect();
    const pointerY = clientY - rect.top;
    let target = lanes[0];
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const lane of lanes) {
      const laneCenterY = this.viewport.panY + lane.spineY * this.viewport.canvasZoom;
      const distance = Math.abs(pointerY - laneCenterY);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        target = lane;
      }
    }

    if (sourceId === target.id) {
      this.applyCanvasTransform(canvas);
      return;
    }
    const targetCenterY = this.viewport.panY + target.spineY * this.viewport.canvasZoom;
    const placement = pointerY < targetCenterY ? "before" : "after";
    await this.plugin.mainlineRepository.moveMainline(sourceId, target.id, placement);
    new Notice("主线排序已更新");
    await this.render();
  }

  private async persistViewState(): Promise<void> {
    this.plugin.settings.fishboneViewState = {
      ...this.viewport,
      showRelations: this.showRelations,
      showHiddenMainlines: this.showHiddenMainlines,
      expandedClusters: [...this.expandedClusters]
    };
    if (typeof this.plugin.saveFishboneViewState === "function") {
      await this.plugin.saveFishboneViewState();
      return;
    }
    await this.plugin.saveData(this.plugin.settings);
  }

  private async persistDashboardState(): Promise<void> {
    this.plugin.settings.dashboardState = {
      showDashboard: this.showDashboard,
      dashboardWidth: normalizeDashboardWidth(this.dashboardWidth),
      moduleOrder: [...this.dashboardModuleOrder],
      moduleHeights: { ...this.dashboardModuleHeights },
      workbenchHeight: normalizeWorkbenchHeight(this.workbenchHeight),
      workbenchColumnOrder: [...this.workbenchColumnOrder]
    };
    if (typeof this.plugin.saveFishboneViewState === "function") {
      await this.plugin.saveFishboneViewState();
      return;
    }
    await this.plugin.saveData(this.plugin.settings);
  }
}

interface MainlineEditorOptions {
  title: string;
  submitText: string;
  name: string;
  color: string;
  onSubmit: (name: string, color: string) => Promise<void>;
}

class MainlineEditorModal extends Modal {
  private options: MainlineEditorOptions;
  private name: string;
  private color: string;

  constructor(plugin: FishbonePlannerPlugin, options: MainlineEditorOptions) {
    super(plugin.app);
    this.options = options;
    this.name = options.name;
    this.color = options.color;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: this.options.title });

    new Setting(contentEl)
      .setName("主线名称")
      .addText((text) => {
        text
          .setPlaceholder("例如：项目")
          .setValue(this.name)
          .onChange((value) => {
            this.name = value;
          });
        window.setTimeout(() => text.inputEl.focus(), 0);
      });

    new Setting(contentEl)
      .setName("颜色")
      .addColorPicker((picker) => {
        picker
          .setValue(this.color)
          .onChange((value) => {
            this.color = value;
          });
      });

    new Setting(contentEl)
      .addButton((button) => {
        button
          .setButtonText("取消")
          .onClick(() => this.close());
      })
      .addButton((button) => {
        button
          .setButtonText(this.options.submitText)
          .setCta()
          .onClick(async () => {
            try {
              await this.options.onSubmit(this.name, this.color);
              this.close();
            } catch (error) {
              new Notice(error instanceof Error ? error.message : "保存主线失败");
            }
          });
      });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

interface BranchMainlineEditorValues {
  name: string;
  color: string;
  parentMainlineId: string;
  startDate: string;
  endDate: string;
}

interface BranchMainlineEditorOptions extends BranchMainlineEditorValues {
  title: string;
  submitText: string;
  rootMainlines: Mainline[];
  onSubmit: (values: BranchMainlineEditorValues) => Promise<void>;
}

class BranchMainlineEditorModal extends Modal {
  private options: BranchMainlineEditorOptions;
  private values: BranchMainlineEditorValues;

  constructor(plugin: FishbonePlannerPlugin, options: BranchMainlineEditorOptions) {
    super(plugin.app);
    this.options = options;
    this.values = {
      name: options.name,
      color: options.color,
      parentMainlineId: options.parentMainlineId,
      startDate: options.startDate,
      endDate: options.endDate
    };
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: this.options.title });

    new Setting(contentEl)
      .setName("分支名称")
      .addText((text) => {
        text
          .setPlaceholder("例如：M5.4 短期攻坚")
          .setValue(this.values.name)
          .onChange((value) => {
            this.values.name = value;
          });
        window.setTimeout(() => text.inputEl.focus(), 0);
      });

    new Setting(contentEl)
      .setName("父主线")
      .addDropdown((dropdown) => {
        for (const mainline of this.options.rootMainlines) {
          dropdown.addOption(mainline.id, mainline.name);
        }
        dropdown.setValue(this.values.parentMainlineId).onChange((value) => {
          this.values.parentMainlineId = value;
        });
      });

    new Setting(contentEl)
      .setName("起始日期")
      .addText((text) => {
        text.setPlaceholder("YYYY-MM-DD").setValue(this.values.startDate).onChange((value) => {
          this.values.startDate = value.trim();
        });
      });

    new Setting(contentEl)
      .setName("结束日期")
      .addText((text) => {
        text.setPlaceholder("YYYY-MM-DD").setValue(this.values.endDate).onChange((value) => {
          this.values.endDate = value.trim();
        });
      });

    new Setting(contentEl)
      .setName("颜色")
      .addColorPicker((picker) => {
        picker.setValue(this.values.color).onChange((value) => {
          this.values.color = value;
        });
      });

    new Setting(contentEl)
      .addButton((button) => {
        button.setButtonText("取消").onClick(() => this.close());
      })
      .addButton((button) => {
        button
          .setButtonText(this.options.submitText)
          .setCta()
          .onClick(async () => {
            if (!this.values.name.trim()) {
              new Notice("分支名称不能为空");
              return;
            }
            if (!parseDateString(this.values.startDate) || !parseDateString(this.values.endDate)) {
              new Notice("日期必须使用 YYYY-MM-DD");
              return;
            }
            try {
              await this.options.onSubmit({
                ...this.values,
                name: this.values.name.trim()
              });
              this.close();
            } catch (error) {
              new Notice(error instanceof Error ? error.message : "保存分支主线失败");
            }
          });
      });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

class NewTaskModal extends Modal {
  private mainlines: Mainline[];
  private onSubmit: (input: CreatePlanningTaskInput) => Promise<void>;
  private title = "";
  private date = getLocalDateString(new Date());
  private mainline = "";
  private status: TaskStatus = "todo";
  private priority: TaskPriority = "medium";
  private sourceExcerpt = "";
  private sourceType: CreatePlanningTaskInput["sourceType"] = "manual";

  constructor(
    plugin: FishbonePlannerPlugin,
    mainlines: Mainline[],
    onSubmit: (input: CreatePlanningTaskInput) => Promise<void>,
    initial?: Partial<CreatePlanningTaskInput>
  ) {
    super(plugin.app);
    this.mainlines = mainlines;
    this.onSubmit = onSubmit;
    if (initial) {
      this.title = initial.title ?? this.title;
      this.date = initial.date ?? "";
      this.mainline = initial.mainline ?? "";
      this.status = initial.status ?? this.status;
      this.priority = initial.priority ?? this.priority;
      this.sourceType = initial.sourceType ?? this.sourceType;
      this.sourceExcerpt = initial.sourceExcerpt ?? this.sourceExcerpt;
    }
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "新建任务" });

    new Setting(contentEl)
      .setName("标题")
      .addText((text) => {
        text.setPlaceholder("输入任务标题").setValue(this.title).onChange((value) => {
          this.title = value;
        });
        window.setTimeout(() => text.inputEl.focus(), 0);
      });

    new Setting(contentEl)
      .setName("日期")
      .setDesc("留空时进入 inbox，不挂到具体日期。")
      .addText((text) => {
        text.setPlaceholder("YYYY-MM-DD").setValue(this.date).onChange((value) => {
          this.date = value.trim();
        });
      });

    new Setting(contentEl)
      .setName("主线")
      .addDropdown((dropdown) => {
        dropdown.addOption("", "未分配");
        for (const mainline of this.mainlines.filter((item) => item.type !== "branch")) {
          dropdown.addOption(mainline.name, mainline.name);
        }
        dropdown.setValue(this.mainline).onChange((value) => {
          this.mainline = value;
        });
      });

    new Setting(contentEl)
      .setName("状态")
      .addDropdown((dropdown) => {
        for (const status of TASK_STATUSES) {
          dropdown.addOption(status, status);
        }
        dropdown.setValue(this.status).onChange((value) => {
          this.status = value as TaskStatus;
        });
      });

    new Setting(contentEl)
      .setName("优先级")
      .addDropdown((dropdown) => {
        for (const priority of TASK_PRIORITIES) {
          dropdown.addOption(priority, priority);
        }
        dropdown.setValue(this.priority).onChange((value) => {
          this.priority = value as TaskPriority;
        });
      });

    new Setting(contentEl)
      .setName("描述")
      .addTextArea((text) => {
        text.setPlaceholder("可选，写入任务描述").setValue(this.sourceExcerpt).onChange((value) => {
          this.sourceExcerpt = value;
        });
      });

    new Setting(contentEl)
      .addButton((button) => {
        button.setButtonText("取消").onClick(() => this.close());
      })
      .addButton((button) => {
        button
          .setButtonText("创建")
          .setCta()
          .onClick(async () => {
            const title = this.title.trim();
            const date = this.date.trim();
            if (!title) {
              new Notice("任务标题不能为空");
              return;
            }
            if (date && !parseDateString(date)) {
              new Notice("日期格式应为 YYYY-MM-DD");
              return;
            }
            try {
              await this.onSubmit({
                title,
                date: date.length > 0 ? date : null,
                mainline: this.mainline.length > 0 ? this.mainline : null,
                status: this.status,
                priority: this.priority,
                sourceType: this.sourceType,
                sourceExcerpt: this.sourceExcerpt.trim() || "手动新建任务"
              });
              this.close();
            } catch (error) {
              new Notice(error instanceof Error ? error.message : "创建任务失败");
            }
          });
      });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

class TaskEditorModal extends Modal {
  private mainlines: Mainline[];
  private onSubmit: (patch: TaskFieldPatch) => Promise<void>;
  private title: string;
  private date: string;
  private mainline: string;
  private branchMainlineId: string;
  private status: TaskStatus;
  private priority: TaskPriority;

  constructor(
    plugin: FishbonePlannerPlugin,
    task: PlanningTask,
    mainlines: Mainline[],
    onSubmit: (patch: TaskFieldPatch) => Promise<void>
  ) {
    super(plugin.app);
    this.mainlines = mainlines;
    this.onSubmit = onSubmit;
    this.title = task.title;
    this.date = task.date ?? "";
    this.mainline = task.mainline ?? "";
    this.branchMainlineId = task.branchMainlineId ?? "";
    this.status = task.status;
    this.priority = task.priority;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "编辑任务属性" });

    new Setting(contentEl)
      .setName("标题")
      .addText((text) => {
        text.setValue(this.title).onChange((value) => {
          this.title = value;
        });
      });

    new Setting(contentEl)
      .setName("日期")
      .addText((text) => {
        text.setPlaceholder("YYYY-MM-DD").setValue(this.date).onChange((value) => {
          this.date = value.trim();
        });
      });

    new Setting(contentEl)
      .setName("主线")
      .addDropdown((dropdown) => {
        dropdown.addOption("", "未分配");
        for (const mainline of this.mainlines.filter((item) => item.type !== "branch")) {
          dropdown.addOption(mainline.name, mainline.name);
        }
        dropdown.setValue(this.mainline).onChange((value) => {
          this.mainline = value;
        });
      });

    new Setting(contentEl)
      .setName("分支主线")
      .setDesc("选择后任务会挂载到对应短期分支，并自动使用其父主线。")
      .addDropdown((dropdown) => {
        dropdown.addOption("", "无分支");
        for (const branch of this.mainlines.filter((item) => item.type === "branch")) {
          dropdown.addOption(branch.id, branch.name);
        }
        dropdown.setValue(this.branchMainlineId).onChange((value) => {
          this.branchMainlineId = value;
        });
      });

    new Setting(contentEl)
      .setName("状态")
      .addDropdown((dropdown) => {
        for (const status of TASK_STATUSES) {
          dropdown.addOption(status, status);
        }
        dropdown.setValue(this.status).onChange((value) => {
          this.status = value as TaskStatus;
        });
      });

    new Setting(contentEl)
      .setName("优先级")
      .addDropdown((dropdown) => {
        for (const priority of TASK_PRIORITIES) {
          dropdown.addOption(priority, priority);
        }
        dropdown.setValue(this.priority).onChange((value) => {
          this.priority = value as TaskPriority;
        });
      });

    new Setting(contentEl)
      .addButton((button) => {
        button.setButtonText("取消").onClick(() => this.close());
      })
      .addButton((button) => {
        button
          .setButtonText("保存")
          .setCta()
          .onClick(async () => {
            const title = this.title.trim();
            if (!title) {
              new Notice("任务标题不能为空");
              return;
            }
            const branch = this.mainlines.find((mainline) => mainline.id === this.branchMainlineId && mainline.type === "branch");
            const parent = branch ? this.mainlines.find((mainline) => mainline.id === branch.parentMainlineId) : null;
            await this.onSubmit({
              title,
              date: this.date.length > 0 ? this.date : null,
              mainline: branch ? parent?.name ?? this.mainline : this.mainline.length > 0 ? this.mainline : null,
              branchMainlineId: branch?.id ?? null,
              branchMainline: branch?.name ?? null,
              status: this.status,
              priority: this.priority
            });
            this.close();
          });
      });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

function formatPriority(priority: PlanningTask["priority"]): string {
  switch (priority) {
    case "high":
      return "高";
    case "medium":
      return "中";
    case "low":
      return "低";
    default:
      return priority;
  }
}

function normalizeDashboardWidth(value: unknown): number {
  const numeric = typeof value === "number" && Number.isFinite(value) ? value : 340;
  return Math.max(280, Math.min(520, Math.round(numeric)));
}

function normalizeDashboardModuleOrder(value: unknown): DashboardModuleId[] {
  if (!Array.isArray(value)) return [...DASHBOARD_MODULE_IDS];
  const order = value.filter((item): item is DashboardModuleId => isDashboardModuleId(item));
  for (const moduleId of DASHBOARD_MODULE_IDS) {
    if (!order.includes(moduleId)) order.push(moduleId);
  }
  return order.filter((moduleId, index) => order.indexOf(moduleId) === index);
}

function normalizeDashboardModuleHeights(value: unknown): Record<DashboardModuleId, number> {
  const source = typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
  const heights = { ...DEFAULT_DASHBOARD_MODULE_HEIGHTS };
  for (const moduleId of DASHBOARD_MODULE_IDS) {
    heights[moduleId] = normalizeDashboardModuleHeight(source[moduleId], DEFAULT_DASHBOARD_MODULE_HEIGHTS[moduleId]);
  }
  return heights;
}

function normalizeDashboardModuleHeight(value: unknown, fallback = 156): number {
  const numeric = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.max(86, Math.min(360, Math.round(numeric)));
}

function normalizeWorkbenchHeight(value: unknown): number {
  const numeric = typeof value === "number" && Number.isFinite(value) ? value : 260;
  return Math.max(180, Math.min(440, Math.round(numeric)));
}

function normalizeWorkbenchColumnOrder(value: unknown): WorkbenchColumnId[] {
  if (!Array.isArray(value)) return [...WORKBENCH_COLUMN_IDS];
  const order = value.filter((item): item is WorkbenchColumnId => isWorkbenchColumnId(item));
  for (const columnId of WORKBENCH_COLUMN_IDS) {
    if (!order.includes(columnId)) order.push(columnId);
  }
  return order.filter((columnId, index) => order.indexOf(columnId) === index);
}

function isDashboardModuleId(value: string): value is DashboardModuleId {
  return (DASHBOARD_MODULE_IDS as string[]).includes(value);
}

function isWorkbenchColumnId(value: string): value is WorkbenchColumnId {
  return (WORKBENCH_COLUMN_IDS as string[]).includes(value);
}

function isDashboardProgressModule(moduleId: DashboardModuleId): boolean {
  return moduleId === "progress-overview";
}

function getWorkbenchColumnTasks(summary: DashboardSummary, columnId: WorkbenchColumnId): PlanningTask[] {
  switch (columnId) {
    case "todo":
      return [...summary.inboxTasks, ...summary.todoTasks].filter((task, index, tasks) => {
        return tasks.findIndex((item) => item.taskId === task.taskId) === index;
      });
    case "doing":
      return [...summary.doingTasks, ...summary.blockedTasks].filter((task, index, tasks) => {
        return tasks.findIndex((item) => item.taskId === task.taskId) === index;
      });
    case "done":
      return summary.doneTasks;
    default:
      return [];
  }
}

function buildQuickInputCandidateV2(text: string, summary: DashboardSummary, mainlines: Mainline[]): QuickInputCandidate {
  const warnings: string[] = [];
  const source = text.trim();
  let working = source;
  const hasMultipleCandidates = /[\n;；]/.test(source);
  if (hasMultipleCandidates) {
    warnings.push("检测到多条输入，本阶段仅按一条候选写入。");
  }

  const explicitDate = working.match(/\b\d{4}-\d{2}-\d{2}\b/);
  let date: string | null = summary.today;
  if (explicitDate) {
    date = explicitDate[0];
    working = removeToken(working, explicitDate[0]);
  } else if (/后天/.test(working)) {
    date = addDaysToIsoDate(summary.today, 2);
    working = removePattern(working, /后天/g);
  } else if (/明天/.test(working)) {
    date = addDaysToIsoDate(summary.today, 1);
    working = removePattern(working, /明天/g);
  } else if (/今天|今日/.test(working)) {
    date = summary.today;
    working = removePattern(working, /今天|今日/g);
  } else if (/inbox|收件箱|未定日期/i.test(working)) {
    date = null;
    working = removePattern(working, /inbox|收件箱|未定日期/gi);
  }

  let priority: TaskPriority = "medium";
  if (/高优先级|高优先|重要|紧急|\bhigh\b/i.test(working)) {
    priority = "high";
    working = removePattern(working, /高优先级|高优先|重要|紧急|\bhigh\b/gi);
  } else if (/低优先级|低优先|不急|\blow\b/i.test(working)) {
    priority = "low";
    working = removePattern(working, /低优先级|低优先|不急|\blow\b/gi);
  } else {
    working = removePattern(working, /中优先级|中优先|\bmedium\b/gi);
  }

  let status: TaskStatus = "inbox";
  if (/进行中|\bdoing\b/i.test(working)) {
    status = "doing";
    working = removePattern(working, /进行中|\bdoing\b/gi);
  } else if (/已完成|完成|\bdone\b/i.test(working)) {
    status = "done";
    working = removePattern(working, /已完成|完成|\bdone\b/gi);
  } else if (/阻塞|卡住|\bblocked\b/i.test(working)) {
    status = "blocked";
    working = removePattern(working, /阻塞|卡住|\bblocked\b/gi);
  } else if (/待办|\btodo\b/i.test(working)) {
    status = "todo";
    working = removePattern(working, /待办|\btodo\b/gi);
  }

  const visibleMainlines = mainlines
    .filter((mainline) => mainline.type === "mainline" && mainline.visible !== false)
    .sort((a, b) => b.name.length - a.name.length);
  const matchedMainline = visibleMainlines.find((mainline) => working.includes(mainline.name) || source.includes(mainline.name));
  const mainline = matchedMainline?.name ?? null;
  if (matchedMainline) {
    working = removeToken(working, matchedMainline.name);
  } else {
    warnings.push("未匹配到现有主线，将创建为未分配任务。");
  }

  const title = normalizeQuickInputTitle(working) || normalizeQuickInputTitle(source) || "快速输入任务";
  return {
    text: source,
    title,
    date,
    mainline,
    priority,
    status,
    hasMultipleCandidates,
    warnings
  };
}

function normalizeQuickInputTitle(value: string): string {
  return value
    .replace(/[\n;；]+/g, " ")
    .replace(/[，,。.!！?？:：]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function removeToken(value: string, token: string): string {
  return value.split(token).join(" ");
}

function removePattern(value: string, pattern: RegExp): string {
  return value.replace(pattern, " ");
}

function buildQuickInputCandidate(text: string, summary: DashboardSummary, mainlines: Mainline[]): QuickInputCandidate {
  const firstMainline = mainlines.find((mainline) => mainline.type === "mainline" && mainline.visible !== false);
  return {
    text,
    title: text.length > 36 ? `${text.slice(0, 36)}...` : text,
    date: summary.today,
    mainline: firstMainline?.name ?? "待确认",
    priority: "medium",
    status: "inbox",
    hasMultipleCandidates: false,
    warnings: []
  };
}

function getDashboardTaskReasons(task: PlanningTask, summary: DashboardSummary): string[] {
  const reasons: string[] = [];
  if (task.date && task.date < summary.today && task.status !== "done" && task.status !== "canceled") {
    reasons.push("overdue");
  }
  if (task.priority === "high" && task.status !== "done" && task.status !== "canceled") {
    reasons.push("high");
  }
  if (task.status === "blocked") {
    reasons.push("blocked");
  }
  if (task.status === "doing") {
    reasons.push("doing");
  }
  return reasons;
}

function formatDashboardReason(reason: string): string {
  switch (reason) {
    case "overdue":
      return "过期";
    case "high":
      return "高优先";
    case "blocked":
      return "阻塞";
    case "doing":
      return "进行中";
    default:
      return reason;
  }
}

function formatMode(mode: TimeAxisMode): string {
  switch (mode) {
    case "week":
      return "周视图";
    case "month":
      return "月视图";
    case "overview":
      return "总览";
    default:
      return "日视图";
  }
}

function formatDateRange(range: DateRange): string {
  if (!range.start || !range.end) return "无日期";
  if (range.start === range.end) return range.start;
  return `${range.start} - ${range.end}`;
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function formatLocalDateTimeForSummary(date: Date): string {
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function clampIsoDate(date: string, startDate: string, endDate: string): string {
  if (!parseDateString(date)) {
    return startDate;
  }
  if (date < startDate) return startDate;
  if (date > endDate) return endDate;
  return date;
}

function addDaysToIsoDate(date: string, days: number): string {
  const parsed = parseDateString(date) ?? new Date();
  parsed.setDate(parsed.getDate() + days);
  return getLocalDateString(parsed);
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(target.closest("button, input, select, textarea, .fishbone-task-node, .fishbone-task-cluster, .fishbone-canvas-lane-label, .fishbone-branch-mainline"));
}

function isFormTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(target.closest("button, input, select, textarea"));
}
