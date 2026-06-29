import { ItemView, WorkspaceLeaf } from "obsidian";
import FishbonePlannerPlugin from "../main";
import { PlanningTask } from "../data/taskTypes";
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

    const toolbar = container.createDiv({ cls: "fishbone-timeline-toolbar" });
    toolbar.createDiv({ cls: "fishbone-timeline-title", text: "鱼骨时间视图" });
    const refreshButton = toolbar.createEl("button", { text: "刷新" });
    refreshButton.addEventListener("click", () => {
      void this.render();
    });

    const [mainlines, tasks] = await Promise.all([
      this.plugin.mainlineRepository.listMainlines(),
      this.plugin.taskRepository.listTasks()
    ]);
    const layout = buildFishboneLayout(tasks, mainlines);

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

    this.renderTimeline(container, layout);
  }

  private renderTimeline(container: Element, layout: FishboneLayout): void {
    const scroller = container.createDiv({ cls: "fishbone-timeline-scroller" });
    const grid = scroller.createDiv({ cls: "fishbone-timeline-grid" });
    grid.style.setProperty("--fishbone-date-count", String(layout.dates.length));

    grid.createDiv({ cls: "fishbone-timeline-corner", text: "主线 / 日期" });
    for (const date of layout.dates) {
      grid.createDiv({ cls: "fishbone-timeline-date", text: date.label });
    }

    for (const lane of layout.lanes) {
      this.renderLane(grid, lane, layout);
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

  private renderLane(grid: HTMLElement, lane: FishboneLane, layout: FishboneLayout): void {
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
        this.renderTaskNode(cell, task);
      }
    }
  }

  private renderTaskNode(parent: HTMLElement, task: PlanningTask): void {
    const node = parent.createDiv({ cls: "fishbone-task-node" });
    node.createDiv({ cls: "fishbone-task-title", text: task.title });
    node.createDiv({ cls: "fishbone-task-meta", text: `${task.status} · ${task.priority}` });
    node.addEventListener("click", () => {
      void this.plugin.taskRepository.openTask(task);
    });
  }
}
