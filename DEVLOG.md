# DEVLOG

### M5.4 交互修正：滚轮缩放语义
- 鱼骨画布普通滚轮现在直接以鼠标位置为锚点缩放整体画布，不再要求按住 `Ctrl`。
- `Ctrl + 滚轮` 在鼠标位于主线、任务或主线标签区域时缩放对应单条主线。
- 移除鱼骨画布视图中滚轮触发时间轴缩放的分支，避免和整体画布缩放冲突。
- 修复快速滚轮缩放时多个异步 `render()` 交叠导致整套鱼骨视图重复渲染的问题；普通画布缩放改为直接更新 transform 并延迟保存视图状态。

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

### M5.1 修正：主线长按直拖
- 主线排序从 HTML5 `draggable` 二次触发改为 pointer 长按直拖。
- 长按时间从 450ms 调整为 260ms，长按后无需再次点击即可移动并在松手时排序。
- 拖动完成后短暂抑制 click，避免误打开主线编辑弹窗。

### M5.2 计划：任务节点交互与关系线合并
- 将原 M5.2 任务节点交互增强和 M5.3 relation 关系线合并为一个阶段。
- 新增计划文档 `PLANS/M5.2-task-node-and-relations.md`。
- 合并后的重点是任务拖拽改日期/主线、任务右键编辑、hover 详情、relation 解析与画布关系线渲染。

### M5.2：任务节点交互与关系线实现
- 扩展 `TaskRepository` 写回能力，新增 `updateTaskFields()`、`setTaskDate()`、`setTaskPriority()` 和 `setTaskStatus()`，仍只修改当前任务 md 的 frontmatter。
- 扩展 `fishboneCanvasLayout.ts`，为任务节点输出稳定尺寸、锚点、任务映射、坐标反推日期/主线能力，并生成 `relationLines`。
- 任务节点支持长按拖动，松手后按落点更新 `date` 和 `mainline`，拖到未分配泳道时写入 `mainline: null`。
- 任务节点支持右键菜单、属性编辑弹窗和 hover 详情浮层。
- 新增 SVG relation layer，支持虚线、箭头、标签、显示开关、hover 高亮和右键打开来源/目标任务。
- 新增 `scripts/validate-m5-2-task-relations.js` 和 `tests/plugin/m5-2-manual-test-checklist.md`。
- 本阶段仍不做 relation 编辑器、拖拽创建 relation、task-index 同步和右侧工作台。

### M5.3：画布导航、时间轴模式与概念图视觉打磨
- 新增 `PLANS/M5.3-canvas-navigation-and-visual-polish.md`，明确 M5.3 继续聚焦鱼骨主画布，不进入右侧工作台。
- 扩展 `fishboneCanvasViewport.ts`，新增 `TimeAxisMode`、日期范围、跳转日期、适应窗口、显示全部和视图状态校验能力。
- 扩展 `fishboneCanvasLayout.ts`，支持隐藏/折叠/固定主线、任务计数、同日同主线任务聚合节点和总览日期 tick。
- 扩展 `MainlineRepository`，支持 `updateMainlineFlags()` 和 `showAllMainlines()`。
- 扩展插件 settings，持久化鱼骨画布视图状态，包括缩放、中心日期、时间轴模式、关系显示开关、隐藏主线管理和聚合展开状态。
- 重建鱼骨顶部工具栏，新增日/周/月/总览、今天、跳转、适应窗口、显示全部、重置、隐藏关系、管理隐藏、显示全部主线等控件。
- 主线右键菜单新增折叠/展开、隐藏/显示、固定/取消固定。
- 新增画布快捷键：`T` 今天、`F` 适应窗口、`R` 关系开关、`0` 重置、`1/2/3/4` 切换时间轴模式。
- 样式向概念图靠近：深色画布层次、紧凑工具栏、日期选中态、主线状态 chip、胶囊式任务节点、relation 弱化和 hover 高亮。
- 新增 `scripts/create-m5-3-self-test-data.js`，已向测试 Vault 写入 8 个 M5.3 自测任务、5 条 relation，并形成同日同主线 5 任务密集桶。
- 新增 `scripts/validate-m5-3-canvas-navigation.js` 和 `tests/plugin/m5-3-manual-test-checklist.md`。
- 本阶段仍不做 relation 编辑器、拖拽创建 relation、快速笔记、每日总结和右侧工作台。

