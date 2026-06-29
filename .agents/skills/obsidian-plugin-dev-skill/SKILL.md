---
name: obsidian-plugin-dev-skill
description: 指导个人规划系统的自定义 Obsidian 插件开发。用于创建或修改插件 TypeScript、Fishbone Timeline View、任务读写逻辑、设置页、styles.css、构建配置、UI 行为、任务状态更新或插件测试，并确保 sample-vault 与真实 Vault 数据安全。
---

# Obsidian Plugin Dev Skill

## 核心规则

以小里程碑开发自定义插件。不要一次性开发完整规划系统。始终把标准任务数据模型作为唯一可信数据源。

## 架构边界

插件负责：

- Fishbone Timeline View。
- 读取标准 planning-task md。
- 读取 `PlanningSystem/Mainlines/mainlines.json`。
- 读取和更新 `PlanningSystem/Index/task-index.json`。
- 显示任务节点、主线、日期轴和 relation 关系线。
- 用户勾选或取消勾选任务时更新任务状态。
- 通过 Obsidian API 打开和编辑任务 md。
- 在需要时提供快速输入和候选任务预览。

插件不得让现成 Obsidian 插件反向定义核心 schema。
鱼骨主视图必须由自定义插件实现；现成插件只能作为辅助模块或交互参考，不能替代主视图。

## 建议模块

除非现有仓库已有更清晰的结构，否则使用以下高层结构：

```text
PlanningPlugin
├─ TaskIntake
├─ TaskData
├─ FishboneView
├─ DashboardModules
└─ Settings
```

Fishbone Timeline View 可进一步拆分为：

```text
FishboneTimelineView
├─ DateAxisRenderer
├─ MainlineRenderer
├─ TaskBranchRenderer
├─ RelationLineRenderer
├─ TaskCheckboxController
├─ ViewportController
├─ ZoomController
├─ MainlineFilterController
└─ TaskOpenController
```

## 数据规则

- 从标准任务 md 或 `task-index` 读取任务。
- 标准任务 md 是权威任务来源。
- 所有任务关系都保存在 `relations` 字段中。
- 主线数量、名称、颜色、排序、可见性、折叠状态和固定状态都必须可配置。
- 插件内部读写文件时使用 Obsidian Vault API。
- 真实 Vault 写入必须由用户显式操作触发，并配合备份或 commit 检查。

## Fishbone View 原则

需要渲染：

- 横向日期轴。
- 用户定义的主线脊骨。
- 挂载到日期与主线上的任务分支。
- 根据需要显示带标签和箭头的虚线关系。
- 任务节点上的状态、优先级和完成情况。

至少支持：

- 点击任务节点打开任务 md。
- 勾选任务节点标记完成。
- 取消勾选恢复为待办。
- 横向拖动或滚动。
- 主线超过视口时支持纵向滚动。

时间尺度缩放和画布整体缩放是两个不同概念，不要合并为一个设置。

## UI 约束

- 构建面向工作的 Obsidian UI，不做营销页式界面。
- 控件保持紧凑、可预测。
- 避免过大的装饰性卡片。
- 尽量使用 Obsidian 主题变量。
- 确保任务文本不与节点、线条或控件重叠。
- 当主线较多时，通过折叠、隐藏、分组、筛选和固定控制可用性。

## 构建与测试要求

修改 TypeScript 后，运行仓库构建命令，通常是：

```text
npm run build
```

修改 schema 后，运行可用的 schema 校验。

修改任务生成或标准化逻辑后，运行 task-normalizer 测试。

修改 UI 后，提供以下至少一种结果：

- 截图验证说明。
- 如果没有截图自动化能力，则提供人工测试清单。

每个里程碑完成后更新 `DEVLOG.md`。

## 安全开发流程

1. 编辑前读取现有插件结构。
2. 确定最小里程碑。
3. 先使用 `sample-vault` 测试数据。
4. 实现范围明确的变更。
5. 构建并运行聚焦测试。
6. 在 `DEVLOG.md` 记录变更和风险。
7. 接入真实 Vault 前停止并等待用户确认。

## 不应做

- 不要在一次宽泛变更中开发完整插件。
- 未经确认不要连接或修改真实 Vault。
- 不要让现成插件定义任务 schema。
- 不要用第三方插件视图替代自定义 Fishbone View。
- 不要随意修改 `relations`、`mainlines.json` 或任务 frontmatter schema。
- TypeScript 修改后不要跳过构建验证。

## 检查清单

- 变更范围限定在一个里程碑。
- 任务 md 仍是唯一可信数据源。
- Fishbone View 仍使用用户定义的主线。
- 避免真实 Vault 写入，或已经明确确认。
- 代码变更后已运行 `npm run build` 或仓库等价命令。
- 已更新 `DEVLOG.md`。
