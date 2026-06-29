import { PlanningRelation, PlanningTask } from "../data/taskTypes";

export const UNASSIGNED_LANE_ID = "__unassigned__";
export const UNDATED_COLUMN_ID = "__undated__";
export const UNASSIGNED_LANE_NAME = "未分配";
export const UNDATED_COLUMN_LABEL = "无日期";
export const UNASSIGNED_COLOR = "#8b949e";

export interface FishboneLayout {
  dates: FishboneDateColumn[];
  lanes: FishboneLane[];
  relationLines: FishboneRelationLine[];
}

export interface FishboneDateColumn {
  id: string;
  label: string;
  fullLabel: string;
  sortValue: string;
  isToday: boolean;
  isWeekend: boolean;
  isUndated: boolean;
}

export interface FishboneLane {
  id: string;
  name: string;
  color: string;
  isUnassigned: boolean;
  tasksByDate: Record<string, FishboneTaskNode[]>;
}

export interface FishboneTaskNode {
  task: PlanningTask;
  branchIndex: number;
  branchSide: "above" | "below";
}

export interface FishboneRelationLine {
  id: string;
  sourceTaskId: string;
  targetTitle: string;
  relation: PlanningRelation;
  sourceDateId: string;
  sourceLaneId: string;
}
