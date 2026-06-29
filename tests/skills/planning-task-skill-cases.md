# planning-task-skill 测试样例

## 用例 1：自然语言拆分与前置关系

输入：

```text
明天上午先修训练脚本 bug，修完后再跑对比实验，实验结果后面论文要用。
```

期望：

```json
{
  "tasks": [
    {
      "title": "修复训练脚本 bug",
      "date": "明天对应的日期",
      "mainline": null,
      "status": "todo",
      "priority": "high",
      "relations": [
        {
          "target": "跑对比实验",
          "type": "前置",
          "direction": "out"
        }
      ],
      "review_status": "pending"
    },
    {
      "title": "跑对比实验",
      "date": "明天对应的日期",
      "mainline": null,
      "status": "todo",
      "priority": "medium",
      "relations": [
        {
          "target": "整理实验结果用于论文",
          "type": "支撑",
          "direction": "out"
        }
      ],
      "review_status": "pending"
    }
  ],
  "questions": [
    "当前没有可用主线，请先创建主线或确认这些任务的主线归属。"
  ],
  "warnings": []
}
```

## 用例 2：笔记抽取与 source 追踪

输入：

```text
source_file: Projects/plugin-log.md
excerpt: 插件设置页还缺 mainline 配置，本周五前要补上，否则鱼骨视图没法按用户主线渲染。
```

期望：

```json
{
  "tasks": [
    {
      "title": "补齐插件设置页 mainline 配置",
      "date": "本周五对应的日期",
      "mainline": null,
      "priority": "high",
      "source_type": "project_note",
      "source_file": "Projects/plugin-log.md",
      "source_excerpt": "插件设置页还缺 mainline 配置，本周五前要补上，否则鱼骨视图没法按用户主线渲染。",
      "relations": [
        {
          "target": "鱼骨视图按用户主线渲染",
          "type": "前置",
          "direction": "out"
        }
      ]
    }
  ],
  "questions": [
    "当前没有可用主线，请确认该任务归属，或先创建对应主线。"
  ]
}
```

## 用例 3：低置信度日期

输入：

```text
找时间整理概率论错题。
```

期望：

```json
{
  "tasks": [
    {
      "title": "整理概率论错题",
      "date": null,
      "mainline": null,
      "status": "todo",
      "priority": "medium",
      "confidence": 0.65,
      "review_status": "pending"
    }
  ],
  "questions": [
    "请确认整理概率论错题的日期或截止时间。",
    "当前没有可用主线，请确认该任务归属，或先创建对应主线。"
  ],
  "warnings": []
}
```

## 用例 4：不写死主线

输入上下文：

```json
{
  "mainlines": [
    {"id": "health", "name": "健康", "order": 1},
    {"id": "research", "name": "科研", "order": 2}
  ]
}
```

输入：

```text
今晚记录睡眠时间，观察早睡对第二天学习效率的影响。
```

期望：使用 `健康` 作为主线，不要写死为 `生活/习惯`；如果学习效率被表示为相关任务，则添加 `影响` relation。
