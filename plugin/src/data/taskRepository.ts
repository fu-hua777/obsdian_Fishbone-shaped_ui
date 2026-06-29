import { App, Notice, TFile, normalizePath } from "obsidian";
import { parsePlanningTask } from "./taskParser";
import { PlanningTask, TaskStatus, nextStatus } from "./taskTypes";

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
    const file = this.getTaskFile(task.path);
    if (!file) {
      new Notice(`找不到任务文件：${task.path}`);
      return null;
    }

    const status = nextStatus(task.status);
    await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
      frontmatter.status = status;
      frontmatter.updated = formatLocalDateTime(new Date());
    });
    await this.waitForFrontmatter(file, (frontmatter) => frontmatter.status === status);
    return status;
  }

  async setTaskMainline(task: PlanningTask, mainline: string | null): Promise<void> {
    const file = this.getTaskFile(task.path);
    if (!file) {
      new Notice(`找不到任务文件：${task.path}`);
      return;
    }

    await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
      frontmatter.mainline = mainline;
      frontmatter.updated = formatLocalDateTime(new Date());
    });
    await this.waitForFrontmatter(file, (frontmatter) => frontmatter.mainline === mainline);
  }

  async setTaskDone(task: PlanningTask, done: boolean): Promise<TaskStatus | null> {
    const file = this.getTaskFile(task.path);
    if (!file) {
      new Notice(`找不到任务文件：${task.path}`);
      return null;
    }

    const status: TaskStatus = done ? "done" : "todo";
    await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
      frontmatter.status = status;
      frontmatter.updated = formatLocalDateTime(new Date());
    });
    await this.waitForFrontmatter(file, (frontmatter) => frontmatter.status === status);
    return status;
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

function formatLocalDateTime(date: Date): string {
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
