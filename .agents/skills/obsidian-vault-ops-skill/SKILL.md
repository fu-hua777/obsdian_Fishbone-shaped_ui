---
name: obsidian-vault-ops-skill
description: 安全操作个人规划系统中的 Obsidian Vault 文件。用于扫描笔记、抽取任务、写入标准任务 md、更新 task-index、修改 mainlines.json、生成每日总结、迁移规划文件，或执行任何可能影响 sample-vault 或真实 Vault 的批量文件操作。
---

# Obsidian Vault Ops Skill

## 核心规则

所有测试优先使用 `sample-vault`。任何真实 Vault 操作都按用户数据敏感操作处理。默认不修改原始旧笔记。

## 安全等级

使用三个等级：

- `safe`：只读检查，或只在 sample-vault 中写入新文件。
- `guarded`：在已有备份或 commit 后，向真实 Vault 写入新的规划文件。
- `stop`：删除、覆盖、批量重命名、批量修改、改变核心 schema，或首次连接真实 Vault。

遇到 `stop` 操作时，必须暂停并等待用户确认。
高风险操作必须停止并等待用户确认，不得用推测、默认同意或自动备份来绕过确认。

## 标准规划路径

除非项目配置另有说明，使用以下路径：

```text
PlanningSystem/Tasks/YYYY/MM/YYYY-MM-DD_主线_任务标题.md
PlanningSystem/Mainlines/mainlines.json
PlanningSystem/Index/task-index.json
PlanningSystem/DailyReports/YYYY-MM-DD_每日总结.md
PlanningSystem/Inbox/quick-notes.md
PlanningSystem/Inbox/unprocessed-inputs.md
PlanningSystem/Config/planner-config.json
```

路径创建必须可预测。文件名中的任务标题需要做安全化处理，但 frontmatter 中的标题保持可读。

## 文件操作规则

- 默认读取旧笔记并创建新的任务 md 文件。
- 抽取任务时不要改写来源笔记。
- 每个抽取任务必须记录 `source_file` 和 `source_excerpt`。
- 除非用户明确要求，否则先在 `sample-vault` 写入生成文件。
- 真实 Vault 写入前，确认存在 Git commit、备份或其他可回滚点。
- 删除或覆盖前，必须停止并请求用户明确确认。

## 任务文件命名

使用：

```text
YYYY-MM-DD_主线_任务标题.md
```

当标题冲突时，追加稳定后缀：

```text
YYYY-MM-DD_主线_任务标题_002.md
```

如果日期未知，不要编造日期；写入 inbox 或 pending-review 位置：

```text
PlanningSystem/Inbox/unprocessed-inputs.md
```

## Source 追踪

对抽取任务，必须保留：

- `source_type`：`nl_input`、`daily_note`、`project_note`、`study_note`、`paper_note`、`retrospective_note`、`manual` 或其他明确类型。
- `source_file`：可用时使用相对 Vault 路径。
- `source_excerpt`：最小且有用的来源摘录。

不要编造来源摘录。

## task-index 规则

更新 `task-index.json` 时：

- 包含 task id、title、date、mainline、status、priority、path、relations summary、updated time 和 review status。
- 保持索引条目与任务 md frontmatter 一致。
- 当索引一致性不确定时，从任务 md 重建。
- 不要把索引当作唯一可信数据源。

## mainlines.json 规则

尊重用户定义的主线：

- `id`
- `name`
- `color`
- `icon`
- `order`
- `visible`
- `collapsed`
- `pinned`

未经用户明确批准，不要改写 mainline 配置格式。

## 备份与回滚

执行 guarded 或 stop 级别的真实 Vault 变更前：

1. 检查 Vault 或项目是否在 Git 下。
2. 检查是否存在未提交变更。
3. 只有在用户授权操作时，才请求或创建可回滚点。
4. 记录变更文件和操作目的。

不要用破坏性命令模拟回滚。

## 停止清单

以下情况必须停止并等待确认：

- 删除文件。
- 批量重命名文件。
- 批量修改真实 Vault 文件。
- 覆盖旧笔记内容。
- 批量修改真实任务数据。
- 首次连接真实 Vault。
- 运行不可逆脚本。
- 修改任务 md schema。
- 修改 `relations` 结构。
- 修改 `mainlines.json` 结构。
- 大规模重构插件目录。

## 不应做

- 抽取任务时不要编辑旧笔记。
- 不知道目标路径时不要写入真实 Vault。
- 不要跳过 source 追踪。
- 不要编造缺失日期或主线。
- 不要把 sample 数据当作真实用户数据。

## 检查清单

- 目标是 sample-vault，除非用户确认真实 Vault。
- 已识别操作风险等级。
- 已记录来源追踪。
- 真实 Vault 写入前已有备份或 commit。
- 高风险操作已停止等待确认。
- 索引更新与任务 md frontmatter 一致。
