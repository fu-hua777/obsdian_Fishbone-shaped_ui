import { Mainline, PlanningRelation, PlanningTask } from "../data/taskTypes";
import {
  FishboneCanvasViewport,
  CANVAS_AXIS_Y,
  CANVAS_ORIGIN_X,
  CANVAS_LANE_START_Y,
  LANE_GAP,
  UNDATED_X,
  CanvasPoint,
  canvasXToDate,
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

export const TASK_NODE_WIDTH = 136;
export const TASK_NODE_HEIGHT = 34;
export const TASK_CLUSTER_WIDTH = 116;
export const TASK_CLUSTER_HEIGHT = 46;
const COMPACT_BUCKET_THRESHOLD = 10;
const COMPACT_BUCKET_VISIBLE_LIMIT = 8;
const TASK_NODE_COLUMN_GAP = 24;
const TASK_SIDE_BASE_OFFSET = 46;
const TASK_SIDE_TRACK_GAP = 44;
const TASK_TRACK_COLLISION_GAP = 18;

export interface FishboneCanvasLayoutOptions {
  showHiddenMainlines: boolean;
  expandedClusters: Set<string>;
}

export interface FishboneCanvasLayout {
  stageWidth: number;
  stageHeight: number;
  dateTicks: FishboneCanvasDateTick[];
  lanes: FishboneCanvasLane[];
  branchMainlines: FishboneCanvasBranchMainline[];
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
  branchMainlineId: string | null;
  effectiveDate: string | null;
}

export interface FishboneCanvasBranchMainline {
  id: string;
  name: string;
  color: string;
  parentMainlineId: string;
  parentLaneId: string;
  xStart: number;
  xEnd: number;
  y: number;
  parentY: number;
  side: "above" | "below";
  taskCount: number;
  isCollapsed: boolean;
  startDate: string;
  endDate: string;
  branchOffset: number;
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
  labelAnchor: FishboneCanvasAnchor;
}

interface FishboneDateScale {
  slotWidths: Map<string, number>;
}

export function buildFishboneCanvasLayout(
  tasks: PlanningTask[],
  mainlines: Mainline[],
  viewport: FishboneCanvasViewport,
  options: FishboneCanvasLayoutOptions
): FishboneCanvasLayout {
  const lanes = buildCanvasLanes(tasks, mainlines, viewport, options);
  const dateScale = buildDateScale(tasks, lanes, mainlines, viewport);
  const branchMainlines = buildCanvasBranchMainlines(tasks, mainlines, lanes, viewport, options, dateScale);
  const { taskNodes, clusters } = buildCanvasTasks(tasks, lanes, branchMainlines, mainlines, viewport, options, dateScale);
  const taskNodeByTaskId = new Map(taskNodes.map((node) => [node.task.taskId, node]));
  const taskNodeByPath = new Map(taskNodes.map((node) => [node.task.path, node]));
  const taskNodeByTitle = new Map(taskNodes.map((node) => [node.task.title, node]));
  const relationLines = buildRelationLines(taskNodes, taskNodeByTaskId, taskNodeByPath, taskNodeByTitle);
  const dateTicks = buildDateTicks(tasks, mainlines, viewport, dateScale);
  const stageWidth = Math.max(
    5200,
    ...dateTicks.map((tick) => tick.x + 420),
    ...branchMainlines.map((branch) => branch.xEnd + 420),
    ...taskNodes.map((node) => node.x + 420),
    ...clusters.map((cluster) => cluster.x + 420)
  );
  const stageHeight = Math.max(
    900,
    ...lanes.map((lane) => lane.y + lane.height + 220),
    ...branchMainlines.map((branch) => branch.y + 220),
    ...taskNodes.map((node) => node.y + node.height + 220),
    ...clusters.map((cluster) => cluster.y + TASK_CLUSTER_HEIGHT + 220)
  );

  return {
    stageWidth,
    stageHeight,
    dateTicks,
    lanes,
    branchMainlines,
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

export function canvasPointToBranchMainline(branchMainlines: FishboneCanvasBranchMainline[], point: CanvasPoint): FishboneCanvasBranchMainline | null {
  let nearest: FishboneCanvasBranchMainline | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const branch of branchMainlines) {
    const withinX = point.x >= branch.xStart - 36 && point.x <= branch.xEnd + 36;
    const distance = Math.abs(point.y - branch.y);
    if (withinX && distance <= 42 && distance < nearestDistance) {
      nearest = branch;
      nearestDistance = distance;
    }
  }
  return nearest;
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
  const rootMainlines = mainlines.filter((mainline) => mainline.type !== "branch");
  const allMainlineNames = new Set(rootMainlines.map((mainline) => mainline.name));
  const visibleMainlines = mainlines
    .filter((mainline) => mainline.type !== "branch")
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

function buildDateScale(
  tasks: PlanningTask[],
  lanes: FishboneCanvasLane[],
  mainlines: Mainline[],
  viewport: FishboneCanvasViewport
): FishboneDateScale {
  const laneByName = new Map<string, FishboneCanvasLane>();
  const rootMainlines = mainlines.filter((mainline) => mainline.type !== "branch");
  const branchMainlines = mainlines.filter((mainline) => mainline.type === "branch");
  const allMainlineNames = new Set(rootMainlines.map((mainline) => mainline.name));
  const branchById = new Map(branchMainlines.map((mainline) => [mainline.id, mainline]));
  const branchByName = new Map(branchMainlines.map((mainline) => [mainline.name, mainline]));
  for (const mainline of rootMainlines) {
    const lane = lanes.find((item) => item.id === mainline.id);
    if (lane) {
      laneByName.set(mainline.name, lane);
    }
  }

  const unassignedLane = lanes.find((lane) => lane.id === UNASSIGNED_LANE_ID) ?? lanes[0];
  const bucketCounts = new Map<string, { date: string; count: number }>();
  if (!unassignedLane) {
    return { slotWidths: new Map() };
  }

  for (const task of tasks) {
    if (!task.date || !parseDateString(task.date)) continue;
    const branch = resolveTaskBranchMainline(task, branchById, branchByName);
    if (branch && branch.startDate && branch.endDate) {
      const startDate = normalizeBranchDate(branch.startDate);
      const endDate = normalizeBranchDate(branch.endDate);
      if (!startDate || !endDate) continue;
      const normalizedStart = startDate <= endDate ? startDate : endDate;
      const normalizedEnd = startDate <= endDate ? endDate : startDate;
      const date = clampDateToRange(task.date, normalizedStart, normalizedEnd);
      const key = buildBucketId(branch.id, date);
      const bucket = bucketCounts.get(key) ?? { date, count: 0 };
      bucket.count += 1;
      bucketCounts.set(key, bucket);
      continue;
    }
    const lane = resolveTaskLane(task, laneByName, allMainlineNames, unassignedLane);
    if (!lane || lane.isCollapsed) continue;
    const key = buildBucketId(lane.id, task.date);
    const bucket = bucketCounts.get(key) ?? { date: task.date, count: 0 };
    bucket.count += 1;
    bucketCounts.set(key, bucket);
  }

  const slotWidths = new Map<string, number>();
  for (const bucket of bucketCounts.values()) {
    const visibleCount = Math.min(bucket.count, COMPACT_BUCKET_VISIBLE_LIMIT);
    const width = getDateSlotWidth(visibleCount, viewport);
    slotWidths.set(bucket.date, Math.max(slotWidths.get(bucket.date) ?? viewport.timeScale, width));
  }

  return { slotWidths };
}

function buildCanvasBranchMainlines(
  tasks: PlanningTask[],
  mainlines: Mainline[],
  lanes: FishboneCanvasLane[],
  viewport: FishboneCanvasViewport,
  options: FishboneCanvasLayoutOptions,
  dateScale: FishboneDateScale
): FishboneCanvasBranchMainline[] {
  const laneByMainlineId = new Map(lanes.map((lane) => [lane.id, lane]));
  const branchesByParent = new Map<string, Mainline[]>();
  const branches = mainlines
    .filter((mainline) => mainline.type === "branch")
    .filter((mainline) => options.showHiddenMainlines || mainline.visible !== false)
    .filter((mainline) => Boolean(mainline.parentMainlineId && mainline.startDate && mainline.endDate));

  for (const branch of branches) {
    const parentId = branch.parentMainlineId as string;
    const list = branchesByParent.get(parentId) ?? [];
    list.push(branch);
    branchesByParent.set(parentId, list);
  }

  const result: FishboneCanvasBranchMainline[] = [];
  for (const [parentId, parentBranches] of branchesByParent) {
    const parentLane = laneByMainlineId.get(parentId);
    if (!parentLane || parentLane.isCollapsed) continue;
    parentBranches
      .sort((a, b) => a.order - b.order)
      .forEach((branch, index) => {
        const startDate = normalizeBranchDate(branch.startDate);
        const endDate = normalizeBranchDate(branch.endDate);
        if (!startDate || !endDate) return;
        const normalizedStart = startDate <= endDate ? startDate : endDate;
        const normalizedEnd = startDate <= endDate ? endDate : startDate;
        const side = index % 2 === 0 ? -1 : 1;
        const stack = Math.floor(index / 2);
        const branchOffset = branch.branchOffset ?? 0;
        const y = parentLane.spineY + side * (58 + stack * 42) + branchOffset;
        const xStart = dateToCanvasXWithScale(normalizedStart, viewport, dateScale);
        const xEnd = dateToCanvasXWithScale(normalizedEnd, viewport, dateScale);
        result.push({
          id: branch.id,
          name: branch.name,
          color: branch.color,
          parentMainlineId: parentId,
          parentLaneId: parentLane.id,
          xStart: Math.min(xStart, xEnd),
          xEnd: Math.max(xStart, xEnd),
          y,
          parentY: parentLane.spineY,
          side: y < parentLane.spineY ? "above" : "below",
          taskCount: tasks.filter((task) => task.branchMainlineId === branch.id || task.branchMainline === branch.name).length,
          isCollapsed: branch.collapsed,
          startDate: normalizedStart,
          endDate: normalizedEnd,
          branchOffset
        });
      });
  }
  return result;
}

function buildCanvasTasks(
  tasks: PlanningTask[],
  lanes: FishboneCanvasLane[],
  branchMainlines: FishboneCanvasBranchMainline[],
  mainlines: Mainline[],
  viewport: FishboneCanvasViewport,
  options: FishboneCanvasLayoutOptions,
  dateScale: FishboneDateScale
): { taskNodes: FishboneCanvasTaskNode[]; clusters: FishboneCanvasTaskCluster[] } {
  const laneByName = new Map<string, FishboneCanvasLane>();
  const rootMainlines = mainlines.filter((mainline) => mainline.type !== "branch");
  const allMainlineNames = new Set(rootMainlines.map((mainline) => mainline.name));
  const branchById = new Map(branchMainlines.map((branch) => [branch.id, branch]));
  const branchByName = new Map(branchMainlines.map((branch) => [branch.name, branch]));
  for (const mainline of rootMainlines) {
    const lane = lanes.find((item) => item.id === mainline.id);
    if (lane) {
      laneByName.set(mainline.name, lane);
    }
  }
  const unassignedLane = lanes.find((lane) => lane.id === UNASSIGNED_LANE_ID) ?? lanes[0];
  if (!unassignedLane) return { taskNodes: [], clusters: [] };

  const bucketTasks = new Map<string, { lane: FishboneCanvasLane; date: string | null; tasks: PlanningTask[] }>();
  for (const task of tasks) {
    const branch = resolveTaskBranch(task, branchById, branchByName);
    if (branch && !branch.isCollapsed) {
      const date = clampDateToRange(task.date, branch.startDate, branch.endDate);
      const bucketId = buildBucketId(branch.id, date);
      const bucket = bucketTasks.get(bucketId) ?? { lane: createBranchTaskLane(branch), date, tasks: [] };
      bucket.tasks.push(task);
      bucketTasks.set(bucketId, bucket);
      continue;
    }
    const lane = resolveTaskLane(task, laneByName, allMainlineNames, unassignedLane);
    if (!lane || lane.isCollapsed) continue;
    const bucketId = buildBucketId(lane.id, task.date);
    const bucket = bucketTasks.get(bucketId) ?? { lane, date: task.date, tasks: [] };
    bucket.tasks.push(task);
    bucketTasks.set(bucketId, bucket);
  }

  const taskNodes: FishboneCanvasTaskNode[] = [];
  const clusters: FishboneCanvasTaskCluster[] = [];
  const sortedBuckets = [...bucketTasks.entries()].sort(([, a], [, b]) => {
    const laneCompare = a.lane.id.localeCompare(b.lane.id);
    if (laneCompare !== 0) return laneCompare;
    return dateToCanvasXWithScale(a.date, viewport, dateScale) - dateToCanvasXWithScale(b.date, viewport, dateScale);
  });

  for (const [bucketId, bucket] of sortedBuckets) {
    const expanded = options.expandedClusters.has(bucketId);
    const compacted = bucket.tasks.length >= COMPACT_BUCKET_THRESHOLD && !expanded;
    const visibleTasks = compacted ? bucket.tasks.slice(0, COMPACT_BUCKET_VISIBLE_LIMIT) : bucket.tasks;
    visibleTasks.forEach((task, index) => {
      const branchMainlineId = branchById.has(bucket.lane.id) ? bucket.lane.id : null;
      taskNodes.push(createTaskNodeForBucket(task, bucket.lane, bucket.date, index, visibleTasks.length, viewport, dateScale, bucketId, compacted, branchMainlineId));
    });

    if (compacted) {
      const hiddenTasks = bucket.tasks.slice(COMPACT_BUCKET_VISIBLE_LIMIT);
      clusters.push({
        id: bucketId,
        laneId: bucket.lane.id,
        date: bucket.date,
        x: dateToCanvasXWithScale(bucket.date, viewport, dateScale) + getBucketClusterOffset(visibleTasks.length),
        y: bucket.lane.spineY + 78,
        count: hiddenTasks.length,
        hiddenTaskIds: hiddenTasks.map((task) => task.taskId),
        color: bucket.lane.color
      });
    }
  }

  resolveTaskNodeTracks(taskNodes);
  return { taskNodes, clusters };
}

function createBranchTaskLane(branch: FishboneCanvasBranchMainline): FishboneCanvasLane {
  return {
    id: branch.id,
    name: branch.name,
    color: branch.color,
    y: branch.y - 48,
    height: 96,
    spineY: branch.y,
    isUnassigned: false,
    isCollapsed: branch.isCollapsed,
    isPinned: false,
    isHidden: false,
    taskCount: branch.taskCount
  };
}

function resolveTaskBranch(
  task: PlanningTask,
  branchById: Map<string, FishboneCanvasBranchMainline>,
  branchByName: Map<string, FishboneCanvasBranchMainline>
): FishboneCanvasBranchMainline | null {
  if (task.branchMainlineId && branchById.has(task.branchMainlineId)) {
    return branchById.get(task.branchMainlineId) ?? null;
  }
  if (task.branchMainline && branchByName.has(task.branchMainline)) {
    return branchByName.get(task.branchMainline) ?? null;
  }
  return null;
}

function resolveTaskBranchMainline(
  task: PlanningTask,
  branchById: Map<string, Mainline>,
  branchByName: Map<string, Mainline>
): Mainline | null {
  if (task.branchMainlineId && branchById.has(task.branchMainlineId)) {
    return branchById.get(task.branchMainlineId) ?? null;
  }
  if (task.branchMainline && branchByName.has(task.branchMainline)) {
    return branchByName.get(task.branchMainline) ?? null;
  }
  return null;
}

function normalizeBranchDate(value: string | null): string | null {
  return value && parseDateString(value) ? value : null;
}

function clampDateToRange(date: string | null, startDate: string, endDate: string): string {
  if (!date || !parseDateString(date)) return startDate;
  if (date < startDate) return startDate;
  if (date > endDate) return endDate;
  return date;
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
  dateScale: FishboneDateScale,
  bucketId: string,
  isCompacted: boolean,
  branchMainlineId: string | null
): FishboneCanvasTaskNode {
  const x = dateToCanvasXWithScale(date, viewport, dateScale) + getDenseBucketOffset(index, bucketSize);
  const baseSide = getBucketBaseSide(lane.id, date);
  const branchSide = index % 2 === 0 ? baseSide : getOppositeBranchSide(baseSide);
  const branchIndex = Math.floor(index / 2);
  const branchOffset = isCompacted ? 34 + branchIndex * 36 : TASK_SIDE_BASE_OFFSET + branchIndex * TASK_SIDE_TRACK_GAP;
  const y = branchSide === "above" ? lane.spineY - branchOffset : lane.spineY + branchOffset;
  return createTaskNode(task, lane.id, bucketId, x, y, branchIndex, branchSide, lane.color, lane.spineY, isCompacted, branchMainlineId, date);
}

function resolveTaskNodeTracks(taskNodes: FishboneCanvasTaskNode[]): void {
  const groups = new Map<string, FishboneCanvasTaskNode[]>();
  for (const node of taskNodes) {
    const key = `${node.laneId}:${node.branchSide}`;
    const group = groups.get(key) ?? [];
    group.push(node);
    groups.set(key, group);
  }

  for (const group of groups.values()) {
    const trackRightEdges: number[] = [];
    group
      .sort((a, b) => a.x - b.x || a.y - b.y || a.task.title.localeCompare(b.task.title))
      .forEach((node) => {
        const left = node.x - node.width / 2;
        const right = node.x + node.width / 2;
        let track = trackRightEdges.findIndex((edge) => left >= edge + TASK_TRACK_COLLISION_GAP);
        if (track < 0) {
          track = trackRightEdges.length;
          trackRightEdges.push(Number.NEGATIVE_INFINITY);
        }
        trackRightEdges[track] = right;
        moveTaskNodeToTrack(node, track);
      });
  }
}

function moveTaskNodeToTrack(node: FishboneCanvasTaskNode, track: number): void {
  const offset = (node.isCompacted ? 34 : TASK_SIDE_BASE_OFFSET) + track * TASK_SIDE_TRACK_GAP;
  const y = node.branchSide === "above" ? node.spineAnchor.y - offset : node.spineAnchor.y + offset;
  node.y = y;
  node.branchIndex = track;
  const halfWidth = node.width / 2;
  const halfHeight = node.height / 2;
  node.anchorTop = { x: node.x, y: y - halfHeight };
  node.anchorBottom = { x: node.x, y: y + halfHeight };
  node.anchorLeft = { x: node.x - halfWidth, y };
  node.anchorRight = { x: node.x + halfWidth, y };
}

function getBucketBaseSide(laneId: string, date: string | null): "above" | "below" {
  if (!date) return laneId === UNASSIGNED_LANE_ID ? "above" : "below";
  const parsed = parseDateString(date);
  if (!parsed) return "below";
  const seed = parsed.getDate() + laneId.length;
  return seed % 2 === 0 ? "above" : "below";
}

function getOppositeBranchSide(side: "above" | "below"): "above" | "below" {
  return side === "above" ? "below" : "above";
}

function getDenseBucketOffset(index: number, bucketSize: number): number {
  if (bucketSize <= 1) return 0;
  const step = TASK_NODE_WIDTH + TASK_NODE_COLUMN_GAP;
  const column = Math.floor(index / 2);
  const columnCount = Math.ceil(bucketSize / 2);
  return (column - (columnCount - 1) / 2) * step;
}

function getBucketClusterOffset(visibleCount: number): number {
  if (visibleCount <= 1) return TASK_NODE_WIDTH;
  return getDenseBucketOffset(visibleCount - 1, visibleCount) + TASK_NODE_WIDTH;
}

function getDateSlotWidth(visibleCount: number, viewport: FishboneCanvasViewport): number {
  if (visibleCount <= 2) {
    return viewport.timeScale;
  }
  const columnCount = Math.ceil(visibleCount / 2);
  const requiredWidth = columnCount * TASK_NODE_WIDTH + Math.max(0, columnCount - 1) * TASK_NODE_COLUMN_GAP + 80;
  return Math.max(viewport.timeScale, requiredWidth);
}

function dateToCanvasXWithScale(date: string | null, viewport: FishboneCanvasViewport, dateScale: FishboneDateScale): number {
  if (!date) {
    return UNDATED_X;
  }
  const offset = dateDiff(viewport.centerDate, date);
  if (offset === 0) {
    return CANVAS_ORIGIN_X;
  }

  let x = CANVAS_ORIGIN_X;
  if (offset > 0) {
    for (let day = 0; day < offset; day += 1) {
      const current = addDays(viewport.centerDate, day);
      const next = addDays(viewport.centerDate, day + 1);
      x += (getDateSlotWidthForDate(current, viewport, dateScale) + getDateSlotWidthForDate(next, viewport, dateScale)) / 2;
    }
    return x;
  }

  for (let day = 0; day > offset; day -= 1) {
    const current = addDays(viewport.centerDate, day);
    const previous = addDays(viewport.centerDate, day - 1);
    x -= (getDateSlotWidthForDate(current, viewport, dateScale) + getDateSlotWidthForDate(previous, viewport, dateScale)) / 2;
  }
  return x;
}

function getDateSlotWidthForDate(date: string, viewport: FishboneCanvasViewport, dateScale: FishboneDateScale): number {
  return dateScale.slotWidths.get(date) ?? viewport.timeScale;
}

function addDays(date: string, offset: number): string {
  const parsed = parseDateString(date) ?? new Date();
  parsed.setDate(parsed.getDate() + offset);
  return getLocalDateString(parsed);
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
  isCompacted: boolean,
  branchMainlineId: string | null,
  effectiveDate: string | null
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
    isCompacted,
    branchMainlineId,
    effectiveDate
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
      const route = getRelationRoute(source, target, relation.label || relation.type, index, taskNodes);
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
        start: route.start,
        end: route.end,
        control1: route.control1,
        control2: route.control2,
        labelAnchor: route.labelAnchor
      });
    });
  }
  return lines;
}

