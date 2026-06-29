import { Mainline, PlanningTask } from "../data/taskTypes";
import {
  FishboneDateColumn,
  FishboneLane,
  FishboneLayout,
  FishboneRelationLine,
  FishboneTaskNode,
  UNASSIGNED_COLOR,
  UNASSIGNED_LANE_ID,
  UNASSIGNED_LANE_NAME,
  UNDATED_COLUMN_ID
} from "./fishboneRenderTypes";

export function buildFishboneLayout(tasks: PlanningTask[], mainlines: Mainline[], dates: FishboneDateColumn[]): FishboneLayout {
  const lanes = buildLanes(tasks, mainlines, dates);
  const relationLines = buildRelationLines(tasks, lanes);

  return {
    dates,
    lanes,
    relationLines
  };
}

function buildLanes(tasks: PlanningTask[], mainlines: Mainline[], dates: FishboneDateColumn[]): FishboneLane[] {
  const visibleMainlines = mainlines
    .filter((mainline) => mainline.type !== "branch")
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
    if (!dates.some((date) => date.id === dateId)) {
      continue;
    }
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
    lane.tasksByDate[dateId].push(createTaskNode(task, lane.tasksByDate[dateId].length));
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
      for (const node of laneTasks) {
        const task = node.task;
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

function emptyTasksByDate(dates: FishboneDateColumn[]): Record<string, FishboneTaskNode[]> {
  const result: Record<string, FishboneTaskNode[]> = {};
  for (const date of dates) {
    result[date.id] = [];
  }
  return result;
}

function createTaskNode(task: PlanningTask, index: number): FishboneTaskNode {
  return {
    task,
    branchIndex: Math.floor(index / 2),
    branchSide: index % 2 === 0 ? "above" : "below"
  };
}
