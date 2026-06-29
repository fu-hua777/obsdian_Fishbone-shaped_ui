import { Mainline, PlanningRelation, PlanningTask } from "../data/taskTypes";
import {
  FishboneCanvasViewport,
  CANVAS_AXIS_Y,
  CANVAS_LANE_START_Y,
  LANE_GAP,
  UNDATED_X,
  CanvasPoint,
  canvasXToDate,
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

export const TASK_NODE_WIDTH = 156;
export const TASK_NODE_HEIGHT = 86;

export interface FishboneCanvasLayout {
  stageWidth: number;
  stageHeight: number;
  dateTicks: FishboneCanvasDateTick[];
  lanes: FishboneCanvasLane[];
  tasks: FishboneCanvasTaskNode[];
  relationLines: FishboneCanvasRelationLine[];
  taskNodeByTaskId: Map<string, FishboneCanvasTaskNode>;
  taskNodeByPath: Map<string, FishboneCanvasTaskNode>;
  taskNodeByTitle: Map<string, FishboneCanvasTaskNode>;
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

export interface FishboneCanvasAnchor {
  x: number;
  y: number;
}

export interface FishboneCanvasTaskNode {
  task: PlanningTask;
  laneId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  anchorTop: FishboneCanvasAnchor;
  anchorBottom: FishboneCanvasAnchor;
  anchorLeft: FishboneCanvasAnchor;
  anchorRight: FishboneCanvasAnchor;
  spineAnchor: FishboneCanvasAnchor;
  branchIndex: number;
  branchSide: "above" | "below";
  color: string;
}

export interface FishboneCanvasRelationLine {
  id: string;
  sourceTaskId: string;
  targetTaskId: string;
  source: FishboneCanvasTaskNode;
  target: FishboneCanvasTaskNode;
  relation: PlanningRelation;
  type: string;
  direction: string;
  label: string;
  color: string;
  className: string;
  dashed: boolean;
  arrow: "source" | "target" | "both" | "none";
  start: FishboneCanvasAnchor;
  end: FishboneCanvasAnchor;
  control1: FishboneCanvasAnchor;
  control2: FishboneCanvasAnchor;
}

export function buildFishboneCanvasLayout(
  tasks: PlanningTask[],
  mainlines: Mainline[],
  viewport: FishboneCanvasViewport
): FishboneCanvasLayout {
  const lanes = buildCanvasLanes(tasks, mainlines, viewport);
  const taskNodes = buildCanvasTasks(tasks, lanes, mainlines, viewport);
  const taskNodeByTaskId = new Map(taskNodes.map((node) => [node.task.taskId, node]));
  const taskNodeByPath = new Map(taskNodes.map((node) => [node.task.path, node]));
  const taskNodeByTitle = new Map(taskNodes.map((node) => [node.task.title, node]));
  const relationLines = buildRelationLines(taskNodes, taskNodeByTaskId, taskNodeByPath, taskNodeByTitle);
  const dateTicks = buildDateTicks(tasks, viewport);
  const stageWidth = Math.max(5200, ...dateTicks.map((tick) => tick.x + 420), ...taskNodes.map((node) => node.x + 420));
  const stageHeight = Math.max(900, ...lanes.map((lane) => lane.y + lane.height + 220));

  return {
    stageWidth,
    stageHeight,
    dateTicks,
    lanes,
    tasks: taskNodes,
    relationLines,
    taskNodeByTaskId,
    taskNodeByPath,
    taskNodeByTitle
  };
}

export function clientPointToCanvasPoint(
  clientX: number,
  clientY: number,
  canvasRect: DOMRect,
  viewport: FishboneCanvasViewport
): CanvasPoint {
  return {
    x: (clientX - canvasRect.left - viewport.panX) / viewport.canvasZoom,
    y: (clientY - canvasRect.top - viewport.panY) / viewport.canvasZoom
  };
}

export function canvasPointToDate(point: CanvasPoint, viewport: FishboneCanvasViewport): string | null {
  if (Math.abs(point.x - UNDATED_X) < viewport.timeScale * 0.6) {
    return null;
  }
  return canvasXToDate(point.x, viewport);
}

export function canvasPointToLane(lanes: FishboneCanvasLane[], point: CanvasPoint): FishboneCanvasLane | null {
  return getCanvasLaneAtY(lanes, point.y);
}

export function canvasPointToMainline(lanes: FishboneCanvasLane[], point: CanvasPoint): string | null | undefined {
  const lane = getCanvasLaneAtY(lanes, point.y);
  if (!lane) return undefined;
  return lane.isUnassigned ? null : lane.name;
}

export function getCanvasLaneAtY(lanes: FishboneCanvasLane[], y: number): FishboneCanvasLane | null {
  let nearest: FishboneCanvasLane | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const lane of lanes) {
    const inside = y >= lane.y && y <= lane.y + lane.height;
    if (inside) return lane;
    const distance = Math.abs(y - lane.spineY);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = lane;
    }
  }
  return nearest;
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
    const branchOffset = 44 + branchIndex * 52;
    const y = branchSide === "above" ? lane.spineY - branchOffset : lane.spineY + branchOffset;
    return createTaskNode(task, lane.id, x, y, branchIndex, branchSide, lane.color, lane.spineY);
  });
}