function getRelationRoute(
  source: FishboneCanvasTaskNode,
  target: FishboneCanvasTaskNode,
  label: string,
  index: number,
  taskNodes: FishboneCanvasTaskNode[]
): { start: FishboneCanvasAnchor; end: FishboneCanvasAnchor; control1: FishboneCanvasAnchor; control2: FishboneCanvasAnchor; labelAnchor: FishboneCanvasAnchor } {
  const anchorCandidates = getRelationAnchorCandidates(source, target);
  let best = buildRelationRoute(anchorCandidates[0].start, anchorCandidates[0].end, label, index, source, target, taskNodes, 0.38, 0);
  let bestScore = scoreRelationRoute(best, label, source, target, taskNodes);
  for (let anchorIndex = 0; anchorIndex < anchorCandidates.length; anchorIndex += 1) {
    const anchors = anchorCandidates[anchorIndex];
    for (const bendScale of [0.38, 0.55, 0.72]) {
      const distance = Math.max(80, Math.abs(anchors.end.x - anchors.start.x));
      const verticalDistance = Math.abs(anchors.end.y - anchors.start.y);
      const bend = Math.min(340, Math.max(90, distance * bendScale));
      for (const routeOffset of buildRelationRouteCandidates(getPreferredRelationOffset(index, anchors.start, anchors.end, verticalDistance))) {
        const route = buildRelationRoute(anchors.start, anchors.end, label, index, source, target, taskNodes, bendScale, routeOffset);
        const score = scoreRelationRoute(route, label, source, target, taskNodes) + anchorIndex * 18 + Math.abs(routeOffset) * 0.4 + bend * 0.05;
        if (score < bestScore) {
          best = route;
          bestScore = score;
        }
        if (bestScore < 1) return best;
      }
    }
  }
  return best;
}

