# M7 真实使用闭环验收清单

## 前置条件

- Obsidian 已打开真实 vault：`E:\主线规划\主线规划`。
- Fishbone Planner 插件已启用。
- Local REST API 插件已启用。
- 开发仓库已完成 `plugin` 构建。

## 验收步骤

1. 运行全量静态验证脚本，确认 M2-M6 所有验证通过。
2. 在 `plugin` 目录运行 `npm run build`，确认 TypeScript 与打包通过。
3. 运行 `node scripts/validate-m7-real-loop.js`，确认真实 vault 插件产物与仓库一致。
4. 通过 Local REST API 请求根路径，确认 Obsidian REST 可访问。
5. 读取 REST 命令列表，确认存在：
   - `obsidian-fishbone-planner:open-fishbone-timeline`
   - `obsidian-fishbone-planner:refresh-fishbone-timeline`
6. 执行打开鱼骨视图和刷新鱼骨视图命令，确认接口返回 204。
7. 创建 M7 测试任务：
   - 路径：`PlanningSystem/Tasks/2026/07/2026-07-02_项目_M7真实闭环测试任务.md`
   - `source_type: quick-input`
   - `source_excerpt` 保留原始快速输入文本。
8. 将该任务 `status` 更新为 `doing`。
9. 再次读取本地文件和 REST metadata，确认状态都为 `doing`。
10. 在 Obsidian 鱼骨画布视图中刷新，确认该任务出现在“项目”主线对应日期附近。

## 通过标准

- 静态验证、构建、真实 vault 文件校验、REST 可达性和任务状态写回全部通过。
- 验证过程不删除真实 vault 文件。
- Local REST API key 不出现在仓库、提交记录或用户可见输出中。
