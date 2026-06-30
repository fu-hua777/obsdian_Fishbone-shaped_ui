import { Mainline, PlanningTask, TaskPriority, TaskStatus } from "../data/taskTypes";

export interface DashboardSummaryOptions {
  today: string;
  weekStartsOn?: 0 | 1;
}

export interface DashboardProgress {
  total: number;
  done: number;
  doing: number;
  blocked: number;
  todo: number;
  rate: number;
}

export interface DashboardMainlineProgress extends DashboardProgress {
  id: string;
  name: string;
  color: string;
  visible: boolean;
  pinned: boolean;
  highPriority: number;
  overdue: number;
}

export interface DashboardSummary {
  today: string;
  weekStart: string;
  weekEnd: string;
  todayTasks: PlanningTask[];
  weekTasks: PlanningTask[];
  weekFocusTasks: PlanningTask[];
  highPriorityWeekTasks: PlanningTask[];
  overdueTasks: PlanningTask[];
  blockedTasks: PlanningTask[];
  doingTasks: PlanningTask[];
  todoTasks: PlanningTask[];
  doneTasks: PlanningTask[];
  inboxTasks: PlanningTask[];
  mainlineProgress: DashboardMainlineProgress[];
  todayProgress: DashboardProgress;
  weekProgress: DashboardProgress;
}

const UNASSIGNED_MAINLINE_ID = "__unassigned__";
const UNASSIGNED_MAINLINE_NAME = "未分配";
const UNASSIGNED_MAINLINE_COLOR = "#94a3b8";

export function buildDashboardSummary(
  tasks: PlanningTask[],
  mainlines: Mainline[],
  options: DashboardSummaryOptions
): DashboardSummary {
  const today = options.today;
  const { weekStart, weekEnd } = getWeekRange(today, options.weekStartsOn ?? 1);
  const sortedTasks = [...tasks].sort(compareTasksForDashboard);
  const todayTasks = sortedTasks.filter((task) => task.date === today);
  const weekTasks = sortedTasks.filter((task) => Boolean(task.date) && task.date! >= weekStart && task.date! <= weekEnd);
  const overdueTasks = sortedTasks.filter((task) => Boolean(task.date) && task.date! < today && isActiveTask(task));
  const highPriorityWeekTasks = weekTasks.filter((task) => task.priority === "high" && isActiveTask(task));
  const blockedTasks = sortedTasks.filter((task) => task.status === "blocked");
  const doingTasks = sortedTasks.filter((task) => task.status === "doing");

  return {
    today,
    weekStart,
    weekEnd,
    todayTasks,
    weekTasks,
    weekFocusTasks: uniqueTasks([...overdueTasks, ...highPriorityWeekTasks, ...blockedTasks, ...doingTasks])
      .filter((task) => task.date === null || task.date <= weekEnd),
    highPriorityWeekTasks,
    overdueTasks,
    blockedTasks,
    doingTasks,
    todoTasks: sortedTasks.filter((task) => task.status === "todo"),
    doneTasks: sortedTasks.filter((task) => task.status === "done"),
    inboxTasks: sortedTasks.filter((task) => task.status === "inbox"),
    mainlineProgress: buildMainlineProgress(sortedTasks, mainlines, today),
    todayProgress: buildProgress(todayTasks),
    weekProgress: buildProgress(weekTasks)
  };
}

export function buildProgress(tasks: PlanningTask[]): DashboardProgress {
  const activeTasks = tasks.filter((task) => task.status !== "canceled");
  const total = activeTasks.length;
  const done = activeTasks.filter((task) => task.status === "done").length;
  const doing = activeTasks.filter((task) => task.status === "doing").length;
  const blocked = activeTasks.filter((task) => task.status === "blocked").length;
  const todo = activeTasks.filter((task) => task.status === "todo" || task.status === "inbox").length;
  return {
    total,
    done,
    doing,
    blocked,
    todo,
    rate: total > 0 ? done / total : 0
  };
}

