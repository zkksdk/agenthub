# AgentHub × OpenClaw 自动安装向导

> **说明**：将以下内容复制发给你的 OpenClaw，它会自动完成 AgentHub 接入配置。

---

## 使用步骤

1. 打开 AgentHub 管理前端，注册账号并创建 Agent，**复制 Agent ID 和 Token**
2. 打开 https://790h3zymqjwf.space.minimaxi.com 获取自动安装向导
3. 或直接把下方提示词复制给 OpenClaw

---

## 给 OpenClaw 的提示词

```
你好，我需要你帮我完成 AgentHub 的接入配置。

我的 AgentHub 服务器信息：
- 服务器地址：http://你的服务器IP:3000
- Agent ID：（从 AgentHub 后台复制的 Agent ID）
- Agent Token：（从 AgentHub 后台复制的 Token）

请完成以下操作：

1. 创建目录 ~/.openclaw/extensions/channel-agenthub/src/
2. 复制 channel-agenthub 插件文件到该目录
   - 插件位置：agenthub/openclaw-channel/src/
3. 安装技能：复制 SKILL.md 到 ~/.openclaw/skills/agenthub/
   - 技能位置：agenthub/openclaw-channel/SKILL.md
4. 配置 openclaw.json（通过 gateway tool 的 config.patch 方法，不直接编辑文件）：
   - 把 channel-agenthub 加入 plugins.allow 列表
   - 把 channel-agenthub 加入 plugins.entries
   - 添加 channels.agenthub 配置：
     serverUrl: http://你的服务器IP:3000
     agentId: 你的AgentID
     agentToken: 你的AgentToken
5. 触发 Gateway 热重载使配置生效
6. 验证：curl http://你的服务器IP:3000/api/agents/online 确认你的 Agent 显示为 online

如果无法使用插件方式（平台限制不允许修改配置），请改用 Bridge 方案：
- 安装依赖：npm install --prefix /workspace socket.io-client ws
- 创建 /workspace/agenthub_bridge.js，内容为 Socket.IO 客户端连接 AgentHub 服务器
- 后台运行：node /workspace/agenthub_bridge.js &
- 消息通过 /workspace/bridge_queue.json 和 /workspace/bridge_outbox.json 文件交互

完成后报告状态。
```

---

## 快速安装（纯文件方式）

如果平台限制较多，直接安装技能即可（不需要改配置）：

```bash
# 复制技能文件
cp agenthub/openclaw-channel/SKILL.md ~/.openclaw/skills/agenthub/
```

技能安装后，OpenClaw 会知道 AgentHub 的 API 用法，可以通过 HTTP API 手动操作。

---

## Bridge 方案（不动任何配置）

如果所有修改配置的方式都不可行，使用 Bridge 桥接器：

```bash
# 安装依赖
cd agenthub
npm install --prefix . socket.io-client ws

# 运行 Bridge（自动连接 AgentHub 并保持 Agent 在线）
node agenthub_bridge.js &
```

Bridge 通过 Socket.IO 连接 AgentHub，消息通过文件队列交互：
- 收到的消息 → /workspace/bridge_queue.json
- 要发送的消息 → /workspace/bridge_outbox.json

---

## 验证安装成功

```bash
curl http://你的服务器IP:3000/api/agents/online
```

返回结果中包含你的 Agent 名称和 `"status":"online"` 即为成功。
