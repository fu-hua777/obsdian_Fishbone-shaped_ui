import { ItemView, Menu, Modal, Notice, Setting, WorkspaceLeaf } from "obsidian";
import FishbonePlannerPlugin from "../main";
import { TaskFieldPatch } from "../data/taskRepository";
import { Mainline, PlanningTask, TaskPriority, TaskStatus } from "../data/taskTypes";
import {
  buildFishboneCanvasLayout,
  canvasPointToDate,
  canvasPointToLane,
  canvasPointToMainline,
  clientPointToCanvasPoint,
  FishboneCanvasLane,
  FishboneCanvasLayout,
  FishboneCanvasRelationLine,
  FishboneCanvasTaskNode
} from "./fishboneCanvasLayout";
import {
  createDefaultFishboneCanvasViewport,
  FishboneCanvasViewport,
  formatPercent,
  panCanvasViewport,
  resetCanvasViewport,
  setFocusedLane,
  zoomCanvasViewport,
  zoomLane,
  zoomTimeScale
} from "./fishboneCanvasViewport";

export const FISHBONE_TIMELINE_VIEW_TYPE = "fishbone-planner-timeline";
const TASK_STATUSES: TaskStatus[] = ["todo", "doing", "done", "blocked", "canceled", "inbox"];
const TASK_PRIORITIES: TaskPriority[] = ["high", "medium", "low"];

export class FishboneTimelineView extends ItemView {
  private plugin: FishbonePlannerPlugin;
  private viewport: FishboneCanvasViewport = createDefaultFishboneCanvasViewport();
  private showRelations = true;
  private panDrag: { pointerId: number; x: number; y: number } | null = null;
  private suppressNextMainlineClick = false;
  private suppressNextTaskClick = false;
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

  constructor(leaf: WorkspaceLeaf, plugin: FishbonePlannerPlugin) {
    super(leaf);
    this.plugin = plugin;
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
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("fishbone-timeline-view");

    const [mainlines, tasks] = await Promise.all([
      this.plugin.mainlineRepository.listMainlines(),
      this.plugin.taskRepository.listTasks()
    ]);
    const layout = buildFishboneCanvasLayout(tasks, mainlines, this.viewport);

    const toolbar = container.createDiv({ cls: "fishbone-timeline-toolbar" });
    toolbar.createDiv({ cls: "fishbone-timeline-title", text: "鱼骨画布视图" });
    this.renderViewportControls(toolbar);
    this.renderRelationControls(toolbar);
    this.renderMainlineCreator(toolbar);

    const refreshButton = toolbar.createEl("button", { text: "刷新" });
    refreshButton.addEventListener("click", () => {
      void this.render();
    });

    const summary = container.createDiv({ cls: "fishbone-timeline-summary" });
    summary.createSpan({ text: `relations ${layout.relationLines.length}` });
    summary.createSpan({ text: `任务 ${tasks.length}` });
    summary.createSpan({ text: `主线 ${mainlines.length}` });
    summary.createSpan({ text: `日期刻度 ${layout.dateTicks.length}` });
    summary.createSpan({ text: `画布 ${formatPercent(this.viewport.canvasZoom)}` });
    summary.createSpan({ text: `时间 ${Math.round(this.viewport.timeScale)}px/天` });
    if (this.viewport.focusedLaneId) {
      const laneZoom = this.viewport.laneZooms[this.viewport.focusedLaneId] ?? 1;
      summary.createSpan({ text: `主线 ${formatPercent(laneZoom)}` });
    }

    if (mainlines.length === 0) {
      container.createDiv({
        cls: "fishbone-timeline-warning",
        text: "当前没有用户主线。系统不会创建默认主线；未分配任务会显示在临时泳道中。"
      });
    }

    this.renderCanvas(container, layout, mainlines);
  }

  private renderViewportControls(toolbar: HTMLElement): void {
    const controls = toolbar.createDiv({ cls: "fishbone-viewport-controls" });
    controls.createEl("button", { text: "重置视图" }).addEventListener("click", async () => {
      this.viewport = resetCanvasViewport(this.viewport);
      await this.render();
    });
    controls.createDiv({ cls: "fishbone-viewport-label", text: `中心 ${this.viewport.centerDate}` });
    controls.createDiv({ cls: "fishbone-zoom-label", text: formatPercent(this.viewport.canvasZoom) });
    controls.createDiv({ cls: "fishbone-zoom-label", text: `${Math.round(this.viewport.timeScale)}px/天` });
  }

  private renderRelationControls(toolbar: HTMLElement): void {
    const button = toolbar.createEl("button", { text: this.showRelations ? "隐藏关系" : "显示关系" });
    button.addEventListener("click", async () => {
      this.showRelations = !this.showRelations;
      await this.render();
    });
  }

