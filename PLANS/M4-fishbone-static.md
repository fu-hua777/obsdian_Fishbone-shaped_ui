# M4：鱼骨主视图静态版

## 目标

实现 `Fishbone Timeline View` 静态视图，让标准任务数据层可以被渲染为鱼骨时间布局。

M4 只做静态核心视图，不做完整交互版。

## 范围

- 新增鱼骨时间视图。
- 新增布局函数，将任务和主线转换为可渲染结构。
- 显示横向日期轴。
- 显示用户自定义主线泳道。
- `mainline: null` 或未知主线任务显示到 `未分配` 泳道。
- `date: null` 任务显示到 `无日期` 列。
- 显示任务节点的标题、状态、优先级。
- 根据 `relations` 渲染基础虚线关系。
- 支持点击任务节点打开任务 md。

## 不做

- 不实现拖拽。
- 不实现时间尺度缩放。
- 不实现画布整体缩放。
- 不实现完整右侧栏或底部看板。
- 不接入真实旧笔记。
- 不批量写入任务。
- 不创建默认主线。

## 验收命令

```powershell
node scripts/validate-schema.js
node scripts/validate-m2-skills.js
node scripts/validate-m3-plugin.js
node scripts/validate-m4-fishbone.js
cd plugin
npm run typecheck
npm run build
```

## Obsidian 验收

- 命令列表出现 `Fishbone Planner: 打开鱼骨时间视图`。
- 执行命令后 workspace 出现 `fishbone-planner-timeline`。
- 当前空主线样例下显示 `未分配` 泳道和示例任务。
- 不出现健康、学习、事业、生活、财务等默认主线。

## M5 进入条件

- 静态视图可打开。
- 空主线状态可渲染。
- 任务节点可见并能打开任务 md。
- relation 基础线渲染逻辑存在。
- 构建和校验全部通过。
