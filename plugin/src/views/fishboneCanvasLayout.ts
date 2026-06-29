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
  getDateRangeFromValues,
  getDateTickRangePadding,
  getDateTickStep,
  getLaneHeight,
  getLocalDateString,
  parseDateString
} from "./fishboneCanvasViewport";
import {
  UNASSIGNED_COLOR,
  UNASSIGNED_LANE_ID,
  UNASSIGNED_LANE_NAME
} from "./fishboneRenderTypes";

export const TASK_NODE_WIDTH = 132;
export const TASK_NODE_HEIGHT = 58;
export const TASK_CLUSTER_WIDTH = 116;
export const TASK_CLUSTER_HEIGHT = 46;
const COMPACT_BUCKET_THRESHOLD = 10;
const COMPACT_BUCKET_VISIBLE_LIMIT = 8;

export interface FishboneCanvasLayoutOptions {
  showHiddenMainlines: boolean;
  expandedClusters: Set<string>;
}

export interface FishboneCanvasLayout {
  stageWidth: number;
  stageHeight: number;
  dateTicks: FishboneCanvasDateTick[];
  lanes: FishboneCanvasLane[];
  tasks: FishboneCanvasTaskNode[];
  clusters: FishboneCanvasTaskCluster[];
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
  isMajor: boolean;
}

export interface FishboneCanvasLane {
  id: string;
  name: string;
  color: string;
  y: number;
  height: number;
  spineY: number;
  isUnassigned: boolean;
  isCollapsed: boolean;
  isPinned: boolean;
  isHidden: boolean;
  taskCount: number;
}

export interface FishboneCanvasAnchor {
  x: number;
  y: number;
}

export interface FishboneCanvasTaskNode {
  task: PlanningTask;
  laneId: string;
  bucketId: string;
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
  isCompacted: boolean;
}

