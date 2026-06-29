# M3：自定义 Obsidian 插件最小框架

## 目标

建立可构建、可安装、可读取标准任务数据层的最小 Obsidian 插件。

M3 只做任务列表验证界面，不实现完整鱼骨主视图。

## 范围

- 创建 `plugin/` 工程。
- 实现 Obsidian 插件入口。
- 读取 `PlanningSystem/Mainlines/mainlines.json`。
- 读取 `PlanningSystem/Tasks/**/*.md` 中的标准任务。
- 显示任务列表。
- 支持打开任务 md。
- 支持单个任务状态切换。
- 将构建产物安装到测试 Vault：
  `E:\主线规划\主线规划\.obsidian\plugins\obsidian-fishbone-planner`

## 不做

- 不开发完整 Fishbone Timeline View。
- 不画 relation 线。
- 不做拖拽、缩放、右侧栏和底部看板。
- 不扫描或修改旧笔记。
- 不接入除测试 Vault 之外的真实 Vault。
- 不改变 M1 schema。

## 验收命令

```powershell
node scripts/validate-schema.js
node scripts/validate-m2-skills.js
node scripts/validate-m3-plugin.js
cd plugin
npm install
npm run typecheck
npm run build
```

## 手动验收

在 Obsidian 的 `主线规划` Vault 中：

1. 确认插件已安装到 `.obsidian/plugins/obsidian-fishbone-planner/`。
2. 启用 `Fishbone Planner` 插件。
3. 执行命令 `Fishbone Planner: 打开任务列表`。
4. 确认能看到示例任务。
5. 确认主线为空时显示为 `未分配`。
6. 点击状态按钮，确认单个任务状态能更新。

## M4 进入条件

- M3 构建通过。
- 测试 Vault 中插件产物齐全。
- REST API 能读取 `PlanningSystem/` 和插件目录。
- 手动验收没有阻塞问题。
