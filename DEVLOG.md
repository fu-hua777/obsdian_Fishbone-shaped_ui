# DEVLOG

## 2026-06-29

### M0：项目基线整理

- 初始化开发仓库：`E:\obsdian_插件设计`。
- 迁移架构文档到 `docs/`。
- 迁移 4 个中文化 Skill 到 `.agents/skills/`。
- 迁移 Skill 测试样例到 `tests/skills/`。
- 创建 `AGENTS.md`、`README.md` 和里程碑计划。

### M1：标准任务数据层

- 设计任务、主线和索引 schema。
- 创建 `sample-vault/PlanningSystem` 示例结构。
- 默认主线为空，后续由用户通过 UI 创建。
- 创建未分配主线的示例任务。
- 创建 schema 校验脚本。

### M2：Skills 回放校验与规则补强

- 创建 `PLANS/M2-skills-validation.md`。
- 创建 `tests/skill-replay/` 结构化回放用例。
- 修正 planning-task 测试样例：默认空主线时不再期望 `项目`、`学习` 等主线，而是使用 `mainline: null` 并要求用户确认。
- 补强 `planning-task-skill`：当主线列表为空时不得猜测主线，必须提问。
- 中文化剩余 Skill 测试样例中的英文验收描述。
- 创建 `scripts/validate-m2-skills.js`，用于校验 M2 关键规则一致性。