### M5.3 修正：关系开关与密集任务显示
- 关系显示按钮改为只切换 SVG relation layer 可见性，不再重绘整张画布或重建数据仓库，避免误影响主线显示。
- 视图状态保存新增轻量路径，保存缩放、关系开关等画布状态时不触发仓库重建。
- 同日同主线任务从纵向堆叠改为围绕当天中心横向展开，10 个以上才聚合，减少同日密集任务拥挤。
- 任务节点简化为完成框、标题和优先级标记，移除节点内主线下拉框；任务详细信息保留在 hover 浮窗中。
- M5 交互验证脚本同步改为检查任务编辑弹窗/右键菜单的主线分配能力，不再要求画布节点内置主线下拉框。

### M5.3 热修复：重启后视图不可操作
- 将关系按钮文本更新和关系层 class 切换改为原生 DOM API，避免 Obsidian/Electron 重启后扩展方法兼容性导致按钮事件中断。
- 关系层隐藏从 `display: none` 改为 `opacity + visibility + pointer-events`，避免 SVG layer 隐藏影响后续画布层渲染。
- 已在测试 Vault 重置鱼骨视图状态到默认视角，主线与任务数据未修改。
- 修复 SVG relation 分组 class 添加方式，避免把 `fishbone-relation is-dependency` 作为单个 token 导致 `DOMTokenList.add` 抛错。
- 增加鱼骨视图诊断/降级渲染，渲染异常时显示真实错误、数据路径和主线文件状态，避免整页空白。

### M5.3 修正：任务标签单行与分支线
- 任务节点高度压缩为单行胶囊，去掉卡片式二行观感。
- 新增 `fishbone-task-branch-layer`，为每个任务绘制连接主线脊骨的短分支线。
- 覆盖旧 grid 鱼骨样式中的 `.fishbone-branch-above/below` transform，避免 canvas 坐标布局后被二次偏移。

### M5.3 修正：密集日期槽自适应
- 新增动态日期槽宽度模型：同一天同主线任务越多，该日期槽自动变宽，避免任务挤出当前日期区域。
- 同日任务改为按列排列，一列最多上下两个任务，减少横向占用。
- 任务拖拽时锁定原日期，只允许按落点切换主线，避免小任务被拖出所属日期。

### M5.4.1-M5.4.3：短期分支主线基础
- 新增 `PLANS/M5.4-branch-mainlines.md`，将 M5.4 拆为数据兼容、静态分支渲染、分支子任务挂载、编辑入口、交互行为和验收打磨六个小阶段。
- 扩展 `Mainline` 数据结构，支持 `type: "branch"`、父主线、起始日期和结束日期；旧主线数据默认兼容为普通主线。
- 扩展任务解析，读取 `branch_mainline_id` 和 `branch_mainline`，用于把小任务挂载到短期分支主线。
- 鱼骨画布新增分支主线层，分支从父主线脊骨分叉，按起止日期渲染有限长度线段，并显示分支名称、日期范围和任务数量。
- 分支任务优先挂载到对应分支主线，日期超出分支范围时显示位置夹取到起止范围内，并在 hover 信息中提示显示日期。
- 动态日期槽宽统计纳入分支任务夹取后的显示日期，避免同日分支任务挤压。
- 新增 `scripts/create-m5-4-self-test-data.js`、`scripts/validate-m5-4-branch-mainlines.js`、`tests/plugin/m5-4-branch-mainline-fixture.json` 和 M5.4 手动验收清单。
- 本阶段尚不做分支主线 UI 创建/编辑、拖拽调整端点、从普通任务转换为分支主线、分支删除与子任务解除挂载，这些进入 M5.4.4-M5.4.6。

