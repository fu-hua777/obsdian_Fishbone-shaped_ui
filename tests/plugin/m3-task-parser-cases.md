# M3 任务解析用例

## 用例 1：未分配任务

输入 frontmatter：

```yaml
type: planning-task
task_id: task_20260629_001
title: 通过 UI 创建第一条主线
date: 2026-06-29
mainline: null
status: inbox
priority: medium
relations: []
review_status: pending
confidence: 1
```

期望：

- 解析为 planning task。
- `mainline` 为 `null`。
- UI 显示为 `未分配`。
- 状态为 `inbox`。

## 用例 2：非 planning-task 文件

输入：

```yaml
title: 普通笔记
```

期望：

- 不解析为规划任务。
- 不显示在任务列表。

## 用例 3：空主线配置

输入：

```json
{
  "version": "1.0",
  "mainlines": []
}
```

期望：

- 插件正常读取。
- 任务列表显示空主线提示。
