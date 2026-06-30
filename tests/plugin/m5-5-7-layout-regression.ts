import { Mainline, PlanningRelation, PlanningTask, RelationDirection, RelationType } from "../../plugin/src/data/taskTypes";
import {
  FishboneCanvasAnchor,
  FishboneCanvasTaskNode,
  buildFishboneCanvasLayout
} from "../../plugin/src/views/fishboneCanvasLayout";
import { FishboneCanvasViewport } from "../../plugin/src/views/fishboneCanvasViewport";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const mainlines: Mainline[] = [
  {
    id: "project",
    type: "mainline",
    name: "项目",
    color: "#4f8cff",
    icon: "folder",
    order: 1,
    visible: true,
    collapsed: false,
    pinned: true,
    parentMainlineId: null,
    startDate: null,
    endDate: null,
    branchOffset: 0
  },
  {
    id: "branch-a",
    type: "branch",
    name: "M5.7短期分支",
    color: "#22c55e",
    icon: "git-branch",
    order: 2,
    visible: true,
    collapsed: false,
    pinned: false,
    parentMainlineId: "project",
    startDate: "2026-07-01",
    endDate: "2026-07-05",
    branchOffset: -126
  }
];

function relation(target: string): PlanningRelation {
  return {
    target,
    type: "前置" as RelationType,
    direction: "out" as RelationDirection,
    label: "前置",
    note: ""
  };
}

function task(id: string, title: string, date: string, relationTarget = ""): PlanningTask {
  return {
    type: "planning-task",
    taskId: id,
    title,
    date,
    mainline: "项目",
    branchMainline: null,
    branchMainlineId: null,
    status: "todo",
    priority: "medium",
    sourceType: "test",
    sourceFile: "",
    sourceExcerpt: "",
    relations: relationTarget ? [relation(relationTarget)] : [],
    created: "2026-06-30 10:00",
    updated: "2026-06-30 10:00",
    reviewStatus: "confirmed",
    confidence: 1,
    path: `PlanningSystem/Tasks/${id}.md`
  };
}

const tasks: PlanningTask[] = [
  task("task-a", "相邻日期任务 A", "2026-07-01", "task-f"),
  task("task-b", "相邻日期任务 B", "2026-07-01"),
  task("task-c", "相邻日期任务 C", "2026-07-02"),
  task("task-d", "相邻日期任务 D", "2026-07-02"),
  task("task-e", "相邻日期任务 E", "2026-07-03"),
  task("task-obstacle", "关系线避障任务", "2026-07-04"),
  {
    ...task("task-f", "分支范围外任务", "2026-07-10"),
    branchMainlineId: "branch-a",
    branchMainline: "M5.7短期分支"
  },
  {
    ...task("task-g", "分支范围内任务", "2026-07-03"),
    branchMainlineId: "branch-a",
    branchMainline: "M5.7短期分支"
  }
];

const viewport: FishboneCanvasViewport = {
  panX: -1760,
  panY: 0,
  canvasZoom: 1,
  timeScale: 92,
  centerDate: "2026-07-02",
  timeAxisMode: "day",
  focusedLaneId: null,
  laneZooms: {}
};

const layout = buildFishboneCanvasLayout(tasks, mainlines, viewport, {
  showHiddenMainlines: false,
  expandedClusters: new Set<string>()
});

const taskNodes = layout.tasks;
assert(taskNodes.length === tasks.length, `期望渲染 ${tasks.length} 个任务节点，实际 ${taskNodes.length}`);
assert(taskNodes.some((node) => node.branchSide === "above"), "任务节点应分布到主线上侧");
assert(taskNodes.some((node) => node.branchSide === "below"), "任务节点应分布到主线下侧");

for (let i = 0; i < taskNodes.length; i += 1) {
  for (let j = i + 1; j < taskNodes.length; j += 1) {
    const a = taskNodes[i];
    const b = taskNodes[j];
    if (a.laneId !== b.laneId || a.branchSide !== b.branchSide) continue;
    assert(!rectsOverlap(a, b, 8), `${a.task.taskId} 与 ${b.task.taskId} 在同侧轨道中发生重叠`);
  }
}

const clampedBranchTask = taskNodes.find((node) => node.task.taskId === "task-f");
assert(clampedBranchTask?.effectiveDate === "2026-07-05", "分支范围外任务应吸附到分支结束日期显示");

