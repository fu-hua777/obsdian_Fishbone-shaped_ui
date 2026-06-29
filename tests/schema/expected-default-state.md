# M1 默认数据状态验收

## 期望

- `mainlines.json` 合法且 `mainlines` 为空数组。
- 示例任务允许 `mainline: null`。
- 示例任务状态为 `inbox`，表示尚未分配主线。
- `task-index.json` 包含示例任务，但不替代任务 md。
- `node scripts/validate-schema.js` 能通过。
