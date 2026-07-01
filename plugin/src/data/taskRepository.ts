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

export interface CreatePlanningTaskInput {
  title: string;
  date: string | null;
  mainline: string | null;
  branchMainline?: string | null;
  branchMainlineId?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  sourceType?: "manual" | "quick-input";
  sourceExcerpt?: string;
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

  async createTask(input: CreatePlanningTaskInput): Promise<TFile> {
    const title = input.title.trim();
    if (!title) {
      throw new Error("任务标题不能为空");
    }

    const now = new Date();
    const created = formatLocalDateTime(now);
    const taskId = createTaskId(now);
    const folderPath = normalizePath(input.date ? `${this.planningSystemPath}/Tasks/${input.date.slice(0, 4)}/${input.date.slice(5, 7)}` : `${this.planningSystemPath}/Tasks/inbox`);
    await ensureFolder(this.app, folderPath);

    const fileName = `${input.date ?? "inbox"}_${input.mainline ?? "未分配"}_${title}.md`;
    const path = await getAvailableTaskPath(this.app, folderPath, fileName);
    const content = buildTaskMarkdown({
      ...input,
      title,
      taskId,
      created,
      updated: created
    });
    const file = await this.app.vault.create(path, content);
    await this.waitForFrontmatter(file, (frontmatter) => frontmatter.task_id === taskId);
    return file;
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

async function ensureFolder(app: App, folderPath: string): Promise<void> {
  const parts = normalizePath(folderPath).split("/").filter(Boolean);
  let current = "";
  for (const part of parts) {
    current = current ? `${current}/${part}` : part;
    if (!(await app.vault.adapter.exists(current))) {
      await app.vault.createFolder(current);
    }
  }
}

async function getAvailableTaskPath(app: App, folderPath: string, fileName: string): Promise<string> {
  const safeName = sanitizeFileName(fileName);
  const extension = ".md";
  const baseName = safeName.endsWith(extension) ? safeName.slice(0, -extension.length) : safeName;
  let candidate = normalizePath(`${folderPath}/${baseName}${extension}`);
  let index = 2;
  while (await app.vault.adapter.exists(candidate)) {
    candidate = normalizePath(`${folderPath}/${baseName}-${index}${extension}`);
    index += 1;
  }
  return candidate;
}

function buildTaskMarkdown(input: CreatePlanningTaskInput & { taskId: string; created: string; updated: string }): string {
  const mainline = input.mainline ? yamlString(input.mainline) : "null";
  const branchMainline = input.branchMainline ? yamlString(input.branchMainline) : "null";
  const branchMainlineId = input.branchMainlineId ? yamlString(input.branchMainlineId) : "null";
  const sourceExcerpt = input.sourceExcerpt?.trim() || "手动新建任务";
  return [
    "---",
    "type: planning-task",
    `task_id: ${input.taskId}`,
    `title: ${yamlString(input.title)}`,
    `date: ${input.date ?? "null"}`,
    `mainline: ${mainline}`,
    `branch_mainline: ${branchMainline}`,
    `branch_mainline_id: ${branchMainlineId}`,
    `status: ${input.status}`,
    `priority: ${input.priority}`,
    `source_type: ${input.sourceType ?? "manual"}`,
    'source_file: ""',
    `source_excerpt: ${yamlString(sourceExcerpt)}`,
    "relations: []",
    `created: ${input.created}`,
    `updated: ${input.updated}`,
    "review_status: confirmed",
    "confidence: 1",
    "---",
    "",
    `# ${input.title}`,
    "",
    "## 任务描述",
    "",
    sourceExcerpt,
    "",
    "## 完成标准",
    "",
    "- [ ] ",
    "",
    "## 执行记录",
    "",
    "-",
    "",
    "## 复盘",
    "",
    "- 问题原因：",
    "- 解决方式：",
    "- 下次注意：",
    ""
  ].join("\n");
}

function createTaskId(date: Date): string {
  const pad = (value: number, size = 2) => value.toString().padStart(size, "0");
  return `task_${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}_${Math.random().toString(36).slice(2, 6)}`;
}

function sanitizeFileName(value: string): string {
  return value.replace(/[\\/:*?"<>|#^[\]]/g, "_").replace(/\s+/g, " ").trim().slice(0, 120) || "新建任务.md";
}

function yamlString(value: string): string {
  return JSON.stringify(value);
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