const branch = layout.branchMainlines.find((item) => item.id === "branch-a");
assert(branch, "应生成分支主线布局");
assert(branch.side === "above", "负向 branch_offset 应让分支位于父主线上方");
assert(branch.y < branch.parentY, "上方分支的 y 应小于父主线 y");

assert(layout.relationLines.length === 1, `期望生成 1 条关系线，实际 ${layout.relationLines.length}`);
const relationLine = layout.relationLines[0];
assert(isNodeEdgeAnchor(relationLine.source, relationLine.start), "关系线起点应连接到源任务节点边缘");
assert(isNodeEdgeAnchor(relationLine.target, relationLine.end), "关系线终点应连接到目标任务节点边缘");
assert(relationLine.control1.y !== relationLine.start.y || relationLine.control2.y !== relationLine.end.y, "关系线应带有避让弯曲偏移");
const obstacleNode = taskNodes.find((node) => node.task.taskId === "task-obstacle");
assert(obstacleNode, "应生成关系线避障测试任务");
assert(!relationCurveIntersectsTask(relationLine, obstacleNode, 12), "关系线不应穿过非端点任务标签");
for (const node of taskNodes) {
  assert(!relationLabelIntersectsTask(relationLine.labelAnchor, relationLine.label, node, 12), "关系文字不应覆盖任务标签或任务图标");
}

const maxTaskBottom = Math.max(...taskNodes.map((node) => node.y + node.height / 2));
assert(layout.stageHeight >= maxTaskBottom + 180, "stageHeight 应覆盖避让后最底部任务节点");

console.log("M5.5-M5.7 layout regression passed.");

function rectsOverlap(a: FishboneCanvasTaskNode, b: FishboneCanvasTaskNode, gap: number): boolean {
  return !(
    a.x + a.width / 2 + gap <= b.x - b.width / 2 ||
    b.x + b.width / 2 + gap <= a.x - a.width / 2 ||
    a.y + a.height / 2 + gap <= b.y - b.height / 2 ||
    b.y + b.height / 2 + gap <= a.y - a.height / 2
  );
}

function isNodeEdgeAnchor(node: FishboneCanvasTaskNode, anchor: FishboneCanvasAnchor): boolean {
  const epsilon = 0.001;
  return (
    near(anchor.x, node.x - node.width / 2, epsilon) && near(anchor.y, node.y, epsilon) ||
    near(anchor.x, node.x + node.width / 2, epsilon) && near(anchor.y, node.y, epsilon) ||
    near(anchor.x, node.x, epsilon) && near(anchor.y, node.y - node.height / 2, epsilon) ||
    near(anchor.x, node.x, epsilon) && near(anchor.y, node.y + node.height / 2, epsilon)
  );
}

function relationCurveIntersectsTask(line: { start: FishboneCanvasAnchor; control1: FishboneCanvasAnchor; control2: FishboneCanvasAnchor; end: FishboneCanvasAnchor }, taskNode: FishboneCanvasTaskNode, padding: number): boolean {
  const left = taskNode.x - taskNode.width / 2 - padding;
  const right = taskNode.x + taskNode.width / 2 + padding;
  const top = taskNode.y - taskNode.height / 2 - padding;
  const bottom = taskNode.y + taskNode.height / 2 + padding;
  for (let step = 1; step < 24; step += 1) {
    const point = cubicBezierPoint(line.start, line.control1, line.control2, line.end, step / 24);
    if (point.x >= left && point.x <= right && point.y >= top && point.y <= bottom) return true;
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

function cubicBezierPoint(start: FishboneCanvasAnchor, control1: FishboneCanvasAnchor, control2: FishboneCanvasAnchor, end: FishboneCanvasAnchor, t: number): FishboneCanvasAnchor {
  const inverse = 1 - t;
  const inverse2 = inverse * inverse;
  const t2 = t * t;
  return {
    x: inverse2 * inverse * start.x + 3 * inverse2 * t * control1.x + 3 * inverse * t2 * control2.x + t2 * t * end.x,
    y: inverse2 * inverse * start.y + 3 * inverse2 * t * control1.y + 3 * inverse * t2 * control2.y + t2 * t * end.y
  };
}

function near(a: number, b: number, epsilon: number): boolean {
  return Math.abs(a - b) <= epsilon;
}
