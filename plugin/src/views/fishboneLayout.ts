import { Mainline, PlanningTask } from "../data/taskTypes";
import {
  FishboneDateColumn,
  FishboneLane,
  FishboneLayout,
  FishboneRelationLine,
  UNASSIGNED_COLOR,
  UNASSIGNED_LANE_ID,
  UNASSIGNED_LANE_NAME,
  UNDATED_COLUMN_ID,
  UNDATED_COLUMN_LABEL
} from "./fishboneRenderTypes";

export function buildFishboneLayout(tasks: PlanningTask[], mainlines: Mainline[]): FishboneLayout {
  const dates = buildDateColumns(tasks);
  const lanes = buildLanes(tasks, mainlines, dates);
  const relationLines = buildRelationLines(tasks, lanes);

  return {
    dates,
    lanes,
    relationLines
  };
}

function buildDateColumns(tasks: PlanningTask[]): FishboneDateColumn[] {
  const values = new Set<string>();
  for (const task of tasks) {
    values.add(task.date ?? UNDATED_COLUMN_ID);
  }
  if (values.size === 0) {
    values.add(UNDATED_COLUMN_ID);
  }

  return Array.from(values)
    .sort((a, b) => {
      if (a === UNDATED_COLUMN_ID) return 1;
      if (b === UNDATED_COLUMN_ID) return -1;
      return a.localeCompare(b);
    })
    .map((value) => ({
      id: value,
      label: value === UNDATED_COLUMN_ID ? UNDATED_COLUMN_LABEL : formatDateLabel(value),
      sortValue: value
    }));
}

function buildLanes(tasks: PlanningTask[], mainlines: Mainline[], dates: FishboneDateColumn[]): FishboneLane[] {
  const visibleMainlines = mainlines
    .filter((mainline) => mainline.visible !== false)
    .sort((a, b) => a.order - b.order);
  const mainlineNames = new Set(visibleMainlines.map((mainline) => mainline.name));

  const lanes: FishboneLane[] = visibleMainlines.map((mainline) => ({
    id: mainline.id,
    name: mainline.name,
    color: mainline.color,
    isUnassigned: false,
    tasksByDate: emptyTasksByDate(dates)
  }));

  const unassignedLane: FishboneLane = {
    id: UNASSIGNED_LANE_ID,
    name: UNASSIGNED_LANE_NAME,
    color: UNASSIGNED_COLOR,
    isUnassigned: true,
    tasksByDate: emptyTasksByDate(dates)
  };

  const laneByName = new Map<string, FishboneLane>();
  for (const lane of lanes) {
    laneByName.set(lane.name, lane);
  }

  let hasUnassignedTask = mainlines.length === 0;
  for (const task of tasks) {
    const dateId = task.date ?? UNDATED_COLUMN_ID;
    const lane =
      task.mainline && mainlineNames.has(task.mainline)
        ? laneByName.get(task.mainline) ?? unassignedLane
        : unassignedLane;
    if (lane.isUnassigned) {
      hasUnassignedTask = true;
    }
    if (!lane.tasksByDate[dateId]) {
      lane.tasksByDate[dateId] = [];
    }
    lane.tasksByDate[dateId].push(task);
  }

  if (hasUnassignedTask) {
    lanes.push(unassignedLane);
  }

  return lanes;
}

function buildRelationLines(tasks: PlanningTask[], lanes: FishboneLane[]): FishboneRelationLine[] {
  const taskPosition = new Map<string, { dateId: string; laneId: string }>();
  for (const lane of lanes) {
    for (const [dateId, laneTasks] of Object.entries(lane.tasksByDate)) {
      for (const task of laneTasks) {
        taskPosition.set(task.taskId, { dateId, laneId: lane.id });
        taskPosition.set(task.title, { dateId, laneId: lane.id });
      }
    }
  }

  const lines: FishboneRelationLine[] = [];
  for (const task of tasks) {
    const source = taskPosition.get(task.taskId);
    if (!source) continue;
    for (const relation of task.relations) {
      lines.push({
        id: `${task.taskId}-${relation.type}-${relation.target}`,
        sourceTaskId: task.taskId,
        targetTitle: relation.target,
        relation,
        sourceDateId: source.dateId,
        sourceLaneId: source.laneId
      });
    }
  }
  return lines;
}

function emptyTasksByDate(dates: FishboneDateColumn[]): Record<string, PlanningTask[]> {
  const result: Record<string, PlanningTask[]> = {};
  for (const date of dates) {
    result[date.id] = [];
  }
  return result;
}

function formatDateLabel(value: string): string {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value;
  return `${Number(match[2])}/${Number(match[3])}`;
}
