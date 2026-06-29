export type TaskStatus = "todo" | "doing" | "done" | "blocked" | "canceled" | "inbox";
export type TaskPriority = "high" | "medium" | "low";
export type ReviewStatus = "pending" | "confirmed" | "rejected";
export type RelationType = "普通关联" | "前置" | "依赖" | "阻塞" | "参考" | "支撑" | "影响";
export type RelationDirection = "in" | "out" | "both";

export interface PlanningRelation {
  target: string;
  type: RelationType;
  direction: RelationDirection;
  label: string;
  note: string;
}

export interface PlanningTask {
  type: "planning-task";
  taskId: string;
  title: string;
  date: string | null;
  mainline: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  sourceType: string;
  sourceFile: string;
  sourceExcerpt: string;
  relations: PlanningRelation[];
  created: string;
  updated: string;
  reviewStatus: ReviewStatus;
  confidence: number;
  path: string;
}

export interface Mainline {
  id: string;
  name: string;
  color: string;
  icon: string;
  order: number;
  visible: boolean;
  collapsed: boolean;
  pinned: boolean;
}

export interface MainlinesFile {
  version: string;
  mainlines: Mainline[];
}

export const STATUS_ORDER: TaskStatus[] = ["inbox", "todo", "doing", "done", "blocked", "canceled"];

export function nextStatus(status: TaskStatus): TaskStatus {
  switch (status) {
    case "inbox":
      return "todo";
    case "todo":
      return "doing";
    case "doing":
      return "done";
    case "done":
      return "todo";
    case "blocked":
      return "todo";
    case "canceled":
      return "todo";
    default:
      return "todo";
  }
}
