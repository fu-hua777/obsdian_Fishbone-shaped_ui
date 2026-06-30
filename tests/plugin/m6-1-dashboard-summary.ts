import { Mainline, PlanningTask, RelationDirection, RelationType } from "../../plugin/src/data/taskTypes";
import { buildDashboardSummary } from "../../plugin/src/dashboard/dashboardSummary";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const mainlines: Mainline[] = [
  mainline("project", "项目", "#4f8cff", 1),
  mainline("study", "学习", "#48d87a", 2)
];

const tasks: PlanningTask[] = [
  task("t1", "今日高优先进行中", "2026-06-30", "项目", "doing", "high"),
  task("t2", "今日完成任务", "2026-06-30", "项目", "done", "medium"),
  task("t3", "本周阻塞任务", "2026-07-02", "学习", "blocked", "high"),
  task("t4", "下周任务", "2026-07-07", "学习", "todo", "low"),
  task("t5", "未分配收集箱", "2026-06-30", null, "inbox", "medium"),
  task("t6", "取消任务不计完成率", "2026-06-30", "项目", "canceled", "high")
];

const summary = buildDashboardSummary(tasks, mainlines, { today: "2026-06-30" });

assert(summary.weekStart === "2026-06-29", `周起始应为 2026-06-29，实际 ${summary.weekStart}`);
assert(summary.weekEnd === "2026-07-05", `周结束应为 2026-07-05，实际 ${summary.weekEnd}`);
assert(summary.todayTasks.length === 4, `今日任务应为 4，实际 ${summary.todayTasks.length}`);
assert(summary.weekTasks.length === 5, `本周任务应为 5，实际 ${summary.weekTasks.length}`);
assert(summary.highPriorityWeekTasks.map((taskItem) => taskItem.taskId).join(",") === "t1,t3", "本周高优先任务应排除完成和取消任务");
assert(summary.blockedTasks.length === 1 && summary.blockedTasks[0].taskId === "t3", "应识别阻塞任务");
assert(summary.doingTasks.length === 1 && summary.doingTasks[0].taskId === "t1", "应识别进行中任务");
assert(summary.todayProgress.total === 3, `今日有效任务数应排除 canceled，实际 ${summary.todayProgress.total}`);
assert(summary.todayProgress.done === 1, "今日完成数应为 1");
assert(Math.abs(summary.todayProgress.rate - 1 / 3) < 0.001, `今日完成率应为 1/3，实际 ${summary.todayProgress.rate}`);

const projectProgress = summary.mainlineProgress.find((item) => item.name === "项目");
assert(projectProgress, "应生成项目主线进度");
assert(projectProgress.total === 2, `项目有效任务应为 2，实际 ${projectProgress.total}`);
assert(projectProgress.done === 1, "项目完成数应为 1");

const unassignedProgress = summary.mainlineProgress.find((item) => item.name === "未分配");
assert(unassignedProgress, "应生成未分配进度分组");
assert(unassignedProgress.total === 1, "未分配有效任务应为 1");

console.log("M6.1 dashboard summary regression passed.");

function mainline(id: string, name: string, color: string, order: number): Mainline {
  return {
    id,
    type: "mainline",
    name,
    color,
    icon: "circle",
    order,
    visible: true,
    collapsed: false,
    pinned: false,
    parentMainlineId: null,
    startDate: null,
    endDate: null,
    branchOffset: 0
  };
}

function task(
  id: string,
  title: string,
  date: string,
  mainlineName: string | null,
  status: PlanningTask["status"],
  priority: PlanningTask["priority"]
): PlanningTask {
  return {
    type: "planning-task",
    taskId: id,
    title,
    date,
    mainline: mainlineName,
    branchMainline: null,
    branchMainlineId: null,
    status,
    priority,
    sourceType: "test",
    sourceFile: "",
    sourceExcerpt: "",
    relations: [{
      target: "none",
      type: "普通关联" as RelationType,
      direction: "out" as RelationDirection,
      label: "关联",
      note: ""
    }],
    created: "2026-06-30 10:00",
    updated: "2026-06-30 10:00",
    reviewStatus: "confirmed",
    confidence: 1,
    path: `PlanningSystem/Tasks/${id}.md`
  };
}
