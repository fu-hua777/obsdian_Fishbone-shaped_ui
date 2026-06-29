import { ItemView, Menu, Modal, Notice, Setting, WorkspaceLeaf } from "obsidian";
import FishbonePlannerPlugin from "../main";
import { Mainline, PlanningTask } from "../data/taskTypes";
import { buildFishboneLayout } from "./fishboneLayout";
import { FishboneLane, FishboneLayout } from "./fishboneRenderTypes";

export const FISHBONE_TIMELINE_VIEW_TYPE = "fishbone-planner-timeline";

export class FishboneTimelineView extends ItemView {
  private plugin: FishbonePlannerPlugin;

  constructor(leaf: WorkspaceLeaf, plugin: FishbonePlannerPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return FISHBONE_TIMELINE_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Fishbone Planner 鱼骨时间视图";
  }

  async onOpen(): Promise<void> {
    await this.render();
  }

  async render(): Promise<void> {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("fishbone-timeline-view");

    const [mainlines, tasks] = await Promise.all([
      this.plugin.mainlineRepository.listMainlines(),
      this.plugin.taskRepository.listTasks()
    ]);
    const layout = buildFishboneLayout(tasks, mainlines);

    const toolbar = container.createDiv({ cls: "fishbone-timeline-toolbar" });
    toolbar.createDiv({ cls: "fishbone-timeline-title", text: "鱼骨时间视图" });
    this.renderMainlineCreator(toolbar);

    const refreshButton = toolbar.createEl("button", { text: "刷新" });
    refreshButton.addEventListener("click", () => {
      void this.render();
    });

    const summary = container.createDiv({ cls: "fishbone-timeline-summary" });
    summary.createSpan({ text: `任务 ${tasks.length}` });
    summary.createSpan({ text: `主线 ${mainlines.length}` });
    summary.createSpan({ text: `日期 ${layout.dates.length}` });
    summary.createSpan({ text: `关系 ${layout.relationLines.length}` });

    if (mainlines.length === 0) {
      container.createDiv({
        cls: "fishbone-timeline-warning",
        text: "当前没有用户主线。系统不会创建默认主线；未分配任务会显示在临时泳道中。"
      });
    }

    this.renderTimeline(container, layout, mainlines);
  }

  private renderMainlineCreator(toolbar: HTMLElement): void {
    const actionGroup = toolbar.createDiv({ cls: "fishbone-toolbar-actions" });
    const createButton = actionGroup.createEl("button", { text: "新建主线" });
    createButton.addEventListener("click", async (event) => {
      event.preventDefault();
      new MainlineEditorModal(this.plugin, {
        title: "新建主线",
        submitText: "创建",
        name: "",
        color: "#4f8cff",
        onSubmit: async (name, color) => {
          await this.plugin.mainlineRepository.createMainline(name, color);
          new Notice(`已创建主线：${name.trim()}`);
          await this.render();
        }
      }).open();
    });
  }

  private renderTimeline(container: Element, layout: FishboneLayout, mainlines: Mainline[]): void {
    const scroller = container.createDiv({ cls: "fishbone-timeline-scroller" });
    const grid = scroller.createDiv({ cls: "fishbone-timeline-grid" });
    grid.style.setProperty("--fishbone-date-count", String(layout.dates.length));

    grid.createDiv({ cls: "fishbone-timeline-corner", text: "主线 / 日期" });
    for (const date of layout.dates) {
      grid.createDiv({ cls: "fishbone-timeline-date", text: date.label });
    }

    for (const lane of layout.lanes) {
      this.renderLane(grid, lane, layout, mainlines);
    }

    if (layout.relationLines.length > 0) {
      const relationPanel = container.createDiv({ cls: "fishbone-relation-panel" });
      relationPanel.createDiv({ cls: "fishbone-relation-title", text: "Relations" });
      for (const line of layout.relationLines) {
        relationPanel.createDiv({
          cls: "fishbone-relation-line",
          text: `${line.sourceTaskId} --${line.relation.type}--> ${line.targetTitle}`
        });
      }
    }
  }