function createTaskNode(
  task: PlanningTask,
  laneId: string,
  x: number,
  y: number,
  branchIndex: number,
  branchSide: "above" | "below",
  color: string,
  spineY: number
): FishboneCanvasTaskNode {
  const halfWidth = TASK_NODE_WIDTH / 2;
  const halfHeight = TASK_NODE_HEIGHT / 2;
  return {
    task,
    laneId,
    x,
    y,
    width: TASK_NODE_WIDTH,
    height: TASK_NODE_HEIGHT,
    anchorTop: { x, y: y - halfHeight },
    anchorBottom: { x, y: y + halfHeight },
    anchorLeft: { x: x - halfWidth, y },
    anchorRight: { x: x + halfWidth, y },
    spineAnchor: { x, y: spineY },
    branchIndex,
    branchSide,
    color
  };
}

function buildRelationLines(
  taskNodes: FishboneCanvasTaskNode[],
  byTaskId: Map<string, FishboneCanvasTaskNode>,
  byPath: Map<string, FishboneCanvasTaskNode>,
  byTitle: Map<string, FishboneCanvasTaskNode>
): FishboneCanvasRelationLine[] {
  const lines: FishboneCanvasRelationLine[] = [];
  for (const source of taskNodes) {
    source.task.relations.forEach((relation, index) => {
      const target = resolveRelationTarget(relation.target, byTaskId, byPath, byTitle);
      if (!target || target.task.taskId === source.task.taskId) return;
      const start = source.x <= target.x ? source.anchorRight : source.anchorLeft;
      const end = source.x <= target.x ? target.anchorLeft : target.anchorRight;
      const distance = Math.max(80, Math.abs(end.x - start.x));
      const bend = Math.min(220, distance * 0.42);
      const direction = source.x <= target.x ? 1 : -1;
      const style = getRelationStyle(relation.type);
      lines.push({
        id: `${source.task.taskId}:${target.task.taskId}:${index}`,
        sourceTaskId: source.task.taskId,
        targetTaskId: target.task.taskId,
        source,
        target,
        relation,
        type: relation.type,
        direction: relation.direction,
        label: relation.label || relation.type,
        color: style.color,
        className: style.className,
        dashed: style.dashed,
        arrow: relation.direction === "both" ? "both" : relation.direction === "in" ? "source" : "target",
        start,
        end,
        control1: { x: start.x + bend * direction, y: start.y },
        control2: { x: end.x - bend * direction, y: end.y }
      });
    });
  }
  return lines;
}

function resolveRelationTarget(
  target: string,
  byTaskId: Map<string, FishboneCanvasTaskNode>,
  byPath: Map<string, FishboneCanvasTaskNode>,
  byTitle: Map<string, FishboneCanvasTaskNode>
): FishboneCanvasTaskNode | null {
  const normalized = normalizeRelationTarget(target);
  return byTaskId.get(normalized)
    ?? byPath.get(normalized)
    ?? byTitle.get(normalized)
    ?? byTitle.get(stripExtension(normalized))
    ?? null;
}

function normalizeRelationTarget(target: string): string {
  const trimmed = target.trim();
  const wiki = trimmed.match(/^\[\[(.+?)\]\]$/);
  return wiki ? wiki[1].split("|")[0].trim() : trimmed;
}

function stripExtension(value: string): string {
  return value.replace(/\.md$/i, "");
}

function getRelationStyle(type: string): { color: string; className: string; dashed: boolean } {
  if (type.includes("阻") || type.toLowerCase().includes("block")) {
    return { color: "var(--text-error)", className: "is-blocked", dashed: true };
  }
  if (type.includes("前") || type.includes("依")) {
    return { color: "var(--interactive-accent)", className: "is-dependency", dashed: true };
  }
  if (type.includes("参考")) {
    return { color: "var(--text-faint)", className: "is-reference", dashed: true };
  }
  if (type.includes("支") || type.includes("影响")) {
    return { color: "var(--color-yellow)", className: "is-support", dashed: true };
  }
  return { color: "var(--text-muted)", className: "is-related", dashed: true };
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
