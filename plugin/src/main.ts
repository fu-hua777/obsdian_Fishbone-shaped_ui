import { Notice, Plugin, WorkspaceLeaf } from "obsidian";
import { DEFAULT_SETTINGS, FishbonePlannerSettingTab, FishbonePlannerSettings, normalizePlanningPath } from "./settings";
import { MainlineRepository } from "./data/mainlineRepository";
import { TaskRepository } from "./data/taskRepository";
import { DailySummaryRepository } from "./data/dailySummaryRepository";
import { TASK_LIST_VIEW_TYPE, TaskListView } from "./views/TaskListView";
import { FISHBONE_TIMELINE_VIEW_TYPE, FishboneTimelineView } from "./views/FishboneTimelineView";

export default class FishbonePlannerPlugin extends Plugin {
  settings: FishbonePlannerSettings;
  taskRepository: TaskRepository;
  mainlineRepository: MainlineRepository;
  dailySummaryRepository: DailySummaryRepository;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.rebuildRepositories();

    this.registerView(TASK_LIST_VIEW_TYPE, (leaf: WorkspaceLeaf) => new TaskListView(leaf, this));
    this.registerView(FISHBONE_TIMELINE_VIEW_TYPE, (leaf: WorkspaceLeaf) => new FishboneTimelineView(leaf, this));

    this.addRibbonIcon("list-checks", "打开 Fishbone Planner 任务列表", () => {
      void this.activateTaskListView();
    });

    this.addRibbonIcon("git-fork", "打开 Fishbone Planner 鱼骨时间视图", () => {
      void this.activateTimelineView();
    });

    this.addCommand({
      id: "open-fishbone-task-list",
      name: "打开任务列表",
      callback: () => {
        void this.activateTaskListView();
      }
    });

    this.addCommand({
      id: "refresh-fishbone-task-data",
      name: "刷新任务数据",
      callback: async () => {
        this.rebuildRepositories();
        const leaves = this.app.workspace.getLeavesOfType(TASK_LIST_VIEW_TYPE);
        for (const leaf of leaves) {
          const view = leaf.view;
          if (view instanceof TaskListView) {
            await view.render();
          }
        }
        new Notice("Fishbone Planner 任务数据已刷新");
      }
    });

    this.addCommand({
      id: "open-fishbone-timeline",
      name: "打开鱼骨时间视图",
      callback: () => {
        void this.activateTimelineView();
      }
    });

    this.addCommand({
      id: "refresh-fishbone-timeline",
      name: "刷新鱼骨时间视图",
      callback: async () => {
        this.rebuildRepositories();
        const leaves = this.app.workspace.getLeavesOfType(FISHBONE_TIMELINE_VIEW_TYPE);
        for (const leaf of leaves) {
          const view = leaf.view;
          if (view instanceof FishboneTimelineView) {
            await view.render();
          }
        }
        new Notice("Fishbone Planner 鱼骨时间视图已刷新");
      }
    });

    this.addCommand({
      id: "cycle-first-fishbone-task-status",
      name: "切换第一条任务状态（M3 验证）",
      callback: async () => {
        const tasks = await this.taskRepository.listTasks();
        const firstTask = tasks[0];
        if (!firstTask) {
          new Notice("未找到可切换状态的规划任务");
          return;
        }
        const next = await this.taskRepository.cycleTaskStatus(firstTask);
        if (next) {
          new Notice(`已将第一条任务状态切换为 ${next}`);
        }
      }
    });

    this.addSettingTab(new FishbonePlannerSettingTab(this.app, this));
  }

  onunload(): void {
    this.app.workspace.detachLeavesOfType(TASK_LIST_VIEW_TYPE);
    this.app.workspace.detachLeavesOfType(FISHBONE_TIMELINE_VIEW_TYPE);
  }

  async loadSettings(): Promise<void> {
    const loaded = (await this.loadData()) as Partial<FishbonePlannerSettings> | null;
    this.settings = {
      ...DEFAULT_SETTINGS,
      ...loaded
    };
    this.settings.planningSystemPath = normalizePlanningPath(this.settings.planningSystemPath);
  }

  async saveSettings(): Promise<void> {
    this.settings.planningSystemPath = normalizePlanningPath(this.settings.planningSystemPath);
    await this.saveData(this.settings);
    this.rebuildRepositories();
  }

  async saveFishboneViewState(): Promise<void> {
    await this.saveData(this.settings);
  }

  rebuildRepositories(): void {
    this.taskRepository = new TaskRepository(this.app, this.settings.planningSystemPath);
    this.mainlineRepository = new MainlineRepository(this.app, this.settings.planningSystemPath);
    this.dailySummaryRepository = new DailySummaryRepository(this.app, this.settings.planningSystemPath);
  }

  async activateTaskListView(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(TASK_LIST_VIEW_TYPE);
    if (existing.length > 0) {
      this.app.workspace.revealLeaf(existing[0]);
      return;
    }

    const leaf = this.app.workspace.getRightLeaf(false);
    if (!leaf) {
      new Notice("无法打开 Fishbone Planner 任务列表");
      return;
    }
    await leaf.setViewState({ type: TASK_LIST_VIEW_TYPE, active: true });
    this.app.workspace.revealLeaf(leaf);
  }

  async activateTimelineView(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(FISHBONE_TIMELINE_VIEW_TYPE);
    if (existing.length > 0) {
      this.app.workspace.revealLeaf(existing[0]);
      return;
    }

    const leaf = this.app.workspace.getLeaf(true);
    await leaf.setViewState({ type: FISHBONE_TIMELINE_VIEW_TYPE, active: true });
    this.app.workspace.revealLeaf(leaf);
  }
}