  private renderLane(grid: HTMLElement, lane: FishboneLane, layout: FishboneLayout, mainlines: Mainline[]): void {
    const label = grid.createDiv({ cls: "fishbone-lane-label" });
    label.style.setProperty("--lane-color", lane.color);
    label.createDiv({ cls: "fishbone-lane-dot" });
    const mainline = mainlines.find((item) => item.id === lane.id);
    const name = label.createDiv({ cls: "fishbone-lane-name", text: lane.name });
    if (mainline) {
      label.addClass("fishbone-lane-label-interactive");
      name.setAttr("title", "点击修改；右键删除；长按拖动排序");
      name.addEventListener("click", (event) => {
        event.stopPropagation();
        this.openEditMainlineModal(mainline);
      });
      this.bindMainlineContextMenu(label, mainline);
      this.bindMainlineDrag(label, mainline);
    }

    for (const date of layout.dates) {
      const cell = grid.createDiv({ cls: "fishbone-lane-cell" });
      cell.style.setProperty("--lane-color", lane.color);
      cell.createDiv({ cls: "fishbone-spine" });
      const tasks = lane.tasksByDate[date.id] ?? [];
      for (const task of tasks) {
        this.renderTaskNode(cell, task, mainlines);
      }
    }
  }

  private renderTaskNode(parent: HTMLElement, task: PlanningTask, mainlines: Mainline[]): void {
    const node = parent.createDiv({ cls: "fishbone-task-node" });
    const header = node.createDiv({ cls: "fishbone-task-header" });
    const checkbox = header.createEl("input", {
      attr: {
        type: "checkbox",
        "aria-label": "切换任务完成状态"
      }
    });
    checkbox.checked = task.status === "done";
    checkbox.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
    });
    checkbox.addEventListener("click", (event) => {
      event.stopPropagation();
    });
    checkbox.addEventListener("change", async (event) => {
      event.stopPropagation();
      const status = await this.plugin.taskRepository.setTaskDone(task, checkbox.checked);
      if (status) {
        new Notice(`任务状态已更新为 ${status}`);
        await this.render();
      }
    });

    header.createDiv({ cls: "fishbone-task-title", text: task.title });
    node.createDiv({ cls: "fishbone-task-meta", text: `${task.status} · ${task.priority}` });

    if (mainlines.length > 0) {
      const select = node.createEl("select", { cls: "fishbone-task-mainline-select" });
      select.createEl("option", { text: "未分配", value: "" });
      for (const mainline of mainlines) {
        select.createEl("option", { text: mainline.name, value: mainline.name });
      }
      select.value = task.mainline ?? "";
      select.addEventListener("pointerdown", (event) => {
        event.stopPropagation();
      });
      select.addEventListener("click", (event) => {
        event.stopPropagation();
      });
      select.addEventListener("change", async (event) => {
        event.stopPropagation();
        const value = select.value.length > 0 ? select.value : null;
        await this.plugin.taskRepository.setTaskMainline(task, value);
        new Notice(value ? `任务已分配到主线：${value}` : "任务已移回未分配");
        await this.render();
      });
    }

    node.addEventListener("click", () => {
      void this.plugin.taskRepository.openTask(task);
    });
  }

  private openEditMainlineModal(mainline: Mainline): void {
    new MainlineEditorModal(this.plugin, {
      title: "修改主线",
      submitText: "保存",
      name: mainline.name,
      color: mainline.color,
      onSubmit: async (name, color) => {
        await this.plugin.mainlineRepository.updateMainline(mainline.id, name, color);
        new Notice(`已修改主线：${name.trim()}`);
        await this.render();
      }
    }).open();
  }

  private bindMainlineContextMenu(label: HTMLElement, mainline: Mainline): void {
    label.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      const menu = new Menu();
      menu.addItem((item) => {
        item
          .setTitle("修改主线")
          .setIcon("pencil")
          .onClick(() => this.openEditMainlineModal(mainline));
      });
      menu.addItem((item) => {
        item
          .setTitle("删除主线")
          .setIcon("trash")
          .onClick(async () => {
            const confirmed = window.confirm(`删除主线「${mainline.name}」？任务文件不会被批量修改，原本挂在该主线的任务会显示为未分配。`);
            if (!confirmed) return;
            const deleted = await this.plugin.mainlineRepository.deleteMainline(mainline.id);
            if (deleted) {
              new Notice(`已删除主线：${deleted.name}`);
              await this.render();
            }
          });
      });
      menu.showAtMouseEvent(event);
    });
  }

  private bindMainlineDrag(label: HTMLElement, mainline: Mainline): void {
    let timer: number | null = null;

    const clearTimer = () => {
      if (timer !== null) {
        window.clearTimeout(timer);
        timer = null;
      }
    };

    label.addEventListener("pointerdown", () => {
      clearTimer();
      timer = window.setTimeout(() => {
        label.draggable = true;
        label.addClass("fishbone-lane-drag-ready");
      }, 450);
    });
    label.addEventListener("pointerup", clearTimer);
    label.addEventListener("pointerleave", clearTimer);
    label.addEventListener("dragstart", (event) => {
      if (!label.draggable) {
        event.preventDefault();
        return;
      }
      event.dataTransfer?.setData("text/fishbone-mainline-id", mainline.id);
      label.addClass("fishbone-lane-dragging");
    });
    label.addEventListener("dragover", (event) => {
      event.preventDefault();
      label.removeClass("fishbone-lane-drop-before");
      label.removeClass("fishbone-lane-drop-after");
      label.addClass(getDropPlacement(label, event) === "before" ? "fishbone-lane-drop-before" : "fishbone-lane-drop-after");
    });
    label.addEventListener("dragleave", () => {
      label.removeClass("fishbone-lane-drop-before");
      label.removeClass("fishbone-lane-drop-after");
    });
    label.addEventListener("drop", async (event) => {
      event.preventDefault();
      const sourceId = event.dataTransfer?.getData("text/fishbone-mainline-id");
      if (!sourceId || sourceId === mainline.id) return;
      const placement = getDropPlacement(label, event);
      await this.plugin.mainlineRepository.moveMainline(sourceId, mainline.id, placement);
      new Notice("主线排序已更新");
      await this.render();
    });
    label.addEventListener("dragend", () => {
      clearTimer();
      label.draggable = false;
      label.removeClass("fishbone-lane-drag-ready");
      label.removeClass("fishbone-lane-dragging");
      label.removeClass("fishbone-lane-drop-before");
      label.removeClass("fishbone-lane-drop-after");
    });
  }
}

