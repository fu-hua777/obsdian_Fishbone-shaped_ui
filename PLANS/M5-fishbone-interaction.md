# M5：鱼骨主视图基础交互版

## 目标

在 M4 静态鱼骨视图基础上，补齐最小可用交互，让用户可以从 Obsidian UI 中创建主线、分配任务主线，并用 checkbox 更新任务完成状态。

M5 仍然不是最终概念图，不做完整仪表盘和复杂拖拽。

## 范围

- 在鱼骨时间视图工具栏中提供 `新建主线` 按钮。
- 点击 `新建主线` 后弹出主线名称和颜色设置。
- 用户在弹窗中输入主线名称和颜色后，写入 `PlanningSystem/Mainlines/mainlines.json`。
- 新建主线字段包含 `id`、`name`、`color`、`icon`、`order`、`visible`、`collapsed`、`pinned`。
- 禁止创建空名称主线。
- 禁止创建重复名称主线。
- 点击已有主线名称可以修改主线名称和颜色。
- 右键已有主线可以删除该主线。
- 长按已有主线后拖动，可以调整主线排序。
- 任务节点显示 checkbox。
- 勾选任务时将当前任务 md 的 `status` 更新为 `done`。
- 取消勾选时将当前任务 md 的 `status` 更新为 `todo`。
- 有用户主线时，任务节点显示主线选择框。
- 修改主线选择时，只更新当前任务 md 的 `mainline` 和 `updated`。
- 视图刷新后根据最新任务和主线数据重新渲染。

## 不做

- 不创建默认主线。
- 不做拖拽改日期。
- 不做拖拽改主线。
- 不做时间尺度缩放。
- 不做画布整体缩放。
- 不做右侧仪表盘。
- 不做底部看板。
- 不扫描或迁移旧笔记。
- 不批量修改任务文件。
- 删除或重命名主线时，不隐式批量重写任务 md。

## 验收命令

```powershell
node scripts/validate-schema.js
node scripts/validate-m2-skills.js
node scripts/validate-m3-plugin.js
node scripts/validate-m4-fishbone.js
node scripts/validate-m5-interaction.js
cd plugin
npm run typecheck
npm run build
```

## Obsidian 验收

- 命令面板执行 `Fishbone Planner: 打开鱼骨时间视图`。
- 工具栏只出现 `新建主线` 按钮和刷新按钮。
- 点击 `新建主线` 后弹出 `主线名称` 和颜色设置。
- 输入用户主线名称并确认后，`mainlines.json` 被写入新主线。
- 新建主线后，鱼骨图出现对应用户泳道。
- 点击已有主线名称，可以弹窗修改主线。
- 右键已有主线，可以删除主线。
- 长按并拖动已有主线，可以调整主线顺序。
- 未分配任务节点出现主线选择框。
- 将任务分配到用户主线后，任务 md 的 `mainline` 更新。
- 勾选任务后，任务 md 的 `status` 更新为 `done`。
- 取消勾选后，任务 md 的 `status` 更新为 `todo`。
- 不出现由系统自动创建的健康、学习、事业、生活、财务默认主线。

## M6 进入条件

- 用户主线可以从 UI 创建。
- 任务可以从 UI 分配到用户主线。
- 任务可以从 UI 完成和取消完成。
- 构建和校验全部通过。
- M5 手动验收清单完成。
