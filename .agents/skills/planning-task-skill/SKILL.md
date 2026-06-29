---
name: planning-task-skill
description: 将自然语言计划、笔记片段、快速输入和手动任务描述转换为 TaskCandidate 对象与标准规划任务 Markdown。用于从输入中抽取任务、判断日期、主线、优先级、状态、relations、置信度、待确认问题，或为个人 Obsidian 规划系统生成标准任务 md。
---

# Planning Task Skill

## 核心规则

先生成可审阅的任务候选对象，再写入任务文件。除非用户或上游流程已经确认候选任务，或明确要求生成任务 md，否则不要直接写文件。

本 Skill 负责把原始输入转换为：

1. `TaskCandidate` JSON。
2. 标准规划任务 Markdown。仅在候选任务已确认或用户明确要求时生成。

## 输入类型

支持以下输入：

- 单句自然语言。
- 多句自然语言。
- 每日笔记片段。
- 项目笔记片段。
- 学习笔记片段。
- 论文或实验笔记片段。
- 复盘笔记片段。
- 用户手动提供的任务字段。

如果输入来自笔记或文件，必须尽量保留证据字段：`source_type`、`source_file`、`source_excerpt`。

## 输出约定

写入任何任务文件前，先返回如下结构的 JSON：

```json
{
  "tasks": [
    {
      "title": "修复训练脚本 bug",
      "date": "2026-06-28",
      "mainline": "项目",
      "status": "todo",
      "priority": "high",
      "source_type": "nl_input",
      "source_file": "",
      "source_excerpt": "明天上午先修训练脚本 bug，修完后再跑对比实验。",
      "relations": [
        {
          "target": "跑对比实验",
          "type": "前置",
          "direction": "out",
          "label": "完成后才能开始",
          "note": "修复 bug 后才能继续实验。"
        }
      ],
      "confidence": 0.92,
      "review_status": "pending"
    }
  ],
  "questions": [],
  "warnings": []
}
```

只有在用户明确提供了足够信息或确认了解读结果时，才使用 `review_status: confirmed`。其他情况使用 `pending`。

## 任务 Markdown 模板

生成任务 md 时，每个任务使用一个独立文件：

```markdown
---
type: planning-task
task_id: task_YYYYMMDD_001
title: 任务标题
date: YYYY-MM-DD
mainline: 主线名称
status: todo
priority: medium
source_type: nl_input
source_file: ""
source_excerpt: "原始证据片段"
relations:
  - target: "[[目标任务]]"
    type: "前置"
    direction: "out"
    label: "完成后才能开始"
    note: "关系说明"
created: YYYY-MM-DD HH:mm
updated: YYYY-MM-DD HH:mm
review_status: pending
confidence: 0.8
---

# 任务标题

## 任务描述

-

## 完成标准

- [ ]

## 执行记录

-

## 复盘

- 问题原因：
- 解决方式：
- 下次注意：
```

## 主线判断规则

不要写死主线。优先从 `PlanningSystem/Mainlines/mainlines.json` 或用户上下文读取可用主线。

`项目`、`学习`、`论文`、`生活/习惯` 只能作为默认参考，不可作为固定枚举。必须允许用户自定义主线名称、颜色、排序和可见性。

判断依据包括：

- 用户显式说明。
- 文件夹路径。
- 笔记标题。
- frontmatter。
- tags。
- 内容语义。
- 任务动词。
- 关联对象或项目。

如果多个主线都合理，选择最可能的候选，降低置信度，并在 `questions` 中提出确认问题。

如果 `mainlines.json` 或用户上下文中的主线列表为空，不要根据概念图或常见分类猜测主线。此时设置 `mainline: null`，保持 `review_status: pending` 或 `status: inbox`，并在 `questions` 中提示用户先创建主线或确认任务归属。

## 日期判断规则

支持相对日期和明确日期：

- 今天、明天、后天。
- 本周五、下周一、本月底。
- `2026-07-03` 这类明确日期。
- 无明确日期。

相对日期以当前执行日期为基准解析；除非用户明确说明，否则不要用文件创建日期作为基准。如果日期不明确，设置 `date: null`，`review_status: pending`，降低置信度，并在 `questions` 中要求用户补充。

## 优先级规则

使用：

- `high`
- `medium`
- `low`

在以下情况下提高优先级：用户明确说紧急、有明确临近截止时间、阻塞其他任务、属于主线关键任务、与本周重点相关。不要在缺乏证据时虚构紧急程度。

## 状态规则

使用：

- `todo`
- `doing`
- `done`
- `blocked`
- `canceled`
- `inbox`

当任务只是粗略想法或缺少关键字段时，使用 `inbox`。

## Relations 规则

所有任务关系统一使用 `relations` 字段。不要新增 `depends_on`、`blocks`、`relates` 等独立关系字段。

允许的关系类型：

- `普通关联`
- `前置`
- `依赖`
- `阻塞`
- `参考`
- `支撑`
- `影响`

`direction` 使用规则：

- `out`：当前任务指向或影响目标任务。
- `in`：目标任务指向或影响当前任务。
- `both`：双向关系或方向不明确。

示例：

- “修完 bug 后再跑实验” => 修 bug 是跑实验的 `前置`。
- “实验结果后面论文要用” => 实验结果 `支撑` 论文相关任务。
- “作息不好影响学习效率” => 作息管理 `影响` 学习任务。

## 低置信度处理

当 `confidence < 0.7` 时：

- 不要标记为 confirmed。
- 把未解决问题写入 `questions`。
- 保持候选任务可审阅。
- 除非用户明确要求生成草稿文件，否则不要写任务 md。

## 示例

自然语言输入：

1. `明天上午先修训练脚本 bug，修完后再跑对比实验。`
2. `本周五前把 Transformer 笔记整理完，后面写方法章节要用。`
3. `下周一和导师讨论论文实验设计。`
4. `最近作息太乱，先做一周早睡记录。`
5. `把 M2 的 Skills 初稿写出来，完成后更新 DEVLOG。`

笔记抽取输入：

1. 每日笔记：`今天没跑完实验，明天继续补 ablation。`
2. 项目笔记：`插件设置页还缺 mainline 配置。`
3. 学习笔记：`需要复习贝叶斯公式，后面概率课作业要用。`
4. 论文笔记：`实验表 3 还没解释，讨论章节要补。`
5. 复盘笔记：`因为数据清洗没做，训练被阻塞。`

期望输出：

1. 抽取一个或多个带证据的任务候选。
2. 能解析清晰的相对日期。
3. 日期不明确时设置为 `null`。
4. 当语言暗示依赖、支撑、参考、阻塞或影响时，生成 relation 对象。
5. 对缺失日期、主线歧义或优先级不确定的问题写入 `questions`。

## 不应做

- 不要直接写入真实 Vault。
- 抽取任务时不要修改旧笔记。
- 不要写死可用主线。
- 不要编造来源证据。
- 不要创建非 `relations` 的关系字段。
- 不要默默确认低置信度任务。

## 检查清单

- 已先生成候选 JSON，再考虑任务 md。
- 每个抽取任务都有 title、status、priority、confidence、review_status。
- 日期已解析，或明确为 `null`。
- 主线来自上下文，或已标记不确定。
- 关系使用统一 schema。
- `questions` 和 `warnings` 记录了不确定性。