  private renderMainlineCreator(toolbar: HTMLElement): void {
    const actionGroup = toolbar.createDiv({ cls: "fishbone-toolbar-actions" });
    const createButton = actionGroup.createEl("button", { text: "新建主线" });
    createButton.addEventListener("click", async (event) => {
      event.preventDefault();
      new MainlineEditorModal(this.plugin, {
        title: "新建主线",
        submitText: "创建",
        name: "",
        color: "#4f8cff",
        onSubmit: async (name, color) => {
          await this.plugin.mainlineRepository.createMainline(name, color);
          new Notice(`已创建主线：${name.trim()}`);
          await this.render();
        }
      }).open();
    });
  }

  private renderCanvas(container: Element, layout: FishboneCanvasLayout, mainlines: Mainline[]): void {
    const canvas = container.createDiv({ cls: "fishbone-canvas-viewport" });
    this.bindCanvasViewport(canvas, layout, mainlines);

    const stage = canvas.createDiv({ cls: "fishbone-canvas-stage" });
    stage.style.width = `${layout.stageWidth}px`;
    stage.style.height = `${layout.stageHeight}px`;
    this.applyStageTransform(stage);

    const dateLayer = stage.createDiv({ cls: "fishbone-date-axis-layer" });
    for (const tick of layout.dateTicks) {
      const tickEl = dateLayer.createDiv({
        cls: `fishbone-date-tick${tick.isToday ? " is-today" : ""}${tick.isWeekend ? " is-weekend" : ""}`
      });
      tickEl.style.left = `${tick.x}px`;
      tickEl.style.top = `${tick.y}px`;
      tickEl.createDiv({ cls: "fishbone-date-label", text: tick.label });
      tickEl.createDiv({ cls: "fishbone-date-detail", text: tick.detail });
    }

    if (this.showRelations) {
      this.renderRelationLayer(stage, layout.relationLines);
    }

    const laneLayer = stage.createDiv({ cls: "fishbone-mainline-layer" });
    for (const lane of layout.lanes) {
      this.renderCanvasLane(laneLayer, lane, mainlines);
    }

    const taskLayer = stage.createDiv({ cls: "fishbone-task-layer" });
    for (const taskNode of layout.tasks) {
      this.renderCanvasTaskNode(taskLayer, taskNode, mainlines, layout);
    }

    const labelLayer = canvas.createDiv({ cls: "fishbone-canvas-label-layer" });
    for (const lane of layout.lanes) {
      this.renderCanvasLaneLabel(labelLayer, lane, mainlines, layout);
    }
    canvas.createDiv({ cls: "fishbone-task-drop-hint" });
    this.applyCanvasTransform(canvas);
  }