interface MainlineEditorOptions {
  title: string;
  submitText: string;
  name: string;
  color: string;
  onSubmit: (name: string, color: string) => Promise<void>;
}

class MainlineEditorModal extends Modal {
  private options: MainlineEditorOptions;
  private name: string;
  private color: string;

  constructor(plugin: FishbonePlannerPlugin, options: MainlineEditorOptions) {
    super(plugin.app);
    this.options = options;
    this.name = options.name;
    this.color = options.color;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: this.options.title });

    new Setting(contentEl)
      .setName("主线名称")
      .addText((text) => {
        text
          .setPlaceholder("例如：项目")
          .setValue(this.name)
          .onChange((value) => {
            this.name = value;
          });
        window.setTimeout(() => text.inputEl.focus(), 0);
      });

    new Setting(contentEl)
      .setName("颜色")
      .addColorPicker((picker) => {
        picker
          .setValue(this.color)
          .onChange((value) => {
            this.color = value;
          });
      });

    new Setting(contentEl)
      .addButton((button) => {
        button
          .setButtonText("取消")
          .onClick(() => this.close());
      })
      .addButton((button) => {
        button
          .setButtonText(this.options.submitText)
          .setCta()
          .onClick(async () => {
            try {
              await this.options.onSubmit(this.name, this.color);
              this.close();
            } catch (error) {
              new Notice(error instanceof Error ? error.message : "保存主线失败");
            }
          });
      });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

function getDropPlacement(target: HTMLElement, event: DragEvent): "before" | "after" {
  const rect = target.getBoundingClientRect();
  return event.clientY < rect.top + rect.height / 2 ? "before" : "after";
}