function buildMainlineProgress(tasks: PlanningTask[], mainlines: Mainline[], today: string): DashboardMainlineProgress[] {
  const normalMainlines = mainlines
    .filter((mainline) => mainline.type === "mainline")
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  const configuredNames = new Set(normalMainlines.map((mainline) => mainline.name));
  const configuredByName = new Map(normalMainlines.map((mainline) => [mainline.name, mainline]));
  const taskMainlineNames = new Set(tasks.map((task) => task.mainline).filter((value): value is string => Boolean(value)));
  const orphanNames = [...taskMainlineNames].filter((name) => !configuredNames.has(name)).sort((a, b) => a.localeCompare(b));

  const groups: DashboardMainlineProgress[] = [];
  for (const mainline of normalMainlines) {
    const groupTasks = tasks.filter((task) => task.mainline === mainline.name);
    const progress = buildProgress(groupTasks);
    groups.push({
      ...progress,
      id: mainline.id,
      name: mainline.name,
      color: mainline.color,
      visible: mainline.visible,
      pinned: mainline.pinned,
      highPriority: countHighPriority(groupTasks),
      overdue: countOverdue(groupTasks, today)
    });
  }

  for (const name of orphanNames) {
    const mainline = configuredByName.get(name);
    const groupTasks = tasks.filter((task) => task.mainline === name);
    const progress = buildProgress(groupTasks);
    groups.push({
      ...progress,
      id: `orphan:${name}`,
      name,
      color: mainline?.color ?? UNASSIGNED_MAINLINE_COLOR,
      visible: mainline?.visible ?? true,
      pinned: mainline?.pinned ?? false,
      highPriority: countHighPriority(groupTasks),
      overdue: countOverdue(groupTasks, today)
    });
  }

  const unassignedTasks = tasks.filter((task) => !task.mainline);
  const unassignedProgress = buildProgress(unassignedTasks);
  if (unassignedProgress.total > 0 || groups.length === 0) {
    groups.push({
      ...unassignedProgress,
      id: UNASSIGNED_MAINLINE_ID,
      name: UNASSIGNED_MAINLINE_NAME,
      color: UNASSIGNED_MAINLINE_COLOR,
      visible: true,
      pinned: false,
      highPriority: countHighPriority(unassignedTasks),
      overdue: countOverdue(unassignedTasks, today)
    });
  }

  return groups;
}

function uniqueTasks(tasks: PlanningTask[]): PlanningTask[] {
  const seen = new Set<string>();
  return tasks.filter((task) => {
    if (seen.has(task.taskId)) return false;
    seen.add(task.taskId);
    return true;
  });
}

function countHighPriority(tasks: PlanningTask[]): number {
  return tasks.filter((task) => task.priority === "high" && isActiveTask(task)).length;
}

function countOverdue(tasks: PlanningTask[], today: string): number {
  return tasks.filter((task) => Boolean(task.date) && task.date! < today && isActiveTask(task)).length;
}

function compareTasksForDashboard(a: PlanningTask, b: PlanningTask): number {
  const dateCompare = (a.date ?? "9999-99-99").localeCompare(b.date ?? "9999-99-99");
  if (dateCompare !== 0) return dateCompare;
  const priorityCompare = priorityRank(a.priority) - priorityRank(b.priority);
  if (priorityCompare !== 0) return priorityCompare;
  const statusCompare = statusRank(a.status) - statusRank(b.status);
  if (statusCompare !== 0) return statusCompare;
  return a.title.localeCompare(b.title);
}

function priorityRank(priority: TaskPriority): number {
  switch (priority) {
    case "high":
      return 0;
    case "medium":
      return 1;
    case "low":
      return 2;
    default:
      return 3;
  }
}

function statusRank(status: TaskStatus): number {
  switch (status) {
    case "blocked":
      return 0;
    case "doing":
      return 1;
    case "todo":
      return 2;
    case "inbox":
      return 3;
    case "done":
      return 4;
    case "canceled":
      return 5;
    default:
      return 6;
  }
}

function isActiveTask(task: PlanningTask): boolean {
  return task.status !== "done" && task.status !== "canceled";
}

function getWeekRange(today: string, weekStartsOn: 0 | 1): { weekStart: string; weekEnd: string } {
  const date = parseLocalDate(today);
  const day = date.getDay();
  const offset = weekStartsOn === 1 ? (day + 6) % 7 : day;
  const start = addDays(date, -offset);
  const end = addDays(start, 6);
  return {
    weekStart: formatLocalDate(start),
    weekEnd: formatLocalDate(end)
  };
}

function parseLocalDate(value: string): Date {
  const [year, month, day] = value.split("-").map((part) => Number(part));
  return new Date(year, month - 1, day);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatLocalDate(date: Date): string {
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
