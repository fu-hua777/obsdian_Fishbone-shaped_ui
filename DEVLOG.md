# DEVLOG

## 2026-06-29

### M0：项目基线整理

- 初始化开发仓库：`E:\obsdian_插件设计`。
- 迁移架构文档到 `docs/`。
- 迁移 4 个中文化 Skill 到 `.agents/skills/`。
- 迁移 Skill 测试样例到 `tests/skills/`。
- 创建 `AGENTS.md`、`README.md` 和里程碑计划。

### M1：标准任务数据层

- 设计任务、主线和索引 schema。
- 创建 `sample-vault/PlanningSystem` 示例结构。
- 默认主线为空，后续由用户通过 UI 创建。
- 创建未分配主线的示例任务。
- 创建 schema 校验脚本。

### M2：Skills 回放校验与规则补强

- 创建 `PLANS/M2-skills-validation.md`。
- 创建 `tests/skill-replay/` 结构化回放用例。
- 修正 planning-task 测试样例：默认空主线时不再期望 `项目`、`学习` 等主线，而是使用 `mainline: null` 并要求用户确认。
- 补强 `planning-task-skill`：当主线列表为空时不得猜测主线，必须提问。
- 中文化剩余 Skill 测试样例中的英文验收描述。
- 创建 `scripts/validate-m2-skills.js`，用于校验 M2 关键规则一致性。

### M3：自定义 Obsidian 插件最小框架

- 创建 `plugin/` Obsidian 插件工程。
- 实现 `Fishbone Planner` 最小插件入口。
- 实现任务列表视图：读取标准任务 md，显示日期、主线、状态和优先级。
- 支持空主线状态：`mainline: null` 显示为 `未分配`。
- 支持打开单个任务 md。
- 支持单个任务状态切换，并仅更新当前任务文件的 `status` 和 `updated`。
- 增加 M3 验证命令：`Fishbone Planner: 切换第一条任务状态（M3 验证）`，用于通过 REST 命令接口验证状态更新逻辑。
- 创建 `scripts/install-m3-plugin.js`，将 `PlanningSystem` 和插件产物安装到测试 Vault。
- 创建 `scripts/validate-m3-plugin.js`。
- 创建 M3 手动验证清单和解析用例。
- 已安装到测试 Vault：`E:\主线规划\主线规划`。

M3 未做：

- 未实现完整鱼骨主视图。
- 未实现 relation 线、拖拽、缩放、右侧栏或底部看板。
- 未扫描或修改旧笔记。
- 未启用插件；需要用户在 Obsidian 中手动启用 `Fishbone Planner`。

### M4：鱼骨主视图静态版

- 新增 `FishboneTimelineView` 静态视图。
- 新增 `fishboneLayout.ts`，将任务和用户主线转换为鱼骨布局。
- 新增 `fishboneRenderTypes.ts`，定义鱼骨布局渲染结构。
- 新增命令：`Fishbone Planner: 打开鱼骨时间视图`。
- 新增命令：`Fishbone Planner: 刷新鱼骨时间视图`。
- 当前默认无主线时显示 `未分配` 泳道，不创建默认主线。
- 新增 `scripts/validate-m4-fishbone.js`。
- 新增 M4 手动验证清单。

### M5：鱼骨主视图基础交互版

- 在鱼骨时间视图工具栏新增用户主线创建控件。
- 新增 `MainlineRepository.createMainline()`，通过 Obsidian Vault API 写入 `mainlines.json`。
- 主线创建禁止空名称和重复名称，不创建任何默认主线。
- 任务节点新增 checkbox，支持勾选为 `done`、取消勾选恢复为 `todo`。
- 任务节点新增主线选择框，支持将当前任务分配到用户创建的主线。
- 新增 `TaskRepository.setTaskMainline()` 和 `TaskRepository.setTaskDone()`，只更新当前任务 md 的 frontmatter。
- 新增 `PLANS/M5-fishbone-interaction.md`、`scripts/validate-m5-interaction.js` 和 M5 手动验证清单。
- 修正 M5 工具栏：主线名称和颜色设置改为点击 `新建主线` 后弹窗输入。
- 已有主线支持点击名称修改、右键删除、长按拖动排序。
- 主线拖动排序支持按落点插入到目标主线前或后，不再只能插到目标主线前。
- 修复 checkbox 写入后立即刷新读到旧 metadata cache，导致看起来需要点击两次的问题。

### M5.1：鱼骨时间轴与分支布局升级

- 新增 `fishboneViewport.ts`，默认提供当前周 7 天的连续日期轴。
- 新增上一周、下一周、今天、显示全部和周视图切换控制。
- `buildFishboneLayout` 改为使用视口提供的日期列，不再只从已有任务日期生成列。
- 无任务日期也会显示，今天日期列高亮。
- 任务节点按 `date + mainline` 挂载到连续日期轴中。
- 任务节点围绕主线脊骨上下错位，形成基础鱼骨分支感。
- 增加任务状态和优先级视觉样式。
- 新增 `scripts/validate-m5-1-timeline-layout.js` 和 M5.1 手动验证清单。

### M5.1 修正：鱼骨画布视图底座

- 将 M5.1 方向从连续日期 grid 修正为坐标化鱼骨画布。
- 新增 `fishboneCanvasViewport.ts`，支持画布平移、整体缩放、时间轴缩放和单主线缩放状态。
- 新增 `fishboneCanvasLayout.ts`，将日期、主线和任务转换为 canvas 坐标。
- `FishboneTimelineView` 主渲染改为 `fishbone-canvas-viewport` / `fishbone-canvas-stage` / layer 结构。
- 支持按住空白画布拖动平移。
- 支持 `Ctrl + 滚轮` 在主线外缩放整体画布，在主线内缩放单条主线。
- 支持 `Alt + 滚轮` 或在日期轴上 `Ctrl + 滚轮` 调整时间轴密度。
- M5.1 校验和手动测试清单改为验证画布模型。

### M5.1 修正：主线标签可见性
- 新增 `fishbone-canvas-label-layer` 覆盖层，将主线名称固定显示在画布视口左侧。
- 主线标签纵向跟随画布平移和缩放，横向不再随 stage 平移移出屏幕。
- 标签显示主线名称和类型提示，保留点击修改、右键删除、长按拖动排序。
- `Ctrl + 滚轮` 放在主线标签上时也会缩放对应主线。

### M5.1 修正：主线排序落点
- 新增画布级主线排序 drop 处理，拖动主线标签后可按落点纵向位置重排。
- 排序不再依赖必须精确丢到另一个主线标签上，拖到画布主线区域也能计算插入位置。
- 拖拽进入画布时增加 `is-mainline-drag-over` 视觉状态。
