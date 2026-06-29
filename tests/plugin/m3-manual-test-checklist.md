# M3 手动验证清单

测试 Vault：

```text
E:\主线规划\主线规划
```

插件安装目录：

```text
E:\主线规划\主线规划\.obsidian\plugins\obsidian-fishbone-planner
```

## 前置条件

- `npm run build` 已通过。
- `node scripts/install-m3-plugin.js` 已执行。
- Obsidian 已打开 `主线规划` Vault。
- 社区插件已启用。

## 验证步骤

1. 打开 Obsidian 设置。
2. 进入第三方插件列表。
3. 启用 `Fishbone Planner`。
4. 打开命令面板。
5. 运行 `Fishbone Planner: 打开任务列表`。
6. 确认右侧或当前工作区出现 `Fishbone Planner 任务列表`。
7. 确认能看到示例任务：`通过 UI 创建第一条主线`。
8. 确认主线显示为 `未分配`。
9. 点击 `打开`，确认能打开任务 md。
10. 点击 `切换状态`，确认任务状态发生单文件更新。

## 不应出现

- 不应出现默认主线，如健康、学习、事业、生活、财务。
- 不应扫描或修改 `欢迎.md`。
- 不应出现完整鱼骨 UI；M3 只验证任务列表。
