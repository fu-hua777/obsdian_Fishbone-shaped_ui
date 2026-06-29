import { PlanningTask } from "../data/taskTypes";
import { FishboneDateColumn, UNDATED_COLUMN_ID, UNDATED_COLUMN_LABEL } from "./fishboneRenderTypes";

export type FishboneDateMode = "week" | "all";

export interface FishboneViewportState {
  mode: FishboneDateMode;
  anchorDate: string;
}

export function createDefaultFishboneViewport(): FishboneViewportState {
  return {
    mode: "week",
    anchorDate: getLocalDateString(new Date())
  };
}

export function moveViewportWeek(viewport: FishboneViewportState, offset: number): FishboneViewportState {
  const anchor = parseDateString(viewport.anchorDate) ?? new Date();
  anchor.setDate(anchor.getDate() + offset * 7);
  return {
    mode: "week",
    anchorDate: getLocalDateString(anchor)
  };
}

export function moveViewportToToday(): FishboneViewportState {
  return createDefaultFishboneViewport();
}

export function showAllViewport(viewport: FishboneViewportState): FishboneViewportState {
  return {
    ...viewport,
    mode: "all"
  };
}

export function buildViewportDateColumns(tasks: PlanningTask[], viewport: FishboneViewportState): FishboneDateColumn[] {
  const today = getLocalDateString(new Date());
  const columns = viewport.mode === "all" ? buildAllDateColumns(tasks, today) : buildWeekDateColumns(viewport.anchorDate, today);

  if (tasks.some((task) => task.date === null)) {
    columns.push({
      id: UNDATED_COLUMN_ID,
      label: UNDATED_COLUMN_LABEL,
      fullLabel: UNDATED_COLUMN_LABEL,
      sortValue: UNDATED_COLUMN_ID,
      isToday: false,
      isWeekend: false,
      isUndated: true
    });
  }

  return columns;
}

export function describeViewport(viewport: FishboneViewportState): string {
  if (viewport.mode === "all") {
    return "显示全部";
  }
  const weekStart = startOfWeek(parseDateString(viewport.anchorDate) ?? new Date());
  const weekEnd = cloneDate(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  return `${formatMonthDay(weekStart)} - ${formatMonthDay(weekEnd)}`;
}

function buildWeekDateColumns(anchorDate: string, today: string): FishboneDateColumn[] {
  const anchor = parseDateString(anchorDate) ?? new Date();
  const weekStart = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_, index) => {
    const date = cloneDate(weekStart);
    date.setDate(weekStart.getDate() + index);
    return createDateColumn(getLocalDateString(date), today);
  });
}

function buildAllDateColumns(tasks: PlanningTask[], today: string): FishboneDateColumn[] {
  const values = tasks
    .map((task) => task.date)
    .filter((value): value is string => Boolean(value && parseDateString(value)));
  values.push(today);

  if (values.length === 0) {
    return buildWeekDateColumns(today, today);
  }

  const sorted = Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
  const start = parseDateString(sorted[0]) ?? new Date();
  const end = parseDateString(sorted[sorted.length - 1]) ?? start;
  const result: FishboneDateColumn[] = [];
  const cursor = cloneDate(start);
  while (cursor <= end) {
    result.push(createDateColumn(getLocalDateString(cursor), today));
    cursor.setDate(cursor.getDate() + 1);
  }
  return result;
}

function createDateColumn(value: string, today: string): FishboneDateColumn {
  const date = parseDateString(value) ?? new Date();
  return {
    id: value,
    label: formatMonthDay(date),
    fullLabel: `${value} ${formatWeekday(date)}`,
    sortValue: value,
    isToday: value === today,
    isWeekend: date.getDay() === 0 || date.getDay() === 6,
    isUndated: false
  };
}

function startOfWeek(date: Date): Date {
  const result = cloneDate(date);
  const day = result.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + offset);
  return result;
}

function parseDateString(value: string): Date | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function getLocalDateString(date: Date): string {
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatMonthDay(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function formatWeekday(date: Date): string {
  return ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][date.getDay()];
}

function cloneDate(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
