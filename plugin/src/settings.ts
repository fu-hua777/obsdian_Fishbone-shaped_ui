import { App, PluginSettingTab, Setting } from "obsidian";
import FishbonePlannerPlugin from "./main";

export interface FishbonePlannerSettings {
  planningSystemPath: string;
  fishboneViewState: FishbonePersistedViewState;
  dashboardState: FishboneDashboardState;
}

export interface FishbonePersistedViewState {
  panX?: number;
  panY?: number;
  canvasZoom?: number;
  timeScale?: number;
  centerDate?: string;
  timeAxisMode?: "day" | "week" | "month" | "overview";
  showRelations?: boolean;
  showHiddenMainlines?: boolean;
  focusedLaneId?: string | null;
  laneZooms?: Record<string, number>;
  expandedClusters?: string[];
}

export interface FishboneDashboardState {
  showDashboard?: boolean;
  dashboardWidth?: number;
  moduleOrder?: string[];
  moduleHeights?: Record<string, number>;
  workbenchHeight?: number;
  workbenchColumnOrder?: string[];
}

export const DEFAULT_SETTINGS: FishbonePlannerSettings = {
  planningSystemPath: "PlanningSystem",
  fishboneViewState: {},
  dashboardState: {
    showDashboard: true,
    dashboardWidth: 340,
    moduleOrder: ["today-progress", "week-progress", "today-focus", "week-focus", "mainline-progress"],
    moduleHeights: {
      "today-progress": 112,
      "week-progress": 112,
      "today-focus": 188,
      "week-focus": 188,
      "mainline-progress": 156
    },
    workbenchHeight: 260,
    workbenchColumnOrder: ["todo", "doing", "done"]
  }
};

export class FishbonePlannerSettingTab extends PluginSettingTab {
  plugin: FishbonePlannerPlugin;

  constructor(app: App, plugin: FishbonePlannerPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Fishbone Planner 设置" });

    new Setting(containerEl)
      .setName("PlanningSystem 路径")
      .setDesc("相对于当前 Vault 根目录的规划系统数据目录。M3 阶段默认使用 PlanningSystem。")
      .addText((text) =>
        text
          .setPlaceholder("PlanningSystem")
          .setValue(this.plugin.settings.planningSystemPath)
          .onChange(async (value) => {
            this.plugin.settings.planningSystemPath = normalizePlanningPath(value);
            await this.plugin.saveSettings();
          })
      );
  }
}

export function normalizePlanningPath(value: string): string {
  const trimmed = value.trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  return trimmed.length > 0 ? trimmed : DEFAULT_SETTINGS.planningSystemPath;
}
