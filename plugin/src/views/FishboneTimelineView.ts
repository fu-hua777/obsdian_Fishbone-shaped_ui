import { ItemView, Menu, Modal, Notice, Setting, WorkspaceLeaf } from "obsidian";
import FishbonePlannerPlugin from "../main";
import { TaskFieldPatch } from "../data/taskRepository";
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

export class FishboneTimelineView extends ItemView {
  private plugin: FishbonePlannerPlugin;
  private viewport: FishboneCanvasViewport = createDefaultFishboneCanvasViewport();
  private showRelations = true;
  private showHiddenMainlines = false;
  private expandedClusters = new Set<string>();
  private renderGeneration = 0;
  private persistViewStateTimer: number | null = null;
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

      this.renderCanvas(container, layout, mainlines, tasks);
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
    spine.createDiv({ cls: "fishbone-branch-mainline-line" });

    if (branchMainline) {
      spine.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (this.suppressNextBranchClick) return;
        this.openEditBranchMainlineModal(branchMainline, mainlines);
      });
      this.bindBranchMainlineContextMenu(spine, branchMainline, mainlines, tasks);
      this.bindBranchMainlineDrag(spine, branch);
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
    label.style.top = `${branch.side === "above" ? branch.y - 50 : branch.y + 15}px`;
    label.setAttr("data-branch-mainline-id", branch.id);
    label.setAttr("title", `${branch.name}\n${branch.startDate} - ${branch.endDate}`);
    label.createSpan({ cls: "fishbone-branch-mainline-name", text: branch.name });
    label.createSpan({ cls: "fishbone-branch-mainline-meta", text: `${branch.startDate} - ${branch.endDate} · ${branch.taskCount}` });
    if (branchMainline) {
      label.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (this.suppressNextBranchClick) return;
        this.openEditBranchMainlineModal(branchMainline, mainlines);
      });
      this.bindBranchMainlineContextMenu(label, branchMainline, mainlines, tasks);
      this.bindBranchMainlineDrag(label, branch);
    }
  }

  private getBranchConnectorBounds(branch: FishboneCanvasBranchMainline): { left: number; top: number; width: number; height: number } {
    const left = branch.xStart - 84;
    const right = branch.xStart + 112;
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
    const tailX = endX + 56;
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

      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.addClass("fishbone-relation-path");
      path.setAttribute("d", `M ${line.start.x} ${line.start.y} C ${line.control1.x} ${line.control1.y}, ${line.control2.x} ${line.control2.y}, ${line.end.x} ${line.end.y}`);
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
      label.setAttribute("x", String((line.start.x + line.end.x) / 2));
      label.setAttribute("y", String((line.start.y + line.end.y) / 2 - 8));
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