export interface FishboneCanvasTaskCluster {
  id: string;
  laneId: string;
  date: string | null;
  x: number;
  y: number;
  count: number;
  hiddenTaskIds: string[];
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
  viewport: FishboneCanvasViewport,
  options: FishboneCanvasLayoutOptions
): FishboneCanvasLayout {
  const lanes = buildCanvasLanes(tasks, mainlines, viewport, options);
  const { taskNodes, clusters } = buildCanvasTasks(tasks, lanes, mainlines, viewport, options);
  const taskNodeByTaskId = new Map(taskNodes.map((node) => [node.task.taskId, node]));
  const taskNodeByPath = new Map(taskNodes.map((node) => [node.task.path, node]));
  const taskNodeByTitle = new Map(taskNodes.map((node) => [node.task.title, node]));
  const relationLines = buildRelationLines(taskNodes, taskNodeByTaskId, taskNodeByPath, taskNodeByTitle);
  const dateTicks = buildDateTicks(tasks, viewport);
  const stageWidth = Math.max(
    5200,
    ...dateTicks.map((tick) => tick.x + 420),
    ...taskNodes.map((node) => node.x + 420),
    ...clusters.map((cluster) => cluster.x + 420)
  );
  const stageHeight = Math.max(900, ...lanes.map((lane) => lane.y + lane.height + 220));

  return {
    stageWidth,
    stageHeight,
    dateTicks,
    lanes,
    tasks: taskNodes,
    clusters,
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

function buildCanvasLanes(
  tasks: PlanningTask[],
  mainlines: Mainline[],
  viewport: FishboneCanvasViewport,
  options: FishboneCanvasLayoutOptions
): FishboneCanvasLane[] {
  const allMainlineNames = new Set(mainlines.map((mainline) => mainline.name));
  const visibleMainlines = mainlines
    .filter((mainline) => options.showHiddenMainlines || mainline.visible !== false)
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.order - b.order);
  const visibleNames = new Set(visibleMainlines.map((mainline) => mainline.name));
  const hasUnassignedTask = mainlines.length === 0 || tasks.some((task) => !task.mainline || !allMainlineNames.has(task.mainline));

  const laneSources = visibleMainlines.map((mainline) => ({
    id: mainline.id,
    name: mainline.name,
    color: mainline.color,
    isUnassigned: false,
    isCollapsed: mainline.collapsed === true,
    isPinned: mainline.pinned === true,
    isHidden: mainline.visible === false,
    taskCount: tasks.filter((task) => task.mainline === mainline.name).length
  }));
  if (hasUnassignedTask) {
    laneSources.push({
      id: UNASSIGNED_LANE_ID,
      name: UNASSIGNED_LANE_NAME,
      color: UNASSIGNED_COLOR,
      isUnassigned: true,
      isCollapsed: false,
      isPinned: false,
      isHidden: false,
      taskCount: tasks.filter((task) => !task.mainline || !allMainlineNames.has(task.mainline)).length
    });
  }

  const lanes: FishboneCanvasLane[] = [];
  let y = CANVAS_LANE_START_Y;
  for (const source of laneSources) {
    const height = getLaneHeight(viewport, source.id, source.isCollapsed);
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
  viewport: FishboneCanvasViewport,
  options: FishboneCanvasLayoutOptions
): { taskNodes: FishboneCanvasTaskNode[]; clusters: FishboneCanvasTaskCluster[] } {
  const laneByName = new Map<string, FishboneCanvasLane>();
  const allMainlineNames = new Set(mainlines.map((mainline) => mainline.name));
  for (const mainline of mainlines) {
    const lane = lanes.find((item) => item.id === mainline.id);
    if (lane) {
      laneByName.set(mainline.name, lane);
    }
  }
  const unassignedLane = lanes.find((lane) => lane.id === UNASSIGNED_LANE_ID) ?? lanes[0];
  if (!unassignedLane) return { taskNodes: [], clusters: [] };

  const bucketTasks = new Map<string, { lane: FishboneCanvasLane; date: string | null; tasks: PlanningTask[] }>();
  for (const task of tasks) {
    const lane = resolveTaskLane(task, laneByName, allMainlineNames, unassignedLane);
    if (!lane || lane.isCollapsed) continue;
    const bucketId = buildBucketId(lane.id, task.date);
    const bucket = bucketTasks.get(bucketId) ?? { lane, date: task.date, tasks: [] };
    bucket.tasks.push(task);
    bucketTasks.set(bucketId, bucket);
  }

  const taskNodes: FishboneCanvasTaskNode[] = [];
  const clusters: FishboneCanvasTaskCluster[] = [];
  for (const [bucketId, bucket] of bucketTasks) {
    const expanded = options.expandedClusters.has(bucketId);
    const compacted = bucket.tasks.length >= COMPACT_BUCKET_THRESHOLD && !expanded;
    const visibleTasks = compacted ? bucket.tasks.slice(0, COMPACT_BUCKET_VISIBLE_LIMIT) : bucket.tasks;
    visibleTasks.forEach((task, index) => {
      taskNodes.push(createTaskNodeForBucket(task, bucket.lane, bucket.date, index, visibleTasks.length, viewport, bucketId, compacted));
    });

    if (compacted) {
      const hiddenTasks = bucket.tasks.slice(COMPACT_BUCKET_VISIBLE_LIMIT);
      clusters.push({
        id: bucketId,
        laneId: bucket.lane.id,
        date: bucket.date,
        x: dateToCanvasX(bucket.date, viewport) + getBucketClusterOffset(visibleTasks.length, viewport),
        y: bucket.lane.spineY + 78,
        count: hiddenTasks.length,
        hiddenTaskIds: hiddenTasks.map((task) => task.taskId),
        color: bucket.lane.color
      });
    }
  }

  return { taskNodes, clusters };
}

function resolveTaskLane(
  task: PlanningTask,
  laneByName: Map<string, FishboneCanvasLane>,
  allMainlineNames: Set<string>,
  unassignedLane: FishboneCanvasLane
): FishboneCanvasLane | null {
  if (!task.mainline) return unassignedLane;
  const lane = laneByName.get(task.mainline);
  if (lane) return lane;
  return allMainlineNames.has(task.mainline) ? null : unassignedLane;
}

function createTaskNodeForBucket(
  task: PlanningTask,
  lane: FishboneCanvasLane,
  date: string | null,
  index: number,
  bucketSize: number,
  viewport: FishboneCanvasViewport,
  bucketId: string,
  isCompacted: boolean
): FishboneCanvasTaskNode {
  const x = dateToCanvasX(date, viewport) + getDenseBucketOffset(index, bucketSize, viewport);
  const branchSide = index % 2 === 0 ? "above" : "below";
  const branchIndex = Math.floor(index / 2);
  const branchOffset = isCompacted ? 34 + branchIndex * 28 : 40 + branchIndex * 32;
  const y = branchSide === "above" ? lane.spineY - branchOffset : lane.spineY + branchOffset;
  return createTaskNode(task, lane.id, bucketId, x, y, branchIndex, branchSide, lane.color, lane.spineY, isCompacted);
}

function getDenseBucketOffset(index: number, bucketSize: number, viewport: FishboneCanvasViewport): number {
  if (bucketSize <= 1) return 0;
  const step = clampNumber(viewport.timeScale * 0.86, 88, 142);
  return (index - (bucketSize - 1) / 2) * step;
}

function getBucketClusterOffset(visibleCount: number, viewport: FishboneCanvasViewport): number {
  if (visibleCount <= 1) return TASK_NODE_WIDTH;
  return getDenseBucketOffset(visibleCount - 1, visibleCount, viewport) + TASK_NODE_WIDTH;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function createTaskNode(
  task: PlanningTask,
  laneId: string,
  bucketId: string,
  x: number,
  y: number,
  branchIndex: number,
  branchSide: "above" | "below",
  color: string,
  spineY: number,
  isCompacted: boolean
): FishboneCanvasTaskNode {
  const halfWidth = TASK_NODE_WIDTH / 2;
  const halfHeight = TASK_NODE_HEIGHT / 2;
  return {
    task,
    laneId,
    bucketId,
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
    color,
    isCompacted
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
  const taskRange = getDateRangeFromValues(taskDates);
  const padding = getDateTickRangePadding(viewport.timeAxisMode);
  const minOffset = Math.min(-padding, ...taskDates.map((date) => dateDiff(viewport.centerDate, date)));
  const maxOffset = Math.max(padding, ...taskDates.map((date) => dateDiff(viewport.centerDate, date)));
  const center = parseDateString(viewport.centerDate) ?? new Date();
  const ticks: FishboneCanvasDateTick[] = [];

  if (viewport.timeAxisMode === "overview" && taskDates.length > 0) {
    const keyDates = new Set([...taskDates, today, taskRange.start, taskRange.end].filter((value): value is string => Boolean(value)));
    for (const id of [...keyDates].sort()) {
      const date = parseDateString(id);
      if (!date) continue;
      ticks.push(createDateTick(id, date, today, viewport));
    }
  } else {
    const step = getDateTickStep(viewport.timeAxisMode);
    const startOffset = Math.floor(minOffset / step) * step;
    for (let offset = startOffset; offset <= maxOffset; offset += step) {
      const date = new Date(center.getFullYear(), center.getMonth(), center.getDate());
      date.setDate(center.getDate() + offset);
      const id = getLocalDateString(date);
      ticks.push(createDateTick(id, date, today, viewport));
    }
  }

  ticks.unshift({
    id: "__undated__",
    x: dateToCanvasX(null, viewport),
    y: CANVAS_AXIS_Y,
    label: "无日期",
    detail: "待排期",
    isToday: false,
    isWeekend: false,
    isMajor: false
  });

  return ticks;
}

function createDateTick(id: string, date: Date, today: string, viewport: FishboneCanvasViewport): FishboneCanvasDateTick {
  const day = date.getDay();
  return {
    id,
    x: dateToCanvasX(id, viewport),
    y: CANVAS_AXIS_Y,
    label: formatCanvasDate(id, viewport.timeAxisMode),
    detail: formatCanvasWeekday(id, viewport.timeAxisMode),
    isToday: id === today,
    isWeekend: day === 0 || day === 6,
    isMajor: date.getDate() === 1 || day === 1 || id === today
  };
}

function buildBucketId(laneId: string, date: string | null): string {
  return `${laneId}:${date ?? "__undated__"}`;
}

function dateDiff(from: string, to: string): number {
  const fromDate = parseDateString(from);
  const toDate = parseDateString(to);
  if (!fromDate || !toDate) return 0;
  return Math.round((toDate.getTime() - fromDate.getTime()) / 86400000);
}