  private renderRelationLayer(stage: HTMLElement, relationLines: FishboneCanvasRelationLine[]): void {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.addClass("fishbone-relation-layer");
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
      group.addClass(`fishbone-relation ${line.className}`);
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

  private bindCanvasViewport(canvas: HTMLElement, layout: FishboneCanvasLayout, mainlines: Mainline[]): void {
    canvas.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || isInteractiveTarget(event.target)) return;
      canvas.setPointerCapture(event.pointerId);
      this.panDrag = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY
      };
      canvas.addClass("is-panning");
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
      }
    };
    canvas.addEventListener("pointerup", endPan);
    canvas.addEventListener("pointercancel", endPan);

    canvas.addEventListener("wheel", async (event) => {
      if (!event.ctrlKey && !event.altKey) return;
      event.preventDefault();
      const lane = (event.target as HTMLElement | null)?.closest(".fishbone-canvas-lane, .fishbone-task-node, .fishbone-canvas-lane-label") as HTMLElement | null;
      const axis = (event.target as HTMLElement | null)?.closest(".fishbone-date-tick");
      if (event.altKey || axis) {
        this.viewport = zoomTimeScale(this.viewport, event.deltaY);
      } else if (lane?.dataset.laneId) {
        this.viewport = zoomLane(this.viewport, lane.dataset.laneId, event.deltaY);
      } else {
        const rect = canvas.getBoundingClientRect();
        this.viewport = zoomCanvasViewport(this.viewport, event.deltaY, {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top
        });
      }
      await this.render();
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

  private applyStageTransform(stage: HTMLElement): void {
    stage.style.transform = `translate(${this.viewport.panX}px, ${this.viewport.panY}px) scale(${this.viewport.canvasZoom})`;
  }

  private applyCanvasTransform(canvas: HTMLElement): void {
    const stage = canvas.querySelector(".fishbone-canvas-stage") as HTMLElement | null;
    if (stage) this.applyStageTransform(stage);

    const labels = canvas.querySelectorAll<HTMLElement>(".fishbone-canvas-lane-label");
    labels.forEach((label) => {
      const spineY = Number(label.dataset.laneSpineY ?? 0);
      label.style.top = `${this.viewport.panY + spineY * this.viewport.canvasZoom}px`;
    });
  }

  private renderCanvasLane(layer: HTMLElement, lane: FishboneCanvasLane, mainlines: Mainline[]): void {
    const laneEl = layer.createDiv({ cls: `fishbone-canvas-lane${lane.isUnassigned ? " is-unassigned" : ""}` });
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

    const label = laneEl.createDiv({ cls: "fishbone-canvas-lane-label" });
    label.createDiv({ cls: "fishbone-lane-dot" });
    const mainline = mainlines.find((item) => item.id === lane.id);
    const name = label.createDiv({ cls: "fishbone-lane-name", text: lane.name });
    if (mainline) {
      label.addClass("fishbone-lane-label-interactive");
      name.setAttr("title", "点击修改；右键删除；长按拖动排序");
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
    }
  }

  private renderCanvasLaneLabel(layer: HTMLElement, lane: FishboneCanvasLane, mainlines: Mainline[], layout: FishboneCanvasLayout): void {
    const label = layer.createDiv({ cls: `fishbone-canvas-lane-label${lane.isUnassigned ? " is-unassigned" : ""}` });
    label.style.setProperty("--lane-color", lane.color);
    label.setAttr("data-lane-id", lane.id);
    label.setAttr("data-lane-spine-y", String(lane.spineY));
    label.createDiv({ cls: "fishbone-lane-dot" });

    const text = label.createDiv({ cls: "fishbone-lane-text" });
    const name = text.createDiv({ cls: "fishbone-lane-name", text: lane.name });
    text.createDiv({ cls: "fishbone-lane-kind", text: lane.isUnassigned ? "未分配任务" : "用户主线" });

    const mainline = mainlines.find((item) => item.id === lane.id);
    if (mainline) {
      label.addClass("fishbone-lane-label-interactive");
      name.setAttr("title", "点击修改；右键删除；长按拖动排序");
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
      cls: `fishbone-task-node fishbone-task-${task.status} fishbone-priority-${task.priority} fishbone-branch-${taskNode.branchSide}`
    });
    node.style.setProperty("--lane-color", taskNode.color);
    node.setAttr("data-lane-id", taskNode.laneId);
    node.setAttr("data-task-id", task.taskId);
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
    const meta = node.createDiv({ cls: "fishbone-task-meta" });
    meta.createSpan({ cls: "fishbone-task-status", text: task.status });
    meta.createSpan({ cls: "fishbone-task-priority", text: formatPriority(task.priority) });

    if (mainlines.length > 0) {
      const select = node.createEl("select", { cls: "fishbone-task-mainline-select" });
      select.createEl("option", { text: "未分配", value: "" });
      for (const mainline of mainlines) {
        select.createEl("option", { text: mainline.name, value: mainline.name });
      }
      select.value = task.mainline ?? "";
      select.addEventListener("pointerdown", (event) => {
        event.stopPropagation();
      });
      select.addEventListener("click", (event) => {
        event.stopPropagation();
      });
      select.addEventListener("change", async (event) => {
        event.stopPropagation();
        const value = select.value.length > 0 ? select.value : null;
        await this.plugin.taskRepository.setTaskMainline(task, value);
        new Notice(value ? `任务已分配到主线：${value}` : "任务已移回未分配");
        await this.render();
      });
    }

    node.addEventListener("mouseenter", () => {
      this.showTaskTooltip(node, task);
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

  private showTaskTooltip(node: HTMLElement, task: PlanningTask): void {
    if (this.taskPointerDrag?.active) return;
    node.querySelector(".fishbone-task-tooltip")?.remove();
    const tooltip = node.createDiv({ cls: "fishbone-task-tooltip" });
    tooltip.createDiv({ cls: "fishbone-task-tooltip-title", text: task.title });
    tooltip.createDiv({ text: `日期：${task.date ?? "无日期"}` });
    tooltip.createDiv({ text: `主线：${task.mainline ?? "未分配"}` });
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
      const targetDate = canvasPointToDate(point, this.viewport);
      const targetMainline = canvasPointToMainline(drag.layout.lanes, point);
      if (typeof targetMainline === "undefined") {
        this.applyCanvasTransform(drag.canvas);
        return;
      }
      await this.plugin.taskRepository.updateTaskFields(drag.taskNode.task, {
        date: targetDate,
        mainline: targetMainline
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
      }, 260);
    });

    node.addEventListener("pointermove", (event) => {
      const drag = this.taskPointerDrag;
      if (!drag || drag.pointerId !== event.pointerId || !drag.active) return;
      event.preventDefault();
      event.stopPropagation();
      const point = clientPointToCanvasPoint(event.clientX, event.clientY, drag.canvas.getBoundingClientRect(), this.viewport);
      node.style.left = `${point.x}px`;
      node.style.top = `${point.y}px`;
      this.updateTaskDropHint(drag.canvas, drag.layout, point);
    });

    node.addEventListener("pointerup", (event) => {
      void finishTaskDrag(event);
    });
    node.addEventListener("pointercancel", (event) => {
      void finishTaskDrag(event);
    });
  }

  private updateTaskDropHint(canvas: HTMLElement, layout: FishboneCanvasLayout, point: { x: number; y: number }): void {
    const hint = canvas.querySelector<HTMLElement>(".fishbone-task-drop-hint");
    if (!hint) return;
    const lane = canvasPointToLane(layout.lanes, point);
    const date = canvasPointToDate(point, this.viewport);
    hint.setText(`${date ?? "无日期"} · ${lane?.name ?? "无主线"}`);
    hint.addClass("is-visible");
  }

  private hideTaskDropHint(canvas: HTMLElement): void {
    const hint = canvas.querySelector<HTMLElement>(".fishbone-task-drop-hint");
    if (!hint) return;
    hint.removeClass("is-visible");
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

  private bindMainlineContextMenu(label: HTMLElement, mainline: Mainline): void {
    label.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      const menu = new Menu();
      menu.addItem((item) => {
        item
          .setTitle("修改主线")
          .setIcon("pencil")
          .onClick(() => this.openEditMainlineModal(mainline));
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
      }, 260);
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
    label.addEventListener("dragstart", (event) => {
      if (!label.draggable) {
        event.preventDefault();
        return;
      }
      event.dataTransfer?.setData("text/fishbone-mainline-id", mainline.id);
      label.addClass("fishbone-lane-dragging");
    });
    label.addEventListener("dragover", (event) => {
      event.preventDefault();
      label.removeClass("fishbone-lane-drop-before");
      label.removeClass("fishbone-lane-drop-after");
      label.addClass(getDropPlacement(label, event) === "before" ? "fishbone-lane-drop-before" : "fishbone-lane-drop-after");
    });
    label.addEventListener("dragleave", () => {
      label.removeClass("fishbone-lane-drop-before");
      label.removeClass("fishbone-lane-drop-after");
    });
    label.addEventListener("drop", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      const sourceId = event.dataTransfer?.getData("text/fishbone-mainline-id");
      if (!sourceId || sourceId === mainline.id) return;
      const placement = getDropPlacement(label, event);
      await this.plugin.mainlineRepository.moveMainline(sourceId, mainline.id, placement);
      new Notice("主线排序已更新");
      await this.render();
    });
    label.addEventListener("dragend", () => {
      clearTimer();
      label.draggable = false;
      label.removeClass("fishbone-lane-drag-ready");
      label.removeClass("fishbone-lane-dragging");
      label.removeClass("fishbone-lane-drop-before");
      label.removeClass("fishbone-lane-drop-after");
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

class TaskEditorModal extends Modal {
  private task: PlanningTask;
  private mainlines: Mainline[];
  private onSubmit: (patch: TaskFieldPatch) => Promise<void>;
  private title: string;
  private date: string;
  private mainline: string;
  private status: TaskStatus;
  private priority: TaskPriority;

  constructor(
    plugin: FishbonePlannerPlugin,
    task: PlanningTask,
    mainlines: Mainline[],
    onSubmit: (patch: TaskFieldPatch) => Promise<void>
  ) {
    super(plugin.app);
    this.task = task;
    this.mainlines = mainlines;
    this.onSubmit = onSubmit;
    this.title = task.title;
    this.date = task.date ?? "";
    this.mainline = task.mainline ?? "";
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
        for (const mainline of this.mainlines) {
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
            await this.onSubmit({
              title,
              date: this.date.length > 0 ? this.date : null,
              mainline: this.mainline.length > 0 ? this.mainline : null,
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

function getDropPlacement(target: HTMLElement, event: DragEvent): "before" | "after" {
  const rect = target.getBoundingClientRect();
  return event.clientY < rect.top + rect.height / 2 ? "before" : "after";
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

function isInteractiveTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(target.closest("button, input, select, textarea, .fishbone-task-node, .fishbone-canvas-lane-label"));
}

function isFormTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(target.closest("button, input, select, textarea"));
}
