# Codex 工作流与 Skills 初稿指南

> 本文件用于交给 Codex 阅读，指导它先自行生成 Skills 初稿。  
> 目标：让 Codex 基于已确认的 v2.4 架构，先完成一组可修改、可迭代的 Skills 草案，而不是直接开发完整 Obsidian 插件。  
> 重要原则：先规划，再执行；先 sample-vault，再真实 Vault；先 Skills 初稿，再插件主逻辑。  

---

## 0. 给 Codex 的总指令

Codex 需要先阅读：

```text
个人规划系统_v2.4_架构说明.md
Codex_工作流与Skills初稿指南.md
```

然后完成以下目标：

```text
1. 理解 v2.4 架构。
2. 不要直接开发完整插件。
3. 不要操作真实 Obsidian Vault。
4. 先创建 Skills 初稿。
5. 为每个 Skill 准备测试样例。
6. 写出后续如何验证和修改这些 Skills。
7. 完成后停止，等待用户确认。
```

---

# 1. 推荐 Codex 使用方式

本项目推荐组合使用：

```text
/plan
/goal
AGENTS.md
Skills
Git / Worktree
DEVLOG.md
测试脚本
人工检查点
```

## 1.1 /plan 的用途

每个复杂阶段开始前，先使用 `/plan`。

用途：

```text
- 读取当前仓库结构
- 理解目标
- 拆分任务
- 判断需要新增或修改的文件
- 设计测试方法
- 标出风险点
- 提出需要用户确认的问题
```

使用原则：

```text
只规划，不写代码。
```

## 1.2 /goal 的用途

当计划清楚后，使用 `/goal` 执行一个明确里程碑。

用途：

```text
- 自动创建文件
- 自动写初稿
- 自动补充测试样例
- 自动运行校验
- 自动记录 DEVLOG.md
- 完成后停止等待用户确认
```

使用原则：

```text
一个 goal 只做一个明确里程碑。
不要用一个 goal 完成整个系统。
```

## 1.3 AGENTS.md 的用途

`AGENTS.md` 用作 Codex 的长期项目规则。

它应该规定：

```text
- 项目目标
- 目录结构
- 哪些文件可修改
- 哪些文件禁止修改
- 构建与测试命令
- 数据安全规则
- 每次完成后的汇报格式
- 什么时候必须停止等待用户确认
```

## 1.4 Skills 的用途

Skills 用于封装可复用工作流。

本项目中，Skills 主要负责：

```text
- 任务理解
- 任务标准化
- Obsidian 插件开发规范
- Vault 文件操作规则
- 每日总结生成
```

## 1.5 Git / Worktree 的用途

所有开发建议放入 Git 仓库。

建议每个里程碑一个分支或 worktree：

```text
feature/m1-task-schema
feature/m2-skills-draft
feature/m3-plugin-minimal
feature/m4-fishbone-view
```

要求：

```text
- 真实 Vault 操作前必须 commit 或备份。
- 批量写入前必须有可回滚点。
- 每个里程碑结束后写 DEVLOG.md。
```

---

# 2. 本阶段目标：先写 Skills 初稿

## 2.1 本阶段只做什么

当前阶段只完成：

```text
Skills 初稿
Skills 测试样例
Skills 使用说明
后续迭代建议
```

## 2.2 本阶段不做什么

当前阶段不要做：

```text
- 不开发完整 Obsidian 插件
- 不写完整鱼骨主视图
- 不接入真实 Vault
- 不批量扫描用户真实笔记
- 不修改用户真实旧笔记
- 不决定最终 UI 细节
```

---

# 3. 本阶段需要创建的 Skills

建议创建 4 个 Skill 初稿：

```text
.agents/skills/planning-task-skill/SKILL.md
.agents/skills/obsidian-plugin-dev-skill/SKILL.md
.agents/skills/obsidian-vault-ops-skill/SKILL.md
.agents/skills/daily-summary-skill/SKILL.md
```

如果当前 Codex 环境使用其他 Skills 路径，可以根据实际项目约定调整，但必须保持目录清晰、每个 Skill 单独成目录。

---

# 4. Skill 1：planning-task-skill

## 4.1 目标

`planning-task-skill` 是最核心的 Skill。

它负责将：

```text
自然语言输入
已有笔记内容
手动任务描述
```

转换为：

```text
标准 TaskCandidate
标准任务 md
```

