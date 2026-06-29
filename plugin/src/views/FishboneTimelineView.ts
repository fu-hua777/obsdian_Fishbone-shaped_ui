import { ItemView, Menu, Modal, Notice, Setting, WorkspaceLeaf } from "obsidian";
import FishbonePlannerPlugin from "../main";
import { Mainline, PlanningTask } from "../data/taskTypes";
import {
  buildFishboneCanvasLayout,
  FishboneCanvasLane,
  FishboneCanvasLayout,
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

export class FishboneTimelineView extends ItemView {
  private plugin: FishbonePlannerPlugin;
  private viewport: FishboneCanvasViewport = createDefaultFishboneCanvasViewport();
  private panDrag: { pointerId: number; x: number; y: number } | null = null;

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
    this.renderMainlineCreator(toolbar);

    const refreshButton = toolbar.createEl("button", { text: "刷新" });
    refreshButton.addEventListener("click", () => {
      void this.render();
    });

    const summary = container.createDiv({ cls: "fishbone-timeline-summary" });
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
    this.bindCanvasViewport(canvas);

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

    const laneLayer = stage.createDiv({ cls: "fishbone-mainline-layer" });
    for (const lane of layout.lanes) {
      this.renderCanvasLane(laneLayer, lane, mainlines);
    }

    const taskLayer = stage.createDiv({ cls: "fishbone-task-layer" });
    for (const taskNode of layout.tasks) {
      this.renderCanvasTaskNode(taskLayer, taskNode, mainlines);
    }

    const labelLayer = canvas.createDiv({ cls: "fishbone-canvas-label-layer" });
    for (const lane of layout.lanes) {
      this.renderCanvasLaneLabel(labelLayer, lane, mainlines);
    }
    this.applyCanvasTransform(canvas);
  }

  private bindCanvasViewport(canvas: HTMLElement): void {
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
        this.openEditMainlineModal(mainline);
      });
      this.bindMainlineContextMenu(label, mainline);
      this.bindMainlineDrag(label, mainline);
    }
  }

  private renderCanvasLaneLabel(layer: HTMLElement, lane: FishboneCanvasLane, mainlines: Mainline[]): void {
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
        this.openEditMainlineModal(mainline);
      });
      this.bindMainlineContextMenu(label, mainline);
      this.bindMainlineDrag(label, mainline);
    }
  }

  private renderCanvasTaskNode(parent: HTMLElement, taskNode: FishboneCanvasTaskNode, mainlines: Mainline[]): void {
    const task = taskNode.task;
    const node = parent.createDiv({
      cls: `fishbone-task-node fishbone-task-${task.status} fishbone-priority-${task.priority} fishbone-branch-${taskNode.branchSide}`
    });
    node.style.setProperty("--lane-color", taskNode.color);
    node.setAttr("data-lane-id", taskNode.laneId);
    node.style.left = `${taskNode.x}px`;
    node.style.top = `${taskNode.y}px`;
    node.style.setProperty("--branch-index", String(taskNode.branchIndex));
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

    node.addEventListener("click", () => {
      void this.plugin.taskRepository.openTask(task);
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

  private bindMainlineDrag(label: HTMLElement, mainline: Mainline): void {
    let timer: number | null = null;

    const clearTimer = () => {
      if (timer !== null) {
        window.clearTimeout(timer);
        timer = null;
      }
    };

    label.addEventListener("pointerdown", () => {
      clearTimer();
      timer = window.setTimeout(() => {
        label.draggable = true;
        label.addClass("fishbone-lane-drag-ready");
      }, 450);
    });
    label.addEventListener("pointerup", clearTimer);
    label.addEventListener("pointerleave", clearTimer);
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
