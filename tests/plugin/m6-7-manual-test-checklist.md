# M6.7 每日总结模块验收清单

## 前置条件

- 已启用 Fishbone Planner 插件。
- 鱼骨画布视图右侧工作台可见。
- Vault 中存在若干今日任务、进行中任务或阻塞任务。

## 验收步骤

1. 打开鱼骨画布视图，确认右侧出现“每日总结”模块。
2. 未生成当天总结时，模块显示“未生成”或“今日总结尚未生成”，且“查看总结”按钮不可用。
3. 点击“生成总结”，确认写入：
   - `PlanningSystem/DailyReports/YYYY-MM-DD_每日总结.md`
   - frontmatter 包含 `type: daily-summary`、`date`、`generated_at`、`task_count`、`done_count`、`blocked_count`。
   - 正文包含 1-9 个总结章节。
4. 生成后模块显示“已生成”和最近生成时间。
5. 点击“查看总结”，确认 Obsidian 打开对应总结 md。
6. 修改一个任务状态后，点击“重新生成”，确认同一个总结文件被覆盖更新，而不是创建重复文件。
7. 只刷新或打开鱼骨画布视图时，不应自动写入总结文件。

## 通过标准

- 总结内容只基于标准任务 md 和主线配置生成，不编造完成事项。
- 快速输入来源任务会进入确认事项或新增任务统计。
- 没有 relation 变化时写“无明确记录”。
- `npm run typecheck`、`npm run build` 和 `node scripts/validate-m6-7-daily-summary.js` 通过。