## 4.2 触发场景

当用户要求以下操作时，应使用该 Skill：

```text
- 从自然语言生成任务
- 从已有笔记中抽取任务
- 把零散计划整理成任务
- 判断任务属于哪条主线
- 判断任务日期
- 判断任务优先级
- 判断任务之间的 relation
- 生成统一任务 md 文件
```

## 4.3 输入类型

支持：

```text
1. 单句自然语言
2. 多句自然语言
3. 今日笔记片段
4. 项目记录片段
5. 学习笔记片段
6. 论文笔记片段
7. 复盘记录片段
8. 用户手动给定的任务信息
```

## 4.4 输出对象：TaskCandidate

Skill 应先生成 TaskCandidate，而不是直接写文件。

建议结构：

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

## 4.5 mainline 判断规则

主线数量不固定，应从 `mainlines.json` 或用户上下文读取。

不要写死为：

```text
项目 / 学习 / 论文 / 生活
```

默认可以参考这四类，但必须允许扩展。

判断依据：

```text
- 用户显式指定
- 文件夹路径
- 笔记标题
- frontmatter
- tags
- 内容语义
- 任务动词
- 关联对象
```

## 4.6 日期判断规则

支持：

```text
今天
明天
后天
本周五
下周一
本月底
某个明确日期
无明确日期
```

如果日期不明确：

```text
date = null
review_status = pending
questions 中提示用户补充日期
```

## 4.7 priority 判断规则

优先级建议：

```text
high
medium
low
```

判断依据：

```text
- 用户显式说“优先级高”
- 是否有截止日期
- 是否阻塞其他任务
- 是否是主线关键任务
- 是否与本周重点相关
```

## 4.8 relations 判断规则

统一使用 `relations` 字段。

类型包括：

```text
普通关联
前置
依赖
阻塞
参考
支撑
影响
```

判断示例：

```text
“修完 bug 后再跑实验”
=> 修 bug 是跑实验的前置

“实验结果后面论文要用”
=> 实验结果支撑论文相关任务

“作息不好影响学习效率”
=> 作息管理影响学习任务
```

## 4.9 低置信度处理

如果不确定：

```text
- 不要强行确认
- review_status 设为 pending
- confidence 低于 0.7 时必须要求用户确认
- 把问题写入 questions
```

## 4.10 planning-task-skill 初稿必须包含的内容

`SKILL.md` 初稿应包括：

```text
- Skill 名称
- 何时使用
- 输入类型
- 输出格式
- TaskCandidate schema
- task md 模板
- mainline 判断规则
- date 判断规则
- priority 判断规则
- relations 判断规则
- 低置信度处理规则
- 5 个自然语言输入样例
- 5 个已有笔记抽取样例
- 5 个期望输出样例
- 不应做的事情
```

---

# 5. Skill 2：obsidian-plugin-dev-skill

## 5.1 目标

该 Skill 用于指导 Codex 开发自定义 Obsidian 插件。

## 5.2 触发场景

当用户要求：

```text
- 开发 Obsidian 插件
- 修改插件 UI
- 添加 Fishbone Timeline View
- 添加任务读写逻辑
- 添加设置页
- 修复插件构建错误
- 调整 styles.css
```

应使用该 Skill。

## 5.3 插件开发原则

```text
- 主视图必须自定义实现。
- 任务数据必须来自标准任务 md / task-index。
- 不让现成插件反向定义核心数据结构。
- 插件修改后必须构建。
- 涉及文件写入必须保护用户数据。
- 先在 sample-vault 测试。
```

## 5.4 插件模块建议

```text
PlanningPlugin
├─ TaskIntake
├─ TaskData
├─ FishboneView
├─ DashboardModules
└─ Settings
```

更细模块：

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

## 5.5 构建与测试要求

初稿中应要求 Codex：

```text
- 修改 TypeScript 后运行 npm run build
- 修改 schema 后运行 schema 校验
- 修改任务生成逻辑后运行 task-normalizer 测试
- 修改 UI 后生成测试说明或截图
- 每次完成后更新 DEVLOG.md
```

## 5.6 obsidian-plugin-dev-skill 初稿必须包含

```text
- Skill 名称
- 何时使用
- 插件架构约束
- 文件目录建议
- build/test 命令占位
- Obsidian Vault 数据安全规则
- Fishbone View 开发原则
- UI 风格约束
- 不应做的事情
- 检查清单
```

