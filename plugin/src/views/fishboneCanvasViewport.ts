export type TimeAxisMode = "day" | "week" | "month" | "overview";

export interface FishboneCanvasViewport {
  panX: number;
  panY: number;
  canvasZoom: number;
  timeScale: number;
  centerDate: string;
  timeAxisMode: TimeAxisMode;
  focusedLaneId: string | null;
  laneZooms: Record<string, number>;
}

export interface CanvasPoint {
  x: number;
  y: number;
}

export interface DateRange {
  start: string | null;
  end: string | null;
  spanDays: number;
}

export const CANVAS_ORIGIN_X = 2400;
export const CANVAS_AXIS_Y = 36;
export const CANVAS_LANE_START_Y = 128;
export const BASE_LANE_HEIGHT = 156;
export const COLLAPSED_LANE_HEIGHT = 68;
export const LANE_GAP = 42;
export const UNDATED_X = 120;

export const MIN_CANVAS_ZOOM = 0.45;
export const MAX_CANVAS_ZOOM = 2.4;
export const MIN_TIME_SCALE = 28;
export const MAX_TIME_SCALE = 260;
export const MIN_LANE_ZOOM = 0.65;
export const MAX_LANE_ZOOM = 2.2;

const MODE_DEFAULT_TIME_SCALE: Record<TimeAxisMode, number> = {
  day: 120,
  week: 72,
  month: 44,
  overview: 56
};

export function createDefaultFishboneCanvasViewport(): FishboneCanvasViewport {
  return {
    panX: -1760,
    panY: 0,
    canvasZoom: 1,
    timeScale: MODE_DEFAULT_TIME_SCALE.day,
    centerDate: getLocalDateString(new Date()),
    timeAxisMode: "day",
    focusedLaneId: null,
    laneZooms: {}
  };
}

export function normalizeFishboneCanvasViewport(value: Partial<FishboneCanvasViewport> | null | undefined): FishboneCanvasViewport {
  const defaults = createDefaultFishboneCanvasViewport();
  if (!value) return defaults;
  const mode = normalizeTimeAxisMode(value.timeAxisMode);
  return {
    panX: numberOr(value.panX, defaults.panX),
    panY: numberOr(value.panY, defaults.panY),
    canvasZoom: clamp(numberOr(value.canvasZoom, defaults.canvasZoom), MIN_CANVAS_ZOOM, MAX_CANVAS_ZOOM),
    timeScale: clamp(numberOr(value.timeScale, MODE_DEFAULT_TIME_SCALE[mode]), MIN_TIME_SCALE, MAX_TIME_SCALE),
    centerDate: parseDateString(value.centerDate ?? "") ? value.centerDate as string : defaults.centerDate,
    timeAxisMode: mode,
    focusedLaneId: typeof value.focusedLaneId === "string" ? value.focusedLaneId : null,
    laneZooms: normalizeLaneZooms(value.laneZooms)
  };
}

export function panCanvasViewport(viewport: FishboneCanvasViewport, deltaX: number, deltaY: number): FishboneCanvasViewport {
  return {
    ...viewport,
    panX: viewport.panX + deltaX,
    panY: viewport.panY + deltaY
  };
}

export function zoomCanvasViewport(viewport: FishboneCanvasViewport, wheelDelta: number, anchor: CanvasPoint): FishboneCanvasViewport {
  const nextZoom = clamp(viewport.canvasZoom * wheelFactor(wheelDelta), MIN_CANVAS_ZOOM, MAX_CANVAS_ZOOM);
  const ratio = nextZoom / viewport.canvasZoom;
  return {
    ...viewport,
    canvasZoom: nextZoom,
    panX: anchor.x - (anchor.x - viewport.panX) * ratio,
    panY: anchor.y - (anchor.y - viewport.panY) * ratio
  };
}

export function zoomTimeScale(viewport: FishboneCanvasViewport, wheelDelta: number): FishboneCanvasViewport {
  return {
    ...viewport,
    timeScale: clamp(viewport.timeScale * wheelFactor(wheelDelta), MIN_TIME_SCALE, MAX_TIME_SCALE)
  };
}

export function zoomLane(viewport: FishboneCanvasViewport, laneId: string, wheelDelta: number): FishboneCanvasViewport {
  const current = getLaneZoom(viewport, laneId);
  return {
    ...viewport,
    laneZooms: {
      ...viewport.laneZooms,
      [laneId]: clamp(current * wheelFactor(wheelDelta), MIN_LANE_ZOOM, MAX_LANE_ZOOM)
    }
  };
}

export function setFocusedLane(viewport: FishboneCanvasViewport, laneId: string | null): FishboneCanvasViewport {
  if (viewport.focusedLaneId === laneId) {
    return viewport;
  }
  return {
    ...viewport,
    focusedLaneId: laneId
  };
}

export function setViewportCenterDate(viewport: FishboneCanvasViewport, centerDate: string): FishboneCanvasViewport {
  if (!parseDateString(centerDate)) return viewport;
  return {
    ...viewport,
    centerDate
  };
}

export function setTimeAxisMode(viewport: FishboneCanvasViewport, mode: TimeAxisMode): FishboneCanvasViewport {
  return {
    ...viewport,
    timeAxisMode: mode,
    timeScale: MODE_DEFAULT_TIME_SCALE[mode]
  };
}

