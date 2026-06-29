import { TFile } from "obsidian";
import { PlanningRelation, PlanningTask, ReviewStatus, TaskPriority, TaskStatus } from "./taskTypes";

type FrontmatterValue = string | number | boolean | null | FrontmatterValue[] | { [key: string]: FrontmatterValue };
type Frontmatter = Record<string, FrontmatterValue>;

const taskStatuses = new Set<TaskStatus>(["todo", "doing", "done", "blocked", "canceled", "inbox"]);
const taskPriorities = new Set<TaskPriority>(["high", "medium", "low"]);
const reviewStatuses = new Set<ReviewStatus>(["pending", "confirmed", "rejected"]);

export function parsePlanningTask(file: TFile, frontmatter: Frontmatter | undefined): PlanningTask | null {
  if (!frontmatter || frontmatter.type !== "planning-task") {
    return null;
  }

  const taskId = asString(frontmatter.task_id);
  const title = asString(frontmatter.title);
  if (!taskId || !title) {
    return null;
  }

  return {
    type: "planning-task",
    taskId,
    title,
    date: asNullableString(frontmatter.date),
    mainline: asNullableString(frontmatter.mainline),
    status: asStatus(frontmatter.status),
    priority: asPriority(frontmatter.priority),
    sourceType: asString(frontmatter.source_type),
    sourceFile: asString(frontmatter.source_file),
    sourceExcerpt: asString(frontmatter.source_excerpt),
    relations: asRelations(frontmatter.relations),
    created: asString(frontmatter.created),
    updated: asString(frontmatter.updated),
    reviewStatus: asReviewStatus(frontmatter.review_status),
    confidence: asNumber(frontmatter.confidence),
    path: file.path
  };
}

function asString(value: FrontmatterValue | undefined): string {
  return typeof value === "string" ? value : "";
}

function asNullableString(value: FrontmatterValue | undefined): string | null {
  if (value === null || typeof value === "undefined") {
    return null;
  }
  if (typeof value === "string") {
    return value.length > 0 && value !== "null" ? value : null;
  }
  return null;
}

function asNumber(value: FrontmatterValue | undefined): number {
  return typeof value === "number" ? value : 0;
}

function asStatus(value: FrontmatterValue | undefined): TaskStatus {
  return typeof value === "string" && taskStatuses.has(value as TaskStatus) ? (value as TaskStatus) : "inbox";
}

function asPriority(value: FrontmatterValue | undefined): TaskPriority {
  return typeof value === "string" && taskPriorities.has(value as TaskPriority) ? (value as TaskPriority) : "medium";
}

function asReviewStatus(value: FrontmatterValue | undefined): ReviewStatus {
  return typeof value === "string" && reviewStatuses.has(value as ReviewStatus) ? (value as ReviewStatus) : "pending";
}

function asRelations(value: FrontmatterValue | undefined): PlanningRelation[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is Record<string, FrontmatterValue> => typeof item === "object" && item !== null && !Array.isArray(item))
    .map((item) => ({
      target: asString(item.target),
      type: asString(item.type) as PlanningRelation["type"],
      direction: asString(item.direction) as PlanningRelation["direction"],
      label: asString(item.label),
      note: asString(item.note)
    }));
}
