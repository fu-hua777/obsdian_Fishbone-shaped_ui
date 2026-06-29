export interface FishboneCanvasViewport {
  panX: number;
  panY: number;
  canvasZoom: number;
  timeScale: number;
  centerDate: string;
  focusedLaneId: string | null;
  laneZooms: Record<string, number>;
}

export interface CanvasPoint {
  x: number;
  y: number;
}

export const CANVAS_ORIGIN_X = 2400;
export const CANVAS_AXIS_Y = 36;
export const CANVAS_LANE_START_Y = 128;
export const BASE_LANE_HEIGHT = 156;
export const LANE_GAP = 42;
export const UNDATED_X = 120;

const MIN_CANVAS_ZOOM = 0.45;
const MAX_CANVAS_ZOOM = 2.4;
const MIN_TIME_SCALE = 28;
const MAX_TIME_SCALE = 260;
const MIN_LANE_ZOOM = 0.65;
const MAX_LANE_ZOOM = 2.2;

export function createDefaultFishboneCanvasViewport(): FishboneCanvasViewport {
  return {
    panX: -1760,
    panY: 0,
    canvasZoom: 1,
    timeScale: 120,
    centerDate: getLocalDateString(new Date()),
    focusedLaneId: null,
    laneZooms: {}
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

export function resetCanvasViewport(viewport: FishboneCanvasViewport): FishboneCanvasViewport {
  return {
    ...viewport,
    panX: -1760,
    panY: 0,
    canvasZoom: 1,
    timeScale: 120,
    centerDate: getLocalDateString(new Date())
  };
}

export function getLaneZoom(viewport: FishboneCanvasViewport, laneId: string): number {
  return viewport.laneZooms[laneId] ?? 1;
}

export function getLaneHeight(viewport: FishboneCanvasViewport, laneId: string): number {
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

export function getLocalDateString(date: Date): string {
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseDateString(value: string): Date | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function formatCanvasDate(value: string): string {
  const date = parseDateString(value);
  if (!date) return value;
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

export function formatCanvasWeekday(value: string): string {
  const date = parseDateString(value);
  if (!date) return "";
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

function wheelFactor(delta: number): number {
  return delta < 0 ? 1.08 : 0.92;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