---

# 6. Skill 3：obsidian-vault-ops-skill

## 6.1 目标

该 Skill 用于管理 Obsidian Vault 文件操作，确保 Codex 不误改用户数据。

## 6.2 触发场景

当用户要求：

```text
- 扫描 Vault
- 从已有笔记提取任务
- 写入标准任务 md
- 更新 task-index
- 迁移任务文件
- 修改 mainlines.json
- 生成每日总结文件
- 批量处理文件
```

应使用该 Skill。

## 6.3 文件操作原则

```text
- 默认不修改原始旧笔记。
- 从旧笔记提取任务时，生成新任务 md。
- 必须记录 source_file、source_excerpt。
- 真实 Vault 批量操作前必须备份或 Git commit。
- 删除、批量改名、覆盖文件前必须停止等待用户确认。
- 所有测试先在 sample-vault 中进行。
```

## 6.4 写入规则

标准任务写入：

```text
PlanningSystem/Tasks/YYYY/MM/YYYY-MM-DD_主线_任务标题.md
```

索引写入：

```text
PlanningSystem/Index/task-index.json
```

主线配置：

```text
PlanningSystem/Mainlines/mainlines.json
```

每日总结：

```text
PlanningSystem/DailyReports/YYYY-MM-DD_每日总结.md
```

## 6.5 obsidian-vault-ops-skill 初稿必须包含

```text
- Skill 名称
- 何时使用
- Vault 安全规则
- sample-vault 优先规则
- 标准目录结构
- 任务文件命名规则
- source 追踪规则
- task-index 更新规则
- 备份 / 回滚规则
- 高风险操作停止清单
```

---

# 7. Skill 4：daily-summary-skill

## 7.1 目标

该 Skill 用于根据当天内容生成每日总结。

## 7.2 输入来源

```text
- 当天完成任务
- 当天新增任务
- 当天进行中任务
- 快速笔记
- 当天上传 / 修改内容
- 今日笔记
- 项目记录
- 学习记录
- 论文记录
```

## 7.3 输出文件

```text
PlanningSystem/DailyReports/YYYY-MM-DD_每日总结.md
```

## 7.4 每日总结结构

建议结构：

```markdown
# YYYY-MM-DD 每日总结

## 1. 今日概览

## 2. 今日完成

## 3. 今日推进中的任务

## 4. 今日遇到的问题

## 5. 新增任务与想法

## 6. 各主线进展

## 7. relation 变化

## 8. 明日建议

## 9. 需要用户确认的事项
```

## 7.5 daily-summary-skill 初稿必须包含

```text
- Skill 名称
- 何时使用
- 输入来源
- 输出模板
- 主线进展归纳规则
- 未完成任务处理规则
- 明日建议生成规则
- 不确定内容处理规则
- 5 个测试样例
```

---

# 8. 建议的项目目录结构

Codex 可按以下结构创建或调整项目：

```text
obsidian-mainline-planner/
├─ AGENTS.md
├─ DEVLOG.md
├─ README.md
│
├─ docs/
│  ├─ 个人规划系统_v2.4_架构说明.md
│  └─ Codex_工作流与Skills初稿指南.md
│
├─ PLANS/
│  ├─ M1-task-schema.md
│  ├─ M2-skills-draft.md
│  ├─ M3-plugin-minimal.md
│  └─ M4-fishbone-view.md
│
├─ .agents/
│  └─ skills/
│     ├─ planning-task-skill/
│     │  └─ SKILL.md
│     ├─ obsidian-plugin-dev-skill/
│     │  └─ SKILL.md
│     ├─ obsidian-vault-ops-skill/
│     │  └─ SKILL.md
│     └─ daily-summary-skill/
│        └─ SKILL.md
│
├─ plugin/
│  ├─ manifest.json
│  ├─ package.json
│  ├─ src/
│  └─ styles.css
│
├─ sample-vault/
│  └─ PlanningSystem/
│
├─ tests/
│  ├─ skills/
│  ├─ schema/
│  ├─ task-normalizer/
│  └─ plugin/
│
└─ scripts/
   ├─ validate-schema.ts
   ├─ test-planning-skill.ts
   └─ create-sample-tasks.ts
```

如果实际项目已有目录，Codex 应先读取并适配现有结构，不要强行重构。

