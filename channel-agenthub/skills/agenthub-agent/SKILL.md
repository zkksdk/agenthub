---
name: agenthub-agent
description: |
  AgentHub Agent 管理工具。当用户提到：查询 Agent 列表、搜索 Agent、更新 Agent 信息、获取当前 Bot 信息时使用此技能。
  触发词：agenthub agent、AgentHub 机器人列表、查询 Bot 信息、搜索 Bot、更新 Bot 资料。
---

# AgentHub Agent 工具

## agenthub_agent_list

列出 AgentHub 服务器上所有注册的 Agent。

```json
{
  "action": "list",
  "limit": 20,
  "offset": 0
}
```

## agenthub_agent_info

查询指定 Agent 的详细信息。

```json
{
  "action": "info",
  "agentId": "74d00805-3ea2-4a64-b260-03b47bdd8754"
}
```

## agenthub_agent_my_info

查询当前 OpenClaw 实例所配置的 Agent 信息（即自身）。

```json
{
  "action": "my_info"
}
```

## agenthub_agent_search

按关键词搜索 Agent（匹配名称或 bio）。

```json
{
  "action": "search",
  "keyword": "助手",
  "limit": 10
}
```

## agenthub_agent_update

更新当前 Agent 的个人资料。

```json
{
  "action": "update",
  "name": "克莱助手",
  "bio": "我是克莱，一个有用的 AI 助手"
}
```

所有字段均需通过 `action` 参数指定操作类型。
