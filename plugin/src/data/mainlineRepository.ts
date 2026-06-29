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

  async updateMainline(id: string, name: string, color: string): Promise<Mainline> {
    const normalizedName = name.trim();
    if (!normalizedName) {
      throw new Error("主线名称不能为空");
    }

    const file = await this.readMainlinesFile();
    const index = file.mainlines.findIndex((mainline) => mainline.id === id);
    if (index < 0) {
      throw new Error("找不到要修改的主线");
    }

    const hasDuplicate = file.mainlines.some(
      (mainline) => mainline.id !== id && mainline.name === normalizedName
    );
    if (hasDuplicate) {
      throw new Error(`主线已存在：${normalizedName}`);
    }

    const updated: Mainline = {
      ...file.mainlines[index],
      name: normalizedName,
      color: normalizeColor(color)
    };
    file.mainlines[index] = updated;
    await this.writeMainlinesFile(file);
    return updated;
  }

  async updateMainlineFlags(
    id: string,
    patch: Partial<Pick<Mainline, "visible" | "collapsed" | "pinned">>
  ): Promise<Mainline | null> {
    const file = await this.readMainlinesFile();
    const index = file.mainlines.findIndex((mainline) => mainline.id === id);
    if (index < 0) {
      return null;
    }

    const updated: Mainline = {
      ...file.mainlines[index],
      ...patch
    };
    file.mainlines[index] = updated;
    await this.writeMainlinesFile(file);
    return updated;
  }

  async showAllMainlines(): Promise<void> {
    const file = await this.readMainlinesFile();
    file.mainlines = file.mainlines.map((mainline) => ({
      ...mainline,
      visible: true
    }));
    await this.writeMainlinesFile(file);
  }

  async deleteMainline(id: string): Promise<Mainline | null> {
    const file = await this.readMainlinesFile();
    const index = file.mainlines.findIndex((mainline) => mainline.id === id);
    if (index < 0) {
      return null;
    }

    const [deleted] = file.mainlines.splice(index, 1);
    normalizeMainlineOrder(file.mainlines);
    await this.writeMainlinesFile(file);
    return deleted;
  }

  async moveMainline(sourceId: string, targetId: string, placement: "before" | "after"): Promise<void> {
    if (sourceId === targetId) {
      return;
    }

    const file = await this.readMainlinesFile();
    const ordered = [...file.mainlines].sort((a, b) => a.order - b.order);
    const sourceIndex = ordered.findIndex((mainline) => mainline.id === sourceId);
    const targetIndex = ordered.findIndex((mainline) => mainline.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0) {
      return;
    }

    const [source] = ordered.splice(sourceIndex, 1);
    const adjustedTargetIndex = ordered.findIndex((mainline) => mainline.id === targetId);
    const insertIndex = placement === "before" ? adjustedTargetIndex : adjustedTargetIndex + 1;
    ordered.splice(insertIndex, 0, source);
    normalizeMainlineOrder(ordered);
    file.mainlines = ordered;
    await this.writeMainlinesFile(file);
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

function normalizeMainlineOrder(mainlines: Mainline[]): void {
  mainlines.forEach((mainline, index) => {
    mainline.order = index + 1;
  });
}