---

# 9. 本阶段建议执行流程

## 9.1 第一步：先规划

交给 Codex 的推荐提示：

```text
/plan
请先阅读以下文件：
- docs/个人规划系统_v2.4_架构说明.md
- docs/Codex_工作流与Skills初稿指南.md

目标：为本项目创建 Skills 初稿。

限制：
- 不要开发完整 Obsidian 插件。
- 不要操作真实 Obsidian Vault。
- 不要修改用户旧笔记。
- 只设计 Skills 初稿、测试样例和后续校验方式。

请输出：
1. 你理解的系统架构摘要；
2. 需要创建的 Skills 列表；
3. 每个 Skill 的职责边界；
4. 需要创建或修改的文件；
5. 测试样例设计；
6. 风险点；
7. 需要用户确认的问题。

输出计划后停止，等待确认。
```

## 9.2 第二步：执行 Skills 初稿

确认计划后，使用：

```text
/goal 完成 M2：Skills 初稿。
请基于 docs/个人规划系统_v2.4_架构说明.md 和 docs/Codex_工作流与Skills初稿指南.md 执行。

完成标准：
- 创建 .agents/skills/planning-task-skill/SKILL.md
- 创建 .agents/skills/obsidian-plugin-dev-skill/SKILL.md
- 创建 .agents/skills/obsidian-vault-ops-skill/SKILL.md
- 创建 .agents/skills/daily-summary-skill/SKILL.md
- 每个 Skill 都包含：何时使用、输入、输出、规则、示例、不应做的事情、检查清单
- 创建 tests/skills/ 下的测试输入输出样例
- 创建或更新 DEVLOG.md
- 输出本次完成内容、文件变更、测试结果、风险点和下一步建议

限制：
- 不开发插件主视图
- 不连接真实 Vault
- 不批量扫描旧笔记
- 完成后停止等待用户确认
```

---

# 10. Skills 初稿完成标准

Codex 完成 Skills 初稿时，必须满足：

```text
1. 每个 Skill 都有独立目录。
2. 每个 Skill 都有 SKILL.md。
3. 每个 SKILL.md 都说明何时使用和不应做什么。
4. planning-task-skill 必须包含 TaskCandidate schema。
5. planning-task-skill 必须包含 relations 规则。
6. obsidian-plugin-dev-skill 必须包含插件开发边界。
7. obsidian-vault-ops-skill 必须包含数据安全和备份规则。
8. daily-summary-skill 必须包含每日总结模板。
9. 必须有测试样例。
10. 必须更新 DEVLOG.md。
11. 必须停止等待用户确认。
```

---

# 11. Codex 每次汇报格式

每个阶段结束后，Codex 应输出：

```text
## 本次完成内容

## 文件变更清单

## 测试与校验结果

## 当前风险

## 需要用户确认的问题

## 下一步建议
```

如果出现不确定问题，Codex 应停止并询问，不要自行扩大范围。

---

# 12. 高风险操作停止清单

Codex 遇到以下操作必须停止，等待用户确认：

```text
- 删除文件
- 批量重命名文件
- 批量修改真实 Vault 文件
- 覆盖旧笔记内容
- 修改真实任务数据
- 接入真实 Vault
- 执行不可逆脚本
- 改变核心任务 schema
- 改变 relations 字段结构
- 改变 mainlines 配置格式
- 大规模重构插件目录
```

---

# 13. 本阶段验收方式

用户验收 Skills 初稿时，主要看：

```text
1. planning-task-skill 是否能正确表达任务理解规则；
2. relations 是否统一且灵活；
3. mainline 是否没有被写死；
4. vault 操作是否足够安全；
5. 插件开发 Skill 是否没有跑去直接开发完整插件；
6. daily-summary-skill 是否能输出有用的每日总结结构；
7. 测试样例是否覆盖自然语言输入、已有文件抽取、关系判断、低置信度处理。
```

---

# 14. 给 Codex 的最终提醒

当前阶段的目标不是“一步到位完成系统”，而是：

```text
先把 Codex 以后如何理解任务、如何写任务 md、如何保护 Vault、如何开发插件、如何生成每日总结的规则固定下来。
```

所以本阶段只需要完成：

```text
Skills 初稿 + 示例 + 测试样例 + DEVLOG.md
```

完成后停止，等待用户修改和确认。