export function resetCanvasViewport(viewport: FishboneCanvasViewport): FishboneCanvasViewport {
  return {
    ...createDefaultFishboneCanvasViewport(),
    timeAxisMode: viewport.timeAxisMode,
    timeScale: MODE_DEFAULT_TIME_SCALE[viewport.timeAxisMode]
  };
}

export function fitCanvasViewportToDateRange(
  viewport: FishboneCanvasViewport,
  range: DateRange,
  visibleWidth: number
): FishboneCanvasViewport {
  if (!range.start || !range.end) {
    return resetCanvasViewport(viewport);
  }

  const center = midpointDate(range.start, range.end);
  const usableWidth = Math.max(480, visibleWidth - 260);
  const nextScale = clamp(usableWidth / Math.max(1, range.spanDays + 2), MIN_TIME_SCALE, MAX_TIME_SCALE);
  return {
    ...viewport,
    centerDate: center,
    timeScale: nextScale,
    panX: 120 - CANVAS_ORIGIN_X * viewport.canvasZoom,
    panY: 0
  };
}

export function getLaneZoom(viewport: FishboneCanvasViewport, laneId: string): number {
  return viewport.laneZooms[laneId] ?? 1;
}

export function getLaneHeight(viewport: FishboneCanvasViewport, laneId: string, collapsed = false): number {
  if (collapsed) return COLLAPSED_LANE_HEIGHT;
  return BASE_LANE_HEIGHT * getLaneZoom(viewport, laneId);
}

export function dateToCanvasX(date: string | null, viewport: FishboneCanvasViewport): number {
  if (!date) {
    return UNDATED_X;
  }
  const days = dateDiffInDays(viewport.centerDate, date);
  return CANVAS_ORIGIN_X + days * viewport.timeScale;
}

export function canvasXToDate(x: number, viewport: FishboneCanvasViewport): string {
  const days = Math.round((x - CANVAS_ORIGIN_X) / viewport.timeScale);
  const center = parseDateString(viewport.centerDate) ?? new Date();
  center.setDate(center.getDate() + days);
  return getLocalDateString(center);
}

export function getDateTickStep(mode: TimeAxisMode): number {
  switch (mode) {
    case "week":
      return 7;
    case "month":
      return 7;
    case "overview":
      return 7;
    default:
      return 1;
  }
}

export function getDateTickRangePadding(mode: TimeAxisMode): number {
  switch (mode) {
    case "week":
      return 42;
    case "month":
      return 70;
    case "overview":
      return 28;
    default:
      return 21;
  }
}

export function getDateRangeFromValues(values: Array<string | null | undefined>): DateRange {
  const dates = values.filter((value): value is string => Boolean(value && parseDateString(value)));
  if (dates.length === 0) {
    return { start: null, end: null, spanDays: 0 };
  }
  const sorted = [...dates].sort();
  const start = sorted[0];
  const end = sorted[sorted.length - 1];
  return {
    start,
    end,
    spanDays: Math.max(0, dateDiffInDays(start, end))
  };
}

export function getLocalDateString(date: Date): string {
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseDateString(value: string): Date | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function formatCanvasDate(value: string, mode: TimeAxisMode = "day"): string {
  const date = parseDateString(value);
  if (!date) return value;
  if (mode === "month" && date.getDate() <= 7) {
    return `${date.getFullYear()}/${date.getMonth() + 1}`;
  }
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

export function formatCanvasWeekday(value: string, mode: TimeAxisMode = "day"): string {
  const date = parseDateString(value);
  if (!date) return "";
  if (mode === "week") return `第${getWeekNumber(date)}周`;
  if (mode === "month") return date.getDate() <= 7 ? "月视图" : "";
  if (mode === "overview") return "关键日期";
  return ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][date.getDay()];
}

export function dateDiffInDays(from: string, to: string): number {
  const fromDate = parseDateString(from);
  const toDate = parseDateString(to);
  if (!fromDate || !toDate) return 0;
  const ms = toDate.getTime() - fromDate.getTime();
  return Math.round(ms / 86400000);
}

export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function normalizeTimeAxisMode(value: unknown): TimeAxisMode {
  return value === "week" || value === "month" || value === "overview" ? value : "day";
}

function midpointDate(start: string, end: string): string {
  const startDate = parseDateString(start);
  const endDate = parseDateString(end);
  if (!startDate || !endDate) return getLocalDateString(new Date());
  const mid = new Date((startDate.getTime() + endDate.getTime()) / 2);
  return getLocalDateString(mid);
}

function getWeekNumber(date: Date): number {
  const firstDay = new Date(date.getFullYear(), 0, 1);
  const dayOffset = Math.floor((date.getTime() - firstDay.getTime()) / 86400000);
  return Math.ceil((dayOffset + firstDay.getDay() + 1) / 7);
}

function normalizeLaneZooms(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: Record<string, number> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "number") {
      result[key] = clamp(item, MIN_LANE_ZOOM, MAX_LANE_ZOOM);
    }
  }
  return result;
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function wheelFactor(delta: number): number {
  return delta < 0 ? 1.08 : 0.92;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
