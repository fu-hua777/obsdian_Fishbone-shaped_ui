# obsdian_Fishbone-shaped_ui

适用于obsidian的个人鱼骨型规划设计插件

## 项目定位

这是一个基于 Obsidian、Codex、自定义插件和 Codex Skills 的个人主线规划系统开发仓库。

核心链路：

```text
原始输入 -> 任务标准化 -> 标准任务 md -> 鱼骨主视图 -> 辅助模块联动
```

当前重点：

- 固化 Codex Skills。
- 建立标准任务数据层。
- 在 `sample-vault` 中验证 schema、任务文件和索引。
- 校验默认无主线、由用户通过 UI 创建主线的规则。

当前不做：

- 不开发完整插件 UI。
- 不接入真实 Vault。
- 不批量扫描或修改旧笔记。

## 当前命令

```powershell
node scripts/validate-schema.js
node scripts/validate-m2-skills.js
node scripts/validate-m3-plugin.js
node scripts/validate-m4-fishbone.js
node scripts/validate-m5-interaction.js
node scripts/validate-m5-1-timeline-layout.js
```
