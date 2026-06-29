import { ItemView, Notice, WorkspaceLeaf } from "obsidian";
import FishbonePlannerPlugin from "../main";
import { PlanningTask } from "../data/taskTypes";

export const TASK_LIST_VIEW_TYPE = "fishbone-planner-task-list";

export class TaskListView extends ItemView {
  private plugin: FishbonePlannerPlugin;

  constructor(leaf: WorkspaceLeaf, plugin: FishbonePlannerPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return TASK_LIST_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Fishbone Planner 任务列表";
  }

  async onOpen(): Promise<void> {
    await this.render();
  }

  async render(): Promise<void> {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("fishbone-planner-view");

    const toolbar = container.createDiv({ cls: "fishbone-planner-toolbar" });
    toolbar.createDiv({ cls: "fishbone-planner-title", text: "规划任务列表" });
    const refreshButton = toolbar.createEl("button", { text: "刷新" });
    refreshButton.addEventListener("click", () => {
      void this.render();
    });

    const mainlines = await this.plugin.mainlineRepository.listMainlines();
    const tasks = await this.plugin.taskRepository.listTasks();

    const summary = container.createDiv({ cls: "fishbone-planner-summary" });
    summary.createSpan({ text: `任务 ${tasks.length}` });
    summary.createSpan({ text: `主线 ${mainlines.length}` });
    if (mainlines.length === 0) {
      container.createDiv({
        cls: "fishbone-planner-warning",
        text: "当前没有主线。任务会显示为未分配；后续由用户通过 UI 创建主线。"
      });
    }

    if (tasks.length === 0) {
      container.createDiv({
        cls: "fishbone-planner-empty",
        text: "未找到标准规划任务。请确认 PlanningSystem/Tasks 下存在 planning-task md。"
      });
      return;
    }

    const list = container.createDiv({ cls: "fishbone-planner-list" });
    for (const task of tasks) {
      this.renderTask(list, task);
    }
  }

  private renderTask(parent: HTMLElement, task: PlanningTask): void {
    const row = parent.createDiv({ cls: "fishbone-planner-task" });
    const titleWrap = row.createDiv();
    titleWrap.createDiv({ cls: "fishbone-planner-task-title", text: task.title });
    titleWrap.createDiv({
      cls: "fishbone-planner-meta",
      text: `${task.date ?? "无日期"} · ${task.mainline ?? "未分配"} · ${task.priority}`
    });

    row.createSpan({ cls: "fishbone-planner-pill", text: task.status });

    const statusButton = row.createEl("button", { text: "切换状态" });
    statusButton.addEventListener("click", async () => {
      const next = await this.plugin.taskRepository.cycleTaskStatus(task);
      if (next) {
        new Notice(`任务状态已更新为 ${next}`);
        await this.render();
      }
    });

    const openButton = row.createEl("button", { text: "打开" });
    openButton.addEventListener("click", () => {
      void this.plugin.taskRepository.openTask(task);
    });
  }
}
