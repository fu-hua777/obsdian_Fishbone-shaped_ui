import { Mainline, PlanningTask } from "../data/taskTypes";
import {
  FishboneCanvasViewport,
  CANVAS_AXIS_Y,
  CANVAS_LANE_START_Y,
  CANVAS_ORIGIN_X,
  LANE_GAP,
  dateToCanvasX,
  formatCanvasDate,
  formatCanvasWeekday,
  getLaneHeight,
  getLocalDateString,
  parseDateString
} from "./fishboneCanvasViewport";
import {
  UNASSIGNED_COLOR,
  UNASSIGNED_LANE_ID,
  UNASSIGNED_LANE_NAME
} from "./fishboneRenderTypes";

export interface FishboneCanvasLayout {
  stageWidth: number;
  stageHeight: number;
  dateTicks: FishboneCanvasDateTick[];
  lanes: FishboneCanvasLane[];
  tasks: FishboneCanvasTaskNode[];
}

export interface FishboneCanvasDateTick {
  id: string;
  x: number;
  y: number;
  label: string;
  detail: string;
  isToday: boolean;
  isWeekend: boolean;
}

export interface FishboneCanvasLane {
  id: string;
  name: string;
  color: string;
  y: number;
  height: number;
  spineY: number;
  isUnassigned: boolean;
}

export interface FishboneCanvasTaskNode {
  task: PlanningTask;
  laneId: string;
  x: number;
  y: number;
  branchIndex: number;
  branchSide: "above" | "below";
  color: string;
}

export function buildFishboneCanvasLayout(
  tasks: PlanningTask[],
  mainlines: Mainline[],
  viewport: FishboneCanvasViewport
): FishboneCanvasLayout {
  const lanes = buildCanvasLanes(tasks, mainlines, viewport);
  const taskNodes = buildCanvasTasks(tasks, lanes, mainlines, viewport);
  const dateTicks = buildDateTicks(tasks, viewport);
  const stageWidth = Math.max(5200, ...dateTicks.map((tick) => tick.x + 420), ...taskNodes.map((node) => node.x + 420));
  const stageHeight = Math.max(900, ...lanes.map((lane) => lane.y + lane.height + 220));

  return {
    stageWidth,
    stageHeight,
    dateTicks,
    lanes,
    tasks: taskNodes
  };
}

function buildCanvasLanes(tasks: PlanningTask[], mainlines: Mainline[], viewport: FishboneCanvasViewport): FishboneCanvasLane[] {
  const visibleMainlines = mainlines
    .filter((mainline) => mainline.visible !== false)
    .sort((a, b) => a.order - b.order);
  const visibleNames = new Set(visibleMainlines.map((mainline) => mainline.name));
  const hasUnassignedTask = mainlines.length === 0 || tasks.some((task) => !task.mainline || !visibleNames.has(task.mainline));

  const laneSources = visibleMainlines.map((mainline) => ({
    id: mainline.id,
    name: mainline.name,
    color: mainline.color,
    isUnassigned: false
  }));
  if (hasUnassignedTask) {
    laneSources.push({
      id: UNASSIGNED_LANE_ID,
      name: UNASSIGNED_LANE_NAME,
      color: UNASSIGNED_COLOR,
      isUnassigned: true
    });
  }

  const lanes: FishboneCanvasLane[] = [];
  let y = CANVAS_LANE_START_Y;
  for (const source of laneSources) {
    const height = getLaneHeight(viewport, source.id);
    lanes.push({
      ...source,
      y,
      height,
      spineY: y + height / 2
    });
    y += height + LANE_GAP;
  }
  return lanes;
}

function buildCanvasTasks(
  tasks: PlanningTask[],
  lanes: FishboneCanvasLane[],
  mainlines: Mainline[],
  viewport: FishboneCanvasViewport
): FishboneCanvasTaskNode[] {
  const laneByName = new Map<string, FishboneCanvasLane>();
  for (const mainline of mainlines) {
    const lane = lanes.find((item) => item.id === mainline.id);
    if (lane) {
      laneByName.set(mainline.name, lane);
    }
  }
  const unassignedLane = lanes.find((lane) => lane.id === UNASSIGNED_LANE_ID) ?? lanes[0];
  if (!unassignedLane) return [];

  const bucketCounts = new Map<string, number>();
  return tasks.map((task) => {
    const lane = task.mainline ? laneByName.get(task.mainline) ?? unassignedLane : unassignedLane;
    const x = dateToCanvasX(task.date, viewport);
    const bucket = `${lane.id}:${task.date ?? "__undated__"}`;
    const index = bucketCounts.get(bucket) ?? 0;
    bucketCounts.set(bucket, index + 1);
    const branchSide = index % 2 === 0 ? "above" : "below";
    const branchIndex = Math.floor(index / 2);
    const branchOffset = 44 + branchIndex * 46;
    const y = branchSide === "above" ? lane.spineY - branchOffset : lane.spineY + branchOffset;
    return {
      task,
      laneId: lane.id,
      x,
      y,
      branchIndex,
      branchSide,
      color: lane.color
    };
  });
}

function buildDateTicks(tasks: PlanningTask[], viewport: FishboneCanvasViewport): FishboneCanvasDateTick[] {
  const today = getLocalDateString(new Date());
  const taskDates = tasks
    .map((task) => task.date)
    .filter((value): value is string => Boolean(value && parseDateString(value)));
  const minOffset = Math.min(-21, ...taskDates.map((date) => dateDiff(viewport.centerDate, date)));
  const maxOffset = Math.max(21, ...taskDates.map((date) => dateDiff(viewport.centerDate, date)));
  const center = parseDateString(viewport.centerDate) ?? new Date();
  const ticks: FishboneCanvasDateTick[] = [];

  for (let offset = minOffset; offset <= maxOffset; offset++) {
    const date = new Date(center.getFullYear(), center.getMonth(), center.getDate());
    date.setDate(center.getDate() + offset);
    const id = getLocalDateString(date);
    const day = date.getDay();
    ticks.push({
      id,
      x: dateToCanvasX(id, viewport),
      y: CANVAS_AXIS_Y,
      label: formatCanvasDate(id),
      detail: formatCanvasWeekday(id),
      isToday: id === today,
      isWeekend: day === 0 || day === 6
    });
  }

  ticks.unshift({
    id: "__undated__",
    x: dateToCanvasX(null, viewport),
    y: CANVAS_AXIS_Y,
    label: "无日期",
    detail: "待排期",
    isToday: false,
    isWeekend: false
  });

  return ticks;
}

function dateDiff(from: string, to: string): number {
  const fromDate = parseDateString(from);
  const toDate = parseDateString(to);
  if (!fromDate || !toDate) return 0;
  return Math.round((toDate.getTime() - fromDate.getTime()) / 86400000);
}
