import { App, TFile, normalizePath } from "obsidian";

export interface DailySummaryFileStatus {
  path: string;
  exists: boolean;
  modifiedAt: string | null;
}

export class DailySummaryRepository {
  private app: App;
  private planningSystemPath: string;

  constructor(app: App, planningSystemPath: string) {
    this.app = app;
    this.planningSystemPath = planningSystemPath;
  }

  getSummaryPath(date: string): string {
    return normalizePath(`${this.planningSystemPath}/DailyReports/${date}_每日总结.md`);
  }

  getSummaryFile(date: string): TFile | null {
    const file = this.app.vault.getAbstractFileByPath(this.getSummaryPath(date));
    return file instanceof TFile ? file : null;
  }

  async getStatus(date: string): Promise<DailySummaryFileStatus> {
    const path = this.getSummaryPath(date);
    const file = this.getSummaryFile(date);
    return {
      path,
      exists: Boolean(file),
      modifiedAt: file ? formatLocalDateTime(new Date(file.stat.mtime)) : null
    };
  }

  async writeSummary(date: string, content: string): Promise<TFile> {
    const path = this.getSummaryPath(date);
    await ensureFolder(this.app, normalizePath(`${this.planningSystemPath}/DailyReports`));
    const existing = this.getSummaryFile(date);
    if (existing) {
      await this.app.vault.modify(existing, content);
      return existing;
    }
    return await this.app.vault.create(path, content);
  }

  async openSummary(date: string): Promise<boolean> {
    const file = this.getSummaryFile(date);
    if (!file) return false;
    await this.app.workspace.getLeaf(false).openFile(file);
    return true;
  }
}

async function ensureFolder(app: App, folderPath: string): Promise<void> {
  const parts = normalizePath(folderPath).split("/").filter(Boolean);
  let current = "";
  for (const part of parts) {
    current = current ? `${current}/${part}` : part;
    if (!(await app.vault.adapter.exists(current))) {
      await app.vault.createFolder(current);
    }
  }
}

function formatLocalDateTime(date: Date): string {
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