function buildRelationRoute(
  start: FishboneCanvasAnchor,
  end: FishboneCanvasAnchor,
  label: string,
  index: number,
  source: FishboneCanvasTaskNode,
  target: FishboneCanvasTaskNode,
  taskNodes: FishboneCanvasTaskNode[],
  bendScale: number,
  routeOffset: number
): { start: FishboneCanvasAnchor; end: FishboneCanvasAnchor; control1: FishboneCanvasAnchor; control2: FishboneCanvasAnchor; labelAnchor: FishboneCanvasAnchor } {
  const distance = Math.max(80, Math.abs(end.x - start.x));
  const bend = Math.min(340, Math.max(90, distance * bendScale));
  const startNormal = getAnchorOutwardNormal(source, start);
  const endNormal = getAnchorOutwardNormal(target, end);
  const tangent = getRoutePerpendicular(start, end);
  const control1 = {
    x: start.x + bend * startNormal.x + tangent.x * routeOffset,
    y: start.y + bend * startNormal.y + tangent.y * routeOffset
  };
  const control2 = {
    x: end.x + bend * endNormal.x + tangent.x * routeOffset,
    y: end.y + bend * endNormal.y + tangent.y * routeOffset
  };
  const labelAnchor = getRelationLabelAnchor(start, control1, control2, end, label, index, source, target, taskNodes);
  return { start, end, control1, control2, labelAnchor };
}

