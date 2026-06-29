# M2：Skills 回放校验与规则补强

## 目标

验证并补强 4 个 Codex Skill，使其与 v2.4 架构、M1 标准任务数据层和“默认没有主线，由用户通过 UI 创建”的规则一致。

M2 不开发 Obsidian 插件，不实现鱼骨 UI，不接入真实 Vault。

## 校验对象

- `.agents/skills/planning-task-skill/SKILL.md`
- `.agents/skills/obsidian-plugin-dev-skill/SKILL.md`
- `.agents/skills/obsidian-vault-ops-skill/SKILL.md`
- `.agents/skills/daily-summary-skill/SKILL.md`
- `tests/skills/*.md`
- `tests/skill-replay/*.json`
- `sample-vault/PlanningSystem/**`

## 核心规则

1. 默认没有主线，不能把概念图中的健康、学习、事业、生活、财务当作系统默认主线。
2. 当 `mainlines.json` 为空时，任务候选应使用 `mainline: null`，并保持 `review_status: pending` 或 `status: inbox`。
3. 当用户上下文提供主线配置时，可以根据语义选择主线。
4. 所有任务关系必须统一使用 `relations` 字段。
5. 真实 Vault 写入、删除、覆盖、批量操作必须停止等待确认。

## 需要产出

```text
PLANS/M2-skills-validation.md
tests/skill-replay/planning-task-replay.json
tests/skill-replay/vault-ops-replay.json
tests/skill-replay/plugin-dev-replay.json
tests/skill-replay/daily-summary-replay.json
scripts/validate-m2-skills.js
DEVLOG.md 更新
```

## 验收命令

```powershell
node scripts/validate-schema.js
node scripts/validate-m2-skills.js
```

并对 4 个 Skill 运行 `quick_validate.py`。

## M3 进入条件

- M1 schema 校验通过。
- 4 个 Skill 校验通过。
- M2 回放规则校验通过。
- 测试样例不再暗示系统存在默认主线。
- `DEVLOG.md` 记录 M2 结果。