### M5.4.4-M5.4.6：分支主线编辑、拖拽与验收
- 扩展 `MainlineRepository`，新增 `createBranchMainline()`、`updateBranchMainline()` 和 `updateBranchMainlineOffset()`，支持分支主线创建、编辑和垂直偏移保存。
- 扩展 `TaskRepository.updateTaskFields()`，可写回 `branch_mainline_id` 与 `branch_mainline`，并正确等待 metadata cache 更新。
- 任务右键菜单新增 `转换为分支主线` 和 `移出分支主线`；任务属性弹窗新增分支主线选择。
- 分支主线支持点击编辑、右键折叠/展开、删除并确认是否解除子任务挂载。
- 分支主线支持长按后上下拖动保存垂直位置；日期端点仍由起止日期控制。
- 任务拖拽支持拖入分支写入分支字段、从分支拖回普通主线时清除分支字段；分支内横向拖动日期会被限制在分支起止范围内。
- 补充分支 hover/拖动视觉、分支拖拽目标提示、自测 fixture、M5.4 校验脚本和手动验收清单。
### M5.4 修正：固定顶部时间轴
- 将日期刻度层从随画布变换的 `fishbone-canvas-stage` 移到画布覆盖层 `fishbone-fixed-date-axis-layer`。
- 时间轴纵向固定在画布顶部，横向仍随画布平移和缩放重新计算位置，保持与任务日期列对齐。
- 更新 M5.1 结构校验，防止日期轴回退为随 stage 一起移动的实现。
### M5.4 修正：时间轴标签防重叠
- 固定顶部时间轴新增基于屏幕间距的标签避让逻辑。
- 整体缩放较小时优先显示中心日期、今天和主要日期，普通日期隐藏文字但保留竖向时间参考线。
- 补充 `is-axis-label-hidden` 样式，避免日期背景块和文字在低缩放下互相覆盖。
### M5.5-M5.7：鱼骨主画布收口
- 新增 `PLANS/M5.5-M5.7-fishbone-canvas-polish.md`，将后续 M5 收口拆为节点避让、拖拽写回规则、分支标签与曲线连接三部分。
- 任务节点布局改为按主线/分支、上下侧和轨道进行碰撞避让，相邻日期任务也参与最小间距计算。
- 普通任务拖拽现在按落点写回日期和主线；无效落点会回到原位，不写入任务文件。
- 分支主线新增上下方向语义，父主线到分支的连接线改为 SVG 平滑曲线，分支标签层级提升以避免被分支任务遮挡。
- 新增 `scripts/validate-m5-5-7-canvas-polish.js` 和 M5.5-M5.7 手动验收清单。
### M5.5-M5.7 验证增强：布局回归
- 新增 `tests/plugin/m5-5-7-layout-regression.ts`，直接调用 `buildFishboneCanvasLayout` 验证密集任务避让、分支日期吸附、分支上下方向和 relation 锚点。
- 新增 `scripts/validate-m5-5-7-layout-regression.js`，使用项目已有 esbuild 临时编译并执行布局回归，不引入额外运行依赖。
### M5.5-M5.7 修正：分支标签浮层与按钮清理
- 分支主线线段与分支主线标签拆分为独立层级：线段保持在任务后方，标签浮在任务上方并继续支持点击编辑、右键菜单和拖拽调整。
- 顶部工具栏的 `管理隐藏`、`显示全部主线` 只在存在隐藏主线或正在查看隐藏主线时显示，避免没有实际作用的按钮占据界面。
### M5.5-M5.7 修正：分支连接连续性
- 父主线到短期分支主线的连接线改为先弯曲接入分支线起点，再沿分支线重叠一段，避免缩放或标签遮挡后出现视觉断点。
- 分支线和分支标签拖拽改为基于指针移动增量保存 `branch_offset`，避免拖动浮动标签时产生跳位。
### M5.5-M5.7 修正：短期主线标签与连接覆盖
- 父主线到短期分支主线的连接线进一步延伸到分支线末端，与分支线完整重叠，避免标签或任务节点遮挡后仍显得断连。
- 短期主线标签改为透明背景、无边框、无阴影，只显示分支名称；详细日期范围保留在 hover title 中，不再占用画布空间。
### M5.5-M5.7 修正：移除重复分支横线
- 连接线不再沿短期主线横向延伸，避免与真实分支线叠成两条平行线。
- 在短期主线起点新增小接头点，用于保证父主线曲线与分支线视觉连续。