function getRelationAnchors(source: FishboneCanvasTaskNode, target: FishboneCanvasTaskNode): { start: FishboneCanvasAnchor; end: FishboneCanvasAnchor } {
  const horizontalDistance = Math.abs(source.x - target.x);
  const verticalDistance = Math.abs(source.y - target.y);
  if (horizontalDistance < TASK_NODE_WIDTH * 0.75 && verticalDistance > TASK_NODE_HEIGHT) {
    return source.y <= target.y
      ? { start: source.anchorBottom, end: target.anchorTop }
      : { start: source.anchorTop, end: target.anchorBottom };
  }
  return source.x <= target.x
    ? { start: source.anchorRight, end: target.anchorLeft }
    : { start: source.anchorLeft, end: target.anchorRight };
}

function getRelationAnchorCandidates(source: FishboneCanvasTaskNode, target: FishboneCanvasTaskNode): Array<{ start: FishboneCanvasAnchor; end: FishboneCanvasAnchor }> {
  const preferred = getRelationAnchors(source, target);
  const candidates = [
    preferred,
    { start: source.anchorRight, end: target.anchorLeft },
    { start: source.anchorLeft, end: target.anchorRight },
    { start: source.anchorTop, end: target.anchorBottom },
    { start: source.anchorBottom, end: target.anchorTop },
    { start: source.anchorRight, end: target.anchorTop },
    { start: source.anchorRight, end: target.anchorBottom },
    { start: source.anchorLeft, end: target.anchorTop },
    { start: source.anchorLeft, end: target.anchorBottom },
    { start: source.anchorTop, end: target.anchorLeft },
    { start: source.anchorBottom, end: target.anchorLeft },
    { start: source.anchorTop, end: target.anchorRight },
    { start: source.anchorBottom, end: target.anchorRight }
  ];
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = `${candidate.start.x}:${candidate.start.y}:${candidate.end.x}:${candidate.end.y}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getPreferredRelationOffset(index: number, start: FishboneCanvasAnchor, end: FishboneCanvasAnchor, verticalDistance: number): number {
  const laneSide = start.y <= end.y ? -1 : 1;
  const alternating = index % 2 === 0 ? 1 : -1;
  const congestionOffset = Math.min(90, verticalDistance * 0.18);
  return (24 + congestionOffset + Math.floor(index / 2) * 14) * laneSide * alternating;
}

function getAnchorOutwardNormal(node: FishboneCanvasTaskNode, anchor: FishboneCanvasAnchor): FishboneCanvasAnchor {
  const epsilon = 0.001;
  if (Math.abs(anchor.x - (node.x - node.width / 2)) <= epsilon) return { x: -1, y: 0 };
  if (Math.abs(anchor.x - (node.x + node.width / 2)) <= epsilon) return { x: 1, y: 0 };
  if (Math.abs(anchor.y - (node.y - node.height / 2)) <= epsilon) return { x: 0, y: -1 };
  if (Math.abs(anchor.y - (node.y + node.height / 2)) <= epsilon) return { x: 0, y: 1 };
  return anchor.x <= node.x ? { x: -1, y: 0 } : { x: 1, y: 0 };
}

function getRoutePerpendicular(start: FishboneCanvasAnchor, end: FishboneCanvasAnchor): FishboneCanvasAnchor {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.max(1, Math.hypot(dx, dy));
  return { x: -dy / length, y: dx / length };
}

function scoreRelationRoute(
  route: { start: FishboneCanvasAnchor; end: FishboneCanvasAnchor; control1: FishboneCanvasAnchor; control2: FishboneCanvasAnchor; labelAnchor: FishboneCanvasAnchor },
  label: string,
  source: FishboneCanvasTaskNode,
  target: FishboneCanvasTaskNode,
  taskNodes: FishboneCanvasTaskNode[]
): number {
  let score = 0;
  for (const node of taskNodes) {
    const isEndpoint = node.task.taskId === source.task.taskId || node.task.taskId === target.task.taskId;
    if (!isEndpoint && relationCurveIntersectsTask(route.start, route.control1, route.control2, route.end, node, 12)) {
      score += 18000;
    }
    if (isEndpoint && relationCurveIntersectsTask(route.start, route.control1, route.control2, route.end, node, -3)) {
      score += 6000;
    }
    if (relationLabelIntersectsTask(route.labelAnchor, label, node, 12)) {
      score += isEndpoint ? 9000 : 12000;
    }
  }
  score += Math.abs(route.control1.y - route.start.y) * 0.18;
  score += Math.abs(route.control2.y - route.end.y) * 0.18;
  return score;
}

function getRelationLabelAnchor(
  start: FishboneCanvasAnchor,
  control1: FishboneCanvasAnchor,
  control2: FishboneCanvasAnchor,
  end: FishboneCanvasAnchor,
  label: string,
  index: number,
  source: FishboneCanvasTaskNode,
  target: FishboneCanvasTaskNode,
  taskNodes: FishboneCanvasTaskNode[]
): FishboneCanvasAnchor {
  const samples = [0.5, 0.38, 0.62, 0.28, 0.72];
  const yOffsets = [-14, 18, -30, 34, -46, 50].map((value) => value + index * 3);
  const xOffsets = [0, -38, 38, -68, 68];
  let best = { ...cubicBezierPoint(start, control1, control2, end, 0.5), y: cubicBezierPoint(start, control1, control2, end, 0.5).y - 14 };
  let bestScore = Number.POSITIVE_INFINITY;
  for (const sample of samples) {
    const point = cubicBezierPoint(start, control1, control2, end, sample);
    for (const yOffset of yOffsets) {
      for (const xOffset of xOffsets) {
        const anchor = { x: point.x + xOffset, y: point.y + yOffset };
        let score = Math.abs(sample - 0.5) * 120 + Math.abs(yOffset) * 0.4 + Math.abs(xOffset) * 0.5;
        for (const node of taskNodes) {
          if (relationLabelIntersectsTask(anchor, label, node, 12)) {
            score += node.task.taskId === source.task.taskId || node.task.taskId === target.task.taskId ? 9000 : 12000;
          }
        }
        if (score < bestScore) {
          best = anchor;
          bestScore = score;
        }
        if (score < 1) return best;
      }
    }
  }
  return best;
}

function buildRelationRouteCandidates(preferred: number): number[] {
  const sign = preferred >= 0 ? 1 : -1;
  const magnitude = Math.max(24, Math.abs(preferred));
  return [
    preferred,
    -preferred,
    sign * magnitude * 1.7,
    -sign * magnitude * 1.7,
    sign * magnitude * 2.4,
    -sign * magnitude * 2.4,
    sign * magnitude * 3.1,
    -sign * magnitude * 3.1
  ].map((value) => Math.round(Math.max(-220, Math.min(220, value))));
}

function relationCurveIntersectsTask(
  start: FishboneCanvasAnchor,
  control1: FishboneCanvasAnchor,
  control2: FishboneCanvasAnchor,
  end: FishboneCanvasAnchor,
  taskNode: FishboneCanvasTaskNode,
  padding: number
): boolean {
  const left = taskNode.x - taskNode.width / 2 - padding;
  const right = taskNode.x + taskNode.width / 2 + padding;
  const top = taskNode.y - taskNode.height / 2 - padding;
  const bottom = taskNode.y + taskNode.height / 2 + padding;
  for (let step = 1; step < 24; step += 1) {
    const point = cubicBezierPoint(start, control1, control2, end, step / 24);
    if (point.x >= left && point.x <= right && point.y >= top && point.y <= bottom) {
      return true;
    }
  }
  return false;
}

function relationLabelIntersectsTask(anchor: FishboneCanvasAnchor, label: string, taskNode: FishboneCanvasTaskNode, padding: number): boolean {
  const labelWidth = Math.min(128, Math.max(46, label.length * 14));
  const labelHeight = 18;
  const labelLeft = anchor.x - labelWidth / 2 - padding;
  const labelRight = anchor.x + labelWidth / 2 + padding;
  const labelTop = anchor.y - labelHeight - padding;
  const labelBottom = anchor.y + padding;
  const taskLeft = taskNode.x - taskNode.width / 2;
  const taskRight = taskNode.x + taskNode.width / 2;
  const taskTop = taskNode.y - taskNode.height / 2;
  const taskBottom = taskNode.y + taskNode.height / 2;
  return !(labelRight < taskLeft || labelLeft > taskRight || labelBottom < taskTop || labelTop > taskBottom);
}

function cubicBezierPoint(
  start: FishboneCanvasAnchor,
  control1: FishboneCanvasAnchor,
  control2: FishboneCanvasAnchor,
  end: FishboneCanvasAnchor,
  t: number
): FishboneCanvasAnchor {
  const inverse = 1 - t;
  const inverse2 = inverse * inverse;
  const t2 = t * t;
  return {
    x: inverse2 * inverse * start.x + 3 * inverse2 * t * control1.x + 3 * inverse * t2 * control2.x + t2 * t * end.x,
    y: inverse2 * inverse * start.y + 3 * inverse2 * t * control1.y + 3 * inverse * t2 * control2.y + t2 * t * end.y
  };
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

function buildDateTicks(tasks: PlanningTask[], mainlines: Mainline[], viewport: FishboneCanvasViewport, dateScale: FishboneDateScale): FishboneCanvasDateTick[] {
  const today = getLocalDateString(new Date());
  const taskDates = tasks
    .map((task) => task.date)
    .filter((value): value is string => Boolean(value && parseDateString(value)));
  const branchDates = mainlines
    .filter((mainline) => mainline.type === "branch")
    .flatMap((mainline) => [mainline.startDate, mainline.endDate])
    .filter((value): value is string => Boolean(value && parseDateString(value)));
  const allDates = [...taskDates, ...branchDates];
  const taskRange = getDateRangeFromValues(allDates);
  const padding = getDateTickRangePadding(viewport.timeAxisMode);
  const minOffset = Math.min(-padding, ...allDates.map((date) => dateDiff(viewport.centerDate, date)));
  const maxOffset = Math.max(padding, ...allDates.map((date) => dateDiff(viewport.centerDate, date)));
  const center = parseDateString(viewport.centerDate) ?? new Date();
  const ticks: FishboneCanvasDateTick[] = [];

  if (viewport.timeAxisMode === "overview" && allDates.length > 0) {
    const keyDates = new Set([...allDates, today, taskRange.start, taskRange.end].filter((value): value is string => Boolean(value)));
    for (const id of [...keyDates].sort()) {
      const date = parseDateString(id);
      if (!date) continue;
      ticks.push(createDateTick(id, date, today, viewport, dateScale));
    }
  } else {
    const step = getDateTickStep(viewport.timeAxisMode);
    const startOffset = Math.floor(minOffset / step) * step;
    for (let offset = startOffset; offset <= maxOffset; offset += step) {
      const date = new Date(center.getFullYear(), center.getMonth(), center.getDate());
      date.setDate(center.getDate() + offset);
      const id = getLocalDateString(date);
      ticks.push(createDateTick(id, date, today, viewport, dateScale));
    }
  }

  ticks.unshift({
    id: "__undated__",
    x: dateToCanvasXWithScale(null, viewport, dateScale),
    y: CANVAS_AXIS_Y,
    label: "无日期",
    detail: "待排期",
    isToday: false,
    isWeekend: false,
    isMajor: false
  });

  return ticks;
}

function createDateTick(id: string, date: Date, today: string, viewport: FishboneCanvasViewport, dateScale: FishboneDateScale): FishboneCanvasDateTick {
  const day = date.getDay();
  return {
    id,
    x: dateToCanvasXWithScale(id, viewport, dateScale),
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
