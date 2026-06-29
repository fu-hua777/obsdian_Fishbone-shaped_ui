import { App, normalizePath } from "obsidian";
import { Mainline, MainlinesFile } from "./taskTypes";

export class MainlineRepository {
  private app: App;
  private planningSystemPath: string;

  constructor(app: App, planningSystemPath: string) {
    this.app = app;
    this.planningSystemPath = planningSystemPath;
  }

  async listMainlines(): Promise<Mainline[]> {
    const file = await this.readMainlinesFile();
    return file.mainlines;
  }

  async createMainline(name: string, color: string): Promise<Mainline> {
    const normalizedName = name.trim();
    if (!normalizedName) {
      throw new Error("主线名称不能为空");
    }

    const normalizedColor = normalizeColor(color);
    const file = await this.readMainlinesFile();
    const hasDuplicate = file.mainlines.some((mainline) => mainline.name === normalizedName);
    if (hasDuplicate) {
      throw new Error(`主线已存在：${normalizedName}`);
    }

    const nextOrder = file.mainlines.reduce((max, mainline) => Math.max(max, mainline.order), 0) + 1;
    const mainline: Mainline = {
      id: createMainlineId(normalizedName),
      name: normalizedName,
      color: normalizedColor,
      icon: "",
      order: nextOrder,
      visible: true,
      collapsed: false,
      pinned: false
    };

    file.mainlines.push(mainline);
    await this.writeMainlinesFile(file);
    return mainline;
  }

  private async readMainlinesFile(): Promise<MainlinesFile> {
    const path = normalizePath(`${this.planningSystemPath}/Mainlines/mainlines.json`);
    try {
      const raw = await this.app.vault.adapter.read(path);
      const parsed = JSON.parse(raw) as MainlinesFile;
      return {
        version: typeof parsed.version === "string" ? parsed.version : "1.0",
        mainlines: Array.isArray(parsed.mainlines) ? parsed.mainlines : []
      };
    } catch (error) {
      console.warn("Fishbone Planner: failed to read mainlines.json", error);
      return { version: "1.0", mainlines: [] };
    }
  }

  private async writeMainlinesFile(file: MainlinesFile): Promise<void> {
    const path = normalizePath(`${this.planningSystemPath}/Mainlines/mainlines.json`);
    const folderPath = normalizePath(`${this.planningSystemPath}/Mainlines`);
    if (!(await this.app.vault.adapter.exists(folderPath))) {
      await this.app.vault.adapter.mkdir(folderPath);
    }
    await this.app.vault.adapter.write(path, `${JSON.stringify(file, null, 2)}\n`);
  }
}

function normalizeColor(color: string): string {
  const value = color.trim();
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#4f8cff";
}

function createMainlineId(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w\u4e00-\u9fa5-]/g, "");
  return `mainline-${slug || "custom"}-${Date.now().toString(36)}`;
}
