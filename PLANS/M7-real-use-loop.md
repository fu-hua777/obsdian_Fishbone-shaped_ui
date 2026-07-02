# M7 真实使用闭环

## 目标

在真实 Obsidian Vault 中验证 Fishbone Planner 的核心使用闭环，确认当前插件不只通过静态脚本，也能在真实 vault、真实插件安装和 Local REST API 环境下完成任务创建、读取、状态更新和视图刷新。

## 范围

- 校验真实 vault 路径：`E:\主线规划\主线规划`。
- 校验真实插件安装路径：`.obsidian/plugins/obsidian-fishbone-planner`。
- 校验真实插件产物与开发仓库产物一致。
- 通过 Local REST API 验证 Obsidian 可访问、插件命令可见、鱼骨视图刷新命令可执行。
- 在真实 vault 中创建一条 M7 测试任务，确认 frontmatter 符合标准任务格式。
- 将测试任务状态从 `todo` 更新为 `doing`，确认文件与 REST metadata 都能读到更新。
- 保留测试任务作为验收痕迹，不在未确认的情况下删除真实 vault 文件。

## 已发现并修复的问题

- `scripts/validate-m2-skills.js` 在 Windows CRLF 换行下会误判 Skill frontmatter 格式异常。
- 修复方式：读取 `SKILL.md` 后先归一化 CRLF 为 LF，再执行 frontmatter 断言。

## 验收标准

- M2-M6 全量静态验证脚本通过。
- `plugin` 工程 `npm run build` 通过。
- 真实 vault 中的 `main.js` 和 `styles.css` 与开发仓库产物 hash 一致。
- Local REST API 根路径返回 200，插件命令列表包含鱼骨视图打开和刷新命令。
- M7 测试任务存在，且 `status: doing`、`source_type: quick-input`、`mainline: 项目`。
- 真实 vault 中没有因为验证流程误删或覆盖用户已有任务。

## 非目标

- 本阶段不继续新增 UI 功能。
- 本阶段不自动清理真实 vault 中的测试任务。
- 本阶段不把 Local REST API key 写入仓库、日志或文档。
