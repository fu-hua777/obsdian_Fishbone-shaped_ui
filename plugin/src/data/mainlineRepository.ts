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
    const path = normalizePath(`${this.planningSystemPath}/Mainlines/mainlines.json`);
    try {
      const raw = await this.app.vault.adapter.read(path);
      const parsed = JSON.parse(raw) as MainlinesFile;
      return Array.isArray(parsed.mainlines) ? parsed.mainlines : [];
    } catch (error) {
      console.warn("Fishbone Planner: failed to read mainlines.json", error);
      return [];
    }
  }
}
