import { App, Notice, TFile, normalizePath } from "obsidian";
import { parsePlanningTask } from "./taskParser";
import { PlanningTask, TaskPriority, TaskStatus, nextStatus } from "./taskTypes";

export interface TaskFieldPatch {
  title?: string;
  date?: string | null;
  mainline?: string | null;
  branchMainline?: string | null;
  branchMainlineId?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
}

export class TaskRepository {
  private app: App;
  private planningSystemPath: string;

  constructor(app: App, planningSystemPath: string) {
    this.app = app;
    this.planningSystemPath = planningSystemPath;
  }

  async listTasks(): Promise<PlanningTask[]> {
    const taskRoot = normalizePath(`${this.planningSystemPath}/Tasks/`);
    const files = this.app.vault
      .getMarkdownFiles()
      .filter((file) => file.path.startsWith(taskRoot));

    const tasks: PlanningTask[] = [];
    for (const file of files) {
      const cache = this.app.metadataCache.getFileCache(file);
      const task = parsePlanningTask(file, cache?.frontmatter);
      if (task) {
        tasks.push(task);
      }
    }

    return tasks.sort((a, b) => {
      const dateCompare = (a.date ?? "9999-99-99").localeCompare(b.date ?? "9999-99-99");
      if (dateCompare !== 0) return dateCompare;
      return a.title.localeCompare(b.title);
    });
  }

  async openTask(task: PlanningTask): Promise<void> {
    const file = this.getTaskFile(task.path);
    if (!file) {
      new Notice(`找不到任务文件：${task.path}`);
      return;
    }
    await this.app.workspace.getLeaf(false).openFile(file);
  }

  async cycleTaskStatus(task: PlanningTask): Promise<TaskStatus | null> {
    const status = nextStatus(task.status);
    await this.updateTaskFields(task, { status });
    return status;
  }

  async setTaskMainline(task: PlanningTask, mainline: string | null): Promise<void> {
    await this.updateTaskFields(task, { mainline });
  }

  async setTaskDone(task: PlanningTask, done: boolean): Promise<TaskStatus | null> {
    const status: TaskStatus = done ? "done" : "todo";
    await this.updateTaskFields(task, { status });
    return status;
  }

  async setTaskDate(task: PlanningTask, date: string | null): Promise<void> {
    await this.updateTaskFields(task, { date });
  }

  async setTaskPriority(task: PlanningTask, priority: TaskPriority): Promise<void> {
    await this.updateTaskFields(task, { priority });
  }

  async setTaskStatus(task: PlanningTask, status: TaskStatus): Promise<void> {
    await this.updateTaskFields(task, { status });
  }

  async updateTaskFields(task: PlanningTask, patch: TaskFieldPatch): Promise<void> {
    const file = this.getTaskFile(task.path);
    if (!file) {
      new Notice(`找不到任务文件：${task.path}`);
      return;
    }

    await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
      if (typeof patch.title !== "undefined") {
        frontmatter.title = patch.title;
      }
      if (typeof patch.date !== "undefined") {
        frontmatter.date = patch.date;
      }
      if (typeof patch.mainline !== "undefined") {
        frontmatter.mainline = patch.mainline;
      }
      if (typeof patch.branchMainline !== "undefined") {
        frontmatter.branch_mainline = patch.branchMainline;
      }
      if (typeof patch.branchMainlineId !== "undefined") {
        frontmatter.branch_mainline_id = patch.branchMainlineId;
      }
      if (typeof patch.status !== "undefined") {
        frontmatter.status = patch.status;
      }
      if (typeof patch.priority !== "undefined") {
        frontmatter.priority = patch.priority;
      }
      frontmatter.updated = formatLocalDateTime(new Date());
    });

    await this.waitForFrontmatter(file, (frontmatter) => {
      return Object.entries(patch).every(([key, value]) => frontmatter[frontmatterKeyForPatch(key)] === value);
    });
  }

  private getTaskFile(filePath: string): TFile | null {
    const file = this.app.vault.getAbstractFileByPath(filePath);
    return file instanceof TFile ? file : null;
  }

  private async waitForFrontmatter(
    file: TFile,
    predicate: (frontmatter: Record<string, unknown>) => boolean
  ): Promise<void> {
    for (let attempt = 0; attempt < 12; attempt++) {
      const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
      if (frontmatter && predicate(frontmatter)) {
        return;
      }
      await sleep(100);
    }
  }
}

function frontmatterKeyForPatch(key: string): string {
  switch (key) {
    case "branchMainline":
      return "branch_mainline";
    case "branchMainlineId":
      return "branch_mainline_id";
    default:
      return key;
  }
}

function formatLocalDateTime(date: Date): string {
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
