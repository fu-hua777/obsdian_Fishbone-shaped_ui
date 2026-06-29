# M1：标准任务数据层

## 目标

建立标准任务数据层，作为后续鱼骨视图、辅助模块和每日总结的唯一可信数据源。

## 设计原则

- 默认没有主线，用户后续通过 UI 创建。
- `mainlines.json` 允许空主线列表。
- 任务可以暂时没有主线，此时 `mainline: null`。
- 所有任务关系统一使用 `relations`。
- `task-index.json` 是索引，不替代任务 md。

## 产物

```text
schemas/task.schema.json
schemas/mainlines.schema.json
schemas/task-index.schema.json
sample-vault/PlanningSystem/Mainlines/mainlines.json
sample-vault/PlanningSystem/Tasks/2026/06/2026-06-29_未分配_示例任务.md
sample-vault/PlanningSystem/Index/task-index.json
sample-vault/PlanningSystem/Config/planner-config.json
scripts/validate-schema.js
tests/schema/
```

## 验收

- 校验脚本能读取 sample-vault。
- 空主线配置合法。
- 未分配主线的示例任务合法。
- task-index 与任务 md 基本一致。
