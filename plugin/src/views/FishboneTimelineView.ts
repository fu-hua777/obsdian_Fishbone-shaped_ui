import { ItemView, Notice, WorkspaceLeaf } from "obsidian";
import FishbonePlannerPlugin from "../main";
import { Mainline, PlanningTask } from "../data/taskTypes";
import { buildFishboneLayout } from "./fishboneLayout";
import { FishboneLane, FishboneLayout } from "./fishboneRenderTypes";

export const FISHBONE_TIMELINE_VIEW_TYPE = "fishbone-planner-timeline";

export class FishboneTimelineView extends ItemView {
  private plugin: FishbonePlannerPlugin;

  constructor(leaf: WorkspaceLeaf, plugin: FishbonePlannerPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return FISHBONE_TIMELINE_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Fishbone Planner 鱼骨时间视图";
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
    const layout = buildFishboneLayout(tasks, mainlines);

    const toolbar = container.createDiv({ cls: "fishbone-timeline-toolbar" });
    toolbar.createDiv({ cls: "fishbone-timeline-title", text: "鱼骨时间视图" });
    this.renderMainlineCreator(toolbar);

    const refreshButton = toolbar.createEl("button", { text: "刷新" });
    refreshButton.addEventListener("click", () => {
      void this.render();
    });

    const summary = container.createDiv({ cls: "fishbone-timeline-summary" });
    summary.createSpan({ text: `任务 ${tasks.length}` });
    summary.createSpan({ text: `主线 ${mainlines.length}` });
    summary.createSpan({ text: `日期 ${layout.dates.length}` });
    summary.createSpan({ text: `关系 ${layout.relationLines.length}` });

    if (mainlines.length === 0) {
      container.createDiv({
        cls: "fishbone-timeline-warning",
        text: "当前没有用户主线。系统不会创建默认主线；未分配任务会显示在临时泳道中。"
      });
    }

    this.renderTimeline(container, layout, mainlines);
  }

  private renderMainlineCreator(toolbar: HTMLElement): void {
    const form = toolbar.createDiv({ cls: "fishbone-mainline-form" });
    const nameInput = form.createEl("input", {
      attr: {
        type: "text",
        placeholder: "主线名称"
      }
    });
    const colorInput = form.createEl("input", {
      attr: {
        type: "color",
        value: "#4f8cff",
        "aria-label": "主线颜色"
      }
    });
    const createButton = form.createEl("button", { text: "新建主线" });
    createButton.addEventListener("click", async (event) => {
      event.preventDefault();
      try {
        await this.plugin.mainlineRepository.createMainline(nameInput.value, colorInput.value);
        new Notice(`已创建主线：${nameInput.value.trim()}`);
        await this.render();
      } catch (error) {
        new Notice(error instanceof Error ? error.message : "创建主线失败");
      }
    });
  }

  private renderTimeline(container: Element, layout: FishboneLayout, mainlines: Mainline[]): void {
    const scroller = container.createDiv({ cls: "fishbone-timeline-scroller" });
    const grid = scroller.createDiv({ cls: "fishbone-timeline-grid" });
    grid.style.setProperty("--fishbone-date-count", String(layout.dates.length));

    grid.createDiv({ cls: "fishbone-timeline-corner", text: "主线 / 日期" });
    for (const date of layout.dates) {
      grid.createDiv({ cls: "fishbone-timeline-date", text: date.label });
    }

    for (const lane of layout.lanes) {
      this.renderLane(grid, lane, layout, mainlines);
    }

    if (layout.relationLines.length > 0) {
      const relationPanel = container.createDiv({ cls: "fishbone-relation-panel" });
      relationPanel.createDiv({ cls: "fishbone-relation-title", text: "Relations" });
      for (const line of layout.relationLines) {
        relationPanel.createDiv({
          cls: "fishbone-relation-line",
          text: `${line.sourceTaskId} --${line.relation.type}--> ${line.targetTitle}`
        });
      }
    }
  }

  private renderLane(grid: HTMLElement, lane: FishboneLane, layout: FishboneLayout, mainlines: Mainline[]): void {
    const label = grid.createDiv({ cls: "fishbone-lane-label" });
    label.style.setProperty("--lane-color", lane.color);
    label.createDiv({ cls: "fishbone-lane-dot" });
    label.createDiv({ cls: "fishbone-lane-name", text: lane.name });

    for (const date of layout.dates) {
      const cell = grid.createDiv({ cls: "fishbone-lane-cell" });
      cell.style.setProperty("--lane-color", lane.color);
      cell.createDiv({ cls: "fishbone-spine" });
      const tasks = lane.tasksByDate[date.id] ?? [];
      for (const task of tasks) {
        this.renderTaskNode(cell, task, mainlines);
      }
    }
  }

  private renderTaskNode(parent: HTMLElement, task: PlanningTask, mainlines: Mainline[]): void {
    const node = parent.createDiv({ cls: "fishbone-task-node" });
    const header = node.createDiv({ cls: "fishbone-task-header" });
    const checkbox = header.createEl("input", {
      attr: {
        type: "checkbox",
        "aria-label": "切换任务完成状态"
      }
    });
    checkbox.checked = task.status === "done";
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
    node.createDiv({ cls: "fishbone-task-meta", text: `${task.status} · ${task.priority}` });

    if (mainlines.length > 0) {
      const select = node.createEl("select", { cls: "fishbone-task-mainline-select" });
      select.createEl("option", { text: "未分配", value: "" });
      for (const mainline of mainlines) {
        select.createEl("option", { text: mainline.name, value: mainline.name });
      }
      select.value = task.mainline ?? "";
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
}
