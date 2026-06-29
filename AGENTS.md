# AGENTS.md

## 项目目标

本项目用于开发一个基于 Obsidian + Codex + 自定义插件 + Skills 的个人主线规划系统。

核心链路：

```text
原始输入 -> 任务标准化 -> 标准任务 md -> 鱼骨主视图 -> 辅助模块联动
```

最终 UI 以用户提供的概念图为方向：中央为多主线鱼骨时间视图，右侧为聚焦、重点、进度、快速输入、时间天气和每日总结，底部为待办、进行中、已完成状态区。

## 当前阶段

当前已完成：

- M0：项目基线整理。
- M1：标准任务数据层。
- M2：Skills 回放校验与规则补强。

当前下一阶段可进入 M3：自定义 Obsidian 插件最小框架。

在进入 M3 前后，仍然不开发完整鱼骨 UI，不接入真实 Vault。

## 目录约定

```text
docs/                         架构文档与工作流指南
PLANS/                        各里程碑计划
.agents/skills/               Codex Skills
schemas/                      标准任务数据层 schema
sample-vault/PlanningSystem/  测试用 Vault 数据
scripts/                      校验与生成脚本
tests/                        测试样例
DEVLOG.md                     阶段日志
```

## 可修改文件

- `.agents/skills/**`
- `docs/**`
- `PLANS/**`
- `schemas/**`
- `sample-vault/**`
- `scripts/**`
- `tests/**`
- `AGENTS.md`
- `DEVLOG.md`
- `README.md`

## 禁止或需确认的操作

以下操作必须先停止并等待用户确认：

- 删除文件。
- 批量重命名文件。
- 批量修改真实 Vault 文件。
- 覆盖旧笔记内容。
- 修改真实任务数据。
- 接入真实 Vault。
- 执行不可逆脚本。
- 改变核心任务 schema。
- 改变 `relations` 字段结构。
- 改变 `mainlines.json` 配置格式。
- 大规模重构插件目录。

## 数据规则

- 默认没有主线；主线由用户后续通过 UI 创建。
- `mainlines.json` 必须允许空数组。
- 未分配主线的任务使用 `mainline: null`，并保持 `review_status: pending` 或 `status: inbox`。
- 标准任务 md 是唯一可信数据源。
- `task-index.json` 是索引和缓存，不是唯一数据源。
- 所有任务关系统一使用 `relations` 字段。

## 构建与测试命令

当前阶段使用：

```text
node scripts/validate-schema.js
node scripts/validate-m2-skills.js
```

后续插件阶段再加入：

```text
npm run build
```

## 汇报格式

每个阶段结束后输出：

```text
## 本次完成内容
## 文件变更清单
## 测试与校验结果
## 当前风险
## 需要用户确认的问题
## 下一步建议
```
