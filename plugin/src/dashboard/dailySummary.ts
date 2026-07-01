import { DashboardSummary } from "./dashboardSummary";
import { Mainline, PlanningTask } from "../data/taskTypes";

export interface DailySummaryBuildInput {
  date: string;
  summary: DashboardSummary;
  tasks: PlanningTask[];
  mainlines: Mainline[];
  generatedAt: string;
}

export interface DailySummaryStats {
  taskCount: number;
  doneCount: number;
  blockedCount: number;
  quickInputCount: number;
}

export function buildDailySummaryStats(tasks: PlanningTask[], date: string): DailySummaryStats {
  const dayTasks = tasks.filter((task) => isTaskRelevantForDate(task, date));
  return {
    taskCount: dayTasks.length,
    doneCount: dayTasks.filter((task) => task.status === "done").length,
    blockedCount: tasks.filter((task) => task.status === "blocked").length,
    quickInputCount: tasks.filter((task) => task.created.startsWith(date) && task.sourceType === "quick-input").length
  };
}

export function buildDailySummaryMarkdown(input: DailySummaryBuildInput): string {
  const { date, summary, tasks, mainlines, generatedAt } = input;
  const stats = buildDailySummaryStats(tasks, date);
  const doneTasks = tasks.filter((task) => isTaskRelevantForDate(task, date) && task.status === "done");
  const doingTasks = tasks.filter((task) => task.status === "doing");
  const blockedTasks = tasks.filter((task) => task.status === "blocked");
  const newTasks = tasks.filter((task) => task.created.startsWith(date));
  const quickInputs = newTasks.filter((task) => task.sourceType === "quick-input");
  const overdueTasks = summary.overdueTasks;
  const tomorrowSuggestions = buildTomorrowSuggestions(tasks, date);

  return [
    "---",
    "type: daily-summary",
    `date: ${date}`,
    `generated_at: ${generatedAt}`,
    `task_count: ${stats.taskCount}`,
    `done_count: ${stats.doneCount}`,
    `blocked_count: ${stats.blockedCount}`,
    "---",
    "",
    `# ${date} 每日总结`,
    "",
    "## 1. 今日概览",
    "",
    `- 今日相关任务：${stats.taskCount}`,
    `- 已完成：${stats.doneCount}`,
    `- 进行中：${doingTasks.length}`,
    `- 阻塞：${blockedTasks.length}`,
    `- 快速输入新增：${stats.quickInputCount}`,
    "",
    "## 2. 今日完成",
    "",
    formatTaskList(doneTasks, "无明确记录"),
    "",
    "## 3. 今日推进中的任务",
    "",
    formatTaskList(doingTasks, "无明确记录"),
    "",
    "## 4. 今日遇到的问题",
    "",
    formatTaskList(blockedTasks, "无明确记录"),
    "",
    "## 5. 新增任务与想法",
    "",
    formatTaskList(newTasks, "无明确记录"),
    "",
    "## 6. 各主线进展",
    "",
    formatMainlineProgress(mainlines, tasks),
    "",
    "## 7. relation 变化",
    "",
    formatRelationNotes(tasks, date),
    "",
    "## 8. 明日建议",
    "",
    formatTaskList(tomorrowSuggestions, "无明确记录"),
    "",
    "## 9. 需要用户确认的事项",
    "",
    formatConfirmationItems([...quickInputs, ...tasks.filter((task) => !task.date || !task.mainline)]),
    ""
  ].join("\n");
}

function isTaskRelevantForDate(task: PlanningTask, date: string): boolean {
  return task.date === date || task.created.startsWith(date) || task.updated.startsWith(date);
}

function buildTomorrowSuggestions(tasks: PlanningTask[], date: string): PlanningTask[] {
  return uniqueTasks(tasks
    .filter((task) => task.status !== "done" && task.status !== "canceled")
    .filter((task) => task.priority === "high" || task.status === "blocked" || !task.date || task.date <= date)
  ).slice(0, 8);
}

function formatTaskList(tasks: PlanningTask[], emptyText: string): string {
  if (tasks.length === 0) return `- ${emptyText}`;
  return tasks.slice(0, 12).map((task) => {
    const mainline = task.mainline ?? "未分配";
    const date = task.date ?? "无日期";
    return `- [${task.status}] ${task.title}（${mainline} / ${date} / ${task.priority}）`;
  }).join("\n");
}

function formatMainlineProgress(mainlines: Mainline[], tasks: PlanningTask[]): string {
  const normalMainlines = mainlines
    .filter((mainline) => mainline.type === "mainline" && mainline.visible !== false)
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  if (normalMainlines.length === 0) return "- 无明确主线记录";
  return normalMainlines.map((mainline) => {
    const items = tasks.filter((task) => task.mainline === mainline.name && task.status !== "canceled");
    const done = items.filter((task) => task.status === "done").length;
    const doing = items.filter((task) => task.status === "doing").length;
    const blocked = items.filter((task) => task.status === "blocked").length;
    const total = items.length;
    return `- ${mainline.name}：完成 ${done}/${total}，进行中 ${doing}，阻塞 ${blocked}`;
  }).join("\n");
}

function formatRelationNotes(tasks: PlanningTask[], date: string): string {
  const relationTasks = tasks.filter((task) => task.updated.startsWith(date) && task.relations.length > 0);
  if (relationTasks.length === 0) return "- 无明确记录";
  return relationTasks.slice(0, 8).map((task) => {
    return `- ${task.title}：${task.relations.length} 条 relation`;
  }).join("\n");
}

function formatConfirmationItems(tasks: PlanningTask[]): string {
  const items = uniqueTasks(tasks).filter((task) => !task.date || !task.mainline || task.sourceType === "quick-input");
  if (items.length === 0) return "- 无";
  return items.slice(0, 12).map((task) => {
    const missing = [
      task.date ? "" : "缺少日期",
      task.mainline ? "" : "缺少主线",
      task.sourceType === "quick-input" ? "快速输入来源" : ""
    ].filter(Boolean).join("，");
    return `- ${task.title}：${missing}`;
  }).join("\n");
}

function uniqueTasks(tasks: PlanningTask[]): PlanningTask[] {
  const seen = new Set<string>();
  return tasks.filter((task) => {
    if (seen.has(task.taskId)) return false;
    seen.add(task.taskId);
    return true;
  });
}
