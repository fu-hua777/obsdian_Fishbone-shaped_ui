import { App, PluginSettingTab, Setting } from "obsidian";
import FishbonePlannerPlugin from "./main";

export interface FishbonePlannerSettings {
  planningSystemPath: string;
  fishboneViewState: FishbonePersistedViewState;
  dashboardState: FishboneDashboardState;
  enableWeather: boolean;
  weatherLocationName: string;
  weatherLatitude: string;
  weatherLongitude: string;
  weatherUnit: "celsius" | "fahrenheit";
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
    moduleOrder: ["progress-overview", "today-focus", "week-focus", "mainline-progress", "daily-summary", "time-weather"],
    moduleHeights: {
      "progress-overview": 128,
      "today-focus": 188,
      "week-focus": 188,
      "mainline-progress": 190,
      "daily-summary": 156,
      "time-weather": 132
    },
    workbenchHeight: 260,
    workbenchColumnOrder: ["todo", "doing", "done"]
  },
  enableWeather: false,
  weatherLocationName: "",
  weatherLatitude: "",
  weatherLongitude: "",
  weatherUnit: "celsius"
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

    new Setting(containerEl)
      .setName("启用天气")
      .setDesc("关闭时，时间 / 天气模块只显示本地时间，不请求网络。")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableWeather)
          .onChange(async (value) => {
            this.plugin.settings.enableWeather = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("天气地点名称")
      .setDesc("仅用于显示，例如 北京、上海。")
      .addText((text) =>
        text
          .setPlaceholder("北京")
          .setValue(this.plugin.settings.weatherLocationName)
          .onChange(async (value) => {
            this.plugin.settings.weatherLocationName = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("天气纬度")
      .addText((text) =>
        text
          .setPlaceholder("39.9042")
          .setValue(this.plugin.settings.weatherLatitude)
          .onChange(async (value) => {
            this.plugin.settings.weatherLatitude = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("天气经度")
      .addText((text) =>
        text
          .setPlaceholder("116.4074")
          .setValue(this.plugin.settings.weatherLongitude)
          .onChange(async (value) => {
            this.plugin.settings.weatherLongitude = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("温度单位")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("celsius", "摄氏度")
          .addOption("fahrenheit", "华氏度")
          .setValue(this.plugin.settings.weatherUnit)
          .onChange(async (value) => {
            this.plugin.settings.weatherUnit = value === "fahrenheit" ? "fahrenheit" : "celsius";
            await this.plugin.saveSettings();
          })
      );
  }
}

export function normalizePlanningPath(value: string): string {
  const trimmed = value.trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  return trimmed.length > 0 ? trimmed : DEFAULT_SETTINGS.planningSystemPath;
}
