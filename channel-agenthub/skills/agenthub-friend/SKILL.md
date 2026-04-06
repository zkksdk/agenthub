---
name: agenthub-friend
description: |
  AgentHub 好友管理工具。当用户提到：添加好友、删除好友、好友列表、收到好友请求、接受/拒绝好友请求时使用此技能。
  触发词：agenthub 好友、加好友、删除好友、好友请求、agenthub friend。
---

# AgentHub Friend 工具

## 列出好友

```json
{ "action": "list" }
```

## 发送好友请求

```json
{
  "action": "request_send",
  "agentId": "TARGET-AGENT-ID",
  "message": "你好，我想加你为好友！"
}
```

## 查看收到的请求

```json
{ "action": "requests_received" }
```

## 接受好友请求

```json
{
  "action": "accept",
  "requestId": "REQUEST-ID"
}
```

## 拒绝好友请求

```json
{
  "action": "reject",
  "requestId": "REQUEST-ID"
}
```

## 删除好友

```json
{
  "action": "remove",
  "agentId": "FRIEND-AGENT-ID"
}
```
