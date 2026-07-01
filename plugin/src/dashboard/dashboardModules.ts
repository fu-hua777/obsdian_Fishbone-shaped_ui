export type DashboardModuleId =
  | "progress-overview"
  | "today-focus"
  | "week-focus"
  | "mainline-progress"
  | "daily-summary"
  | "time-weather";

export interface DashboardModuleMeta {
  id: DashboardModuleId;
  title: string;
  area: "right";
  defaultHeight: number;
  minHeight: number;
  defaultVisible: boolean;
}

export const DASHBOARD_MODULES: DashboardModuleMeta[] = [
  { id: "progress-overview", title: "进度概览", area: "right", defaultHeight: 128, minHeight: 86, defaultVisible: true },
  { id: "today-focus", title: "今日聚焦", area: "right", defaultHeight: 188, minHeight: 86, defaultVisible: true },
  { id: "week-focus", title: "本周重点", area: "right", defaultHeight: 188, minHeight: 86, defaultVisible: true },
  { id: "mainline-progress", title: "主线进度", area: "right", defaultHeight: 190, minHeight: 86, defaultVisible: true },
  { id: "daily-summary", title: "每日总结", area: "right", defaultHeight: 156, minHeight: 86, defaultVisible: true },
  { id: "time-weather", title: "时间 / 天气", area: "right", defaultHeight: 104, minHeight: 86, defaultVisible: true }
];

export const DASHBOARD_MODULE_IDS = DASHBOARD_MODULES.map((module) => module.id);

export const DEFAULT_DASHBOARD_MODULE_HEIGHTS = DASHBOARD_MODULES.reduce((heights, module) => {
  heights[module.id] = module.defaultHeight;
  return heights;
}, {} as Record<DashboardModuleId, number>);

export function getDashboardModuleTitle(moduleId: DashboardModuleId): string {
  return DASHBOARD_MODULES.find((module) => module.id === moduleId)?.title ?? moduleId;
}
