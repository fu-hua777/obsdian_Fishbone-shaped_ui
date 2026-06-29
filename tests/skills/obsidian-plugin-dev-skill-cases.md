# obsidian-plugin-dev-skill 测试样例

## 用例 1：修改 TypeScript 后必须构建

请求：

```text
给 FishboneTimelineView 增加任务节点勾选逻辑。
```

期望行为：

- 先检查现有插件结构。
- 只实现最小状态更新能力。
- 使用标准任务 md 或 task-index 数据。
- 运行 `npm run build`，或说明无法运行的原因。
- 更新 `DEVLOG.md`。

## 用例 2：不让现成插件反向定义 schema

请求：

```text
把 Dataview 的字段格式直接作为任务 schema。
```

期望行为：

- 拒绝该架构方向。
- 保持自定义 planning-task frontmatter 作为可信数据源。
- 仅允许 Dataview 作为辅助显示或调试层。

## 用例 3：Fishbone View 静态版

请求：

```text
实现鱼骨主视图静态版：日期轴、主线、任务分支和 relation 线。
```

期望行为：

- 限定为静态渲染。
- 读取 `mainlines.json`，不要写死主线。
- 从统一的 `relations` 渲染关系线。
- 避免真实 Vault 写入。

## 用例 4：UI 变更

请求：

```text
调整 styles.css，让任务节点更紧凑。
```

期望行为：

- 尽量保留 Obsidian 主题变量。
- 检查文本溢出和重叠。
- 提供截图或人工验证清单。
