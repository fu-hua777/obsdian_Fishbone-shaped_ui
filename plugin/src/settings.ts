import { App, PluginSettingTab, Setting } from "obsidian";
import FishbonePlannerPlugin from "./main";

export interface FishbonePlannerSettings {
  planningSystemPath: string;
  fishboneViewState: FishbonePersistedViewState;
  dashboardState: FishboneDashboardState;
  weatherRegionPreset: string;
  weatherLocationName: string;
  weatherLatitude: string;
  weatherLongitude: string;
  weatherUnit: "celsius" | "fahrenheit";
  weatherOnlineProvider: "auto" | "open-meteo" | "wttr";
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
  moduleVisibility?: Record<string, boolean>;
  moduleCollapsed?: Record<string, boolean>;
  workbenchHeight?: number;
  workbenchColumnOrder?: string[];
}

const WEATHER_REGION_PRESETS: Array<{ id: string; name: string; latitude: string; longitude: string }> = [
  { id: "beijing", name: "北京", latitude: "39.9042", longitude: "116.4074" },
  { id: "shanghai", name: "上海", latitude: "31.2304", longitude: "121.4737" },
  { id: "guangzhou", name: "广州", latitude: "23.1291", longitude: "113.2644" },
  { id: "shenzhen", name: "深圳", latitude: "22.5431", longitude: "114.0579" },
  { id: "hangzhou", name: "杭州", latitude: "30.2741", longitude: "120.1551" },
  { id: "chengdu", name: "成都", latitude: "30.5728", longitude: "104.0668" },
  { id: "wuhan", name: "武汉", latitude: "30.5928", longitude: "114.3055" },
  { id: "xian", name: "西安", latitude: "34.3416", longitude: "108.9398" },
  { id: "nanjing", name: "南京", latitude: "32.0603", longitude: "118.7969" },
  { id: "custom", name: "自定义", latitude: "", longitude: "" }
];

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
      "time-weather": 104
    },
    moduleVisibility: {},
    moduleCollapsed: {},
    workbenchHeight: 260,
    workbenchColumnOrder: ["todo", "doing", "done"]
  },
  weatherRegionPreset: "beijing",
  weatherLocationName: "北京",
  weatherLatitude: "39.9042",
  weatherLongitude: "116.4074",
  weatherUnit: "celsius",
  weatherOnlineProvider: "auto"
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
      .setName("天气地区")
      .setDesc("选择地区后会自动填入天气地点和经纬度。")
      .addDropdown((dropdown) => {
        for (const preset of WEATHER_REGION_PRESETS) {
          dropdown.addOption(preset.id, preset.name);
        }
        dropdown
          .setValue(this.plugin.settings.weatherRegionPreset || "beijing")
          .onChange(async (value) => {
            this.plugin.settings.weatherRegionPreset = value;
            const preset = WEATHER_REGION_PRESETS.find((item) => item.id === value);
            if (preset && preset.id !== "custom") {
              this.plugin.settings.weatherLocationName = preset.name;
              this.plugin.settings.weatherLatitude = preset.latitude;
              this.plugin.settings.weatherLongitude = preset.longitude;
            }
            await this.plugin.saveSettings();
            this.display();
          });
      });

    new Setting(containerEl)
      .setName("天气地点名称")
      .setDesc("仅用于显示，例如 北京、上海。")
      .addText((text) =>
        text
          .setPlaceholder("北京")
          .setValue(this.plugin.settings.weatherLocationName)
          .onChange(async (value) => {
            this.plugin.settings.weatherRegionPreset = "custom";
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
            this.plugin.settings.weatherRegionPreset = "custom";
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
            this.plugin.settings.weatherRegionPreset = "custom";
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

    new Setting(containerEl)
      .setName("联网天气源")
      .setDesc("自动模式会先尝试 Open-Meteo，失败后尝试 wttr.in。时间同步使用网络响应头 Date。")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("auto", "自动")
          .addOption("open-meteo", "Open-Meteo")
          .addOption("wttr", "wttr.in")
          .setValue(this.plugin.settings.weatherOnlineProvider || "auto")
          .onChange(async (value) => {
            this.plugin.settings.weatherOnlineProvider = value === "open-meteo" || value === "wttr" ? value : "auto";
            await this.plugin.saveSettings();
          })
      );
  }
}

export function normalizePlanningPath(value: string): string {
  const trimmed = value.trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  return trimmed.length > 0 ? trimmed : DEFAULT_SETTINGS.planningSystemPath;
}
