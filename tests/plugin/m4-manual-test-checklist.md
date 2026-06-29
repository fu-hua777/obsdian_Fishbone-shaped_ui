# M4 手动验证清单

测试 Vault：

```text
E:\主线规划\主线规划
```

## 前置条件

- `node scripts/install-m3-plugin.js` 已执行。
- `npm run build` 已通过。
- `Fishbone Planner` 插件已启用。
- `Local REST API with MCP` 插件已启用。

## 验证步骤

1. 打开命令面板。
2. 运行 `Fishbone Planner: 打开鱼骨时间视图`。
3. 确认出现 `Fishbone Planner 鱼骨时间视图`。
4. 确认能看到横向日期轴。
5. 确认当前空主线状态下显示 `未分配` 泳道。
6. 确认能看到示例任务 `通过 UI 创建第一条主线`。
7. 点击任务节点，确认能打开任务 md。

## 不应出现

- 不应出现默认主线：健康、学习、事业、生活、财务。
- 不应出现拖拽、缩放等 M5 交互。
- 不应扫描或修改 `欢迎.md`。
