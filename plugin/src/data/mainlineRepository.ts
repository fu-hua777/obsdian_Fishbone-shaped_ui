import { App, normalizePath } from "obsidian";
import { Mainline, MainlinesFile } from "./taskTypes";

type RawMainline = Partial<Omit<Mainline, "parentMainlineId" | "startDate" | "endDate">> & {
  parent_mainline_id?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  branch_offset?: number | null;
  parentMainlineId?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  branchOffset?: number | null;
};

export interface BranchMainlineInput {
  name: string;
  color: string;
  parentMainlineId: string;
  startDate: string;
  endDate: string;
}

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
      type: "mainline",
      name: normalizedName,
      color: normalizedColor,
      icon: "",
      order: nextOrder,
      visible: true,
      collapsed: false,
      pinned: false,
      parentMainlineId: null,
      startDate: null,
      endDate: null,
      branchOffset: 0
    };

    file.mainlines.push(mainline);
    await this.writeMainlinesFile(file);
    return mainline;
  }

  async createBranchMainline(input: BranchMainlineInput): Promise<Mainline> {
    const file = await this.readMainlinesFile();
    const normalized = normalizeBranchMainlineInput(input, file.mainlines);
    const hasDuplicate = file.mainlines.some((mainline) => mainline.name === normalized.name);
    if (hasDuplicate) {
      throw new Error(`主线已存在：${normalized.name}`);
    }

    const nextOrder = file.mainlines.reduce((max, mainline) => Math.max(max, mainline.order), 0) + 1;
    const branch: Mainline = {
      id: createMainlineId(normalized.name),
      type: "branch",
      name: normalized.name,
      color: normalized.color,
      icon: "git-branch",
      order: nextOrder,
      visible: true,
      collapsed: false,
      pinned: false,
      parentMainlineId: normalized.parentMainlineId,
      startDate: normalized.startDate,
      endDate: normalized.endDate,
      branchOffset: 0
    };

    file.mainlines.push(branch);
    await this.writeMainlinesFile(file);
    return branch;
  }

  async updateBranchMainline(id: string, input: BranchMainlineInput): Promise<Mainline> {
    const file = await this.readMainlinesFile();
    const index = file.mainlines.findIndex((mainline) => mainline.id === id && mainline.type === "branch");
    if (index < 0) {
      throw new Error("找不到要修改的分支主线");
    }

    const normalized = normalizeBranchMainlineInput(input, file.mainlines);
    const hasDuplicate = file.mainlines.some((mainline) => mainline.id !== id && mainline.name === normalized.name);
    if (hasDuplicate) {
      throw new Error(`主线已存在：${normalized.name}`);
    }

    const updated: Mainline = {
      ...file.mainlines[index],
      name: normalized.name,
      color: normalized.color,
      parentMainlineId: normalized.parentMainlineId,
      startDate: normalized.startDate,
      endDate: normalized.endDate
    };
    file.mainlines[index] = updated;
    await this.writeMainlinesFile(file);
    return updated;
  }

  async updateBranchMainlineOffset(id: string, branchOffset: number): Promise<Mainline | null> {
    const file = await this.readMainlinesFile();
    const index = file.mainlines.findIndex((mainline) => mainline.id === id && mainline.type === "branch");
    if (index < 0) {
      return null;
    }

    const updated: Mainline = {
      ...file.mainlines[index],
      branchOffset: clampBranchOffset(branchOffset)
    };
    file.mainlines[index] = updated;
    await this.writeMainlinesFile(file);
    return updated;
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
        mainlines: Array.isArray(parsed.mainlines) ? parsed.mainlines.map(normalizeMainline) : []
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
    await this.app.vault.adapter.write(path, `${JSON.stringify(serializeMainlinesFile(file), null, 2)}\n`);
  }
}

function normalizeMainline(value: RawMainline): Mainline {
  return {
    id: typeof value.id === "string" ? value.id : createMainlineId(typeof value.name === "string" ? value.name : "mainline"),
    type: value.type === "branch" ? "branch" : "mainline",
    name: typeof value.name === "string" ? value.name : "未命名主线",
    color: typeof value.color === "string" ? normalizeColor(value.color) : "#4f8cff",
    icon: typeof value.icon === "string" ? value.icon : "",
    order: typeof value.order === "number" ? value.order : 0,
    visible: value.visible !== false,
    collapsed: value.collapsed === true,
    pinned: value.pinned === true,
    parentMainlineId: asNullableString(value.parent_mainline_id ?? value.parentMainlineId),
    startDate: asNullableString(value.start_date ?? value.startDate),
    endDate: asNullableString(value.end_date ?? value.endDate),
    branchOffset: clampBranchOffset(asNumber(value.branch_offset ?? value.branchOffset))
  };
}

function serializeMainlinesFile(file: MainlinesFile): { version: string; mainlines: Array<Record<string, unknown>> } {
  return {
    version: file.version,
    mainlines: file.mainlines.map((mainline) => {
      const serialized: Record<string, unknown> = {
        id: mainline.id,
        type: mainline.type,
        name: mainline.name,
        color: mainline.color,
        icon: mainline.icon,
        order: mainline.order,
        visible: mainline.visible,
        collapsed: mainline.collapsed,
        pinned: mainline.pinned
      };
      if (mainline.type === "branch") {
        serialized.parent_mainline_id = mainline.parentMainlineId;
        serialized.start_date = mainline.startDate;
        serialized.end_date = mainline.endDate;
        serialized.branch_offset = mainline.branchOffset;
      }
      return serialized;
    })
  };
}

function normalizeBranchMainlineInput(input: BranchMainlineInput, mainlines: Mainline[]): BranchMainlineInput {
  const name = input.name.trim();
  if (!name) {
    throw new Error("分支主线名称不能为空");
  }
  const parent = mainlines.find((mainline) => mainline.id === input.parentMainlineId && mainline.type !== "branch");
  if (!parent) {
    throw new Error("分支主线必须选择一条普通主线作为父主线");
  }
  if (!isIsoDate(input.startDate) || !isIsoDate(input.endDate)) {
    throw new Error("分支主线日期必须使用 YYYY-MM-DD");
  }
  const startDate = input.startDate <= input.endDate ? input.startDate : input.endDate;
  const endDate = input.startDate <= input.endDate ? input.endDate : input.startDate;
  return {
    name,
    color: normalizeColor(input.color),
    parentMainlineId: parent.id,
    startDate,
    endDate
  };
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function clampBranchOffset(value: number): number {
  return Math.max(-220, Math.min(220, Math.round(value)));
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
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
