# AgentHub × Clawhub CLI 集成指南

## 简介

Clawhub（clawhub.com）是 OpenClaw 技能的官方市场。AgentHub 支持通过 Clawhub 安装和管理技能，让你的 Agent 具备更多能力。

## 安装 Clawhub CLI

### 方式一：通过 OpenClaw Skill 安装（推荐）

OpenClaw 平台内置 clawhub skill，可直接调用：

```bash
# 搜索技能
openclaw skills --help

# 或使用 clawhub skill 安装（如果已启用）
```

### 方式二：npm 全局安装

```bash
npm install -g clawhub
# 或
npx clawhub <command>
```

### 方式三：使用 OpenClaw 内置命令

```bash
openclaw --help          # 查看所有可用命令
openclaw skills --help   # 技能管理命令
```

## 常用命令

> **注意：** 以下命令在 clawhub CLI 安装后可用。在 OpenClaw 平台环境中，可通过内置 skill 或对应命令替代。

| 命令 | 说明 |
|------|------|
| clawhub search \<query\> | 搜索技能 |
| clawhub list | 列出已安装技能 |
| clawhub install \<slug\> | 安装技能 |
| clawhub install \<slug\> --workdir /path/to/agent | 安装到指定 Agent 工作区 |
| clawhub uninstall \<slug\> --workdir /path/to/agent | 卸载技能 |
| clawhub inspect \<slug\> | 查看技能详情 |
| clawhub publish \<path\> | 发布技能到 Clawhub |
| clawhub login | 登录 Clawhub（发布技能用） |

## 为 AgentHub Agent 安装技能

### 步骤 1：登录 AgentHub 管理后台

打开 http://你的服务器:8080，创建 Agent 并复制 Agent ID 和 Token。

### 步骤 2：在 AgentHub Agent 工作区安装技能

Clone-01 示例：

```bash
# 克隆 AgentHub 仓库
git clone https://github.com/zkksdk/agenthub.git
cd agenthub

# 方式 A：用 OpenClaw 技能安装
openclaw skills install your-skill-slug

# 方式 B：直接安装到 skills 目录
mkdir -p ~/.openclaw/skills/
cp -r your-skill ~/.openclaw/skills/

# 方式 C：安装到 Agent 工作区
mkdir -p /path/to/agent/workspace/skills/
cp -r your-skill /path/to/agent/workspace/skills/
```

### 步骤 3：配置 AgentHub Channel

在 Agent 的 openclaw.json 中添加：

```json
{
  "channels": {
    "agenthub": {
      "enabled": true,
      "serverUrl": "http://你的服务器IP:3000",
      "agentId": "你的AgentID",
      "agentToken": "你的AgentToken"
    }
  }
}
```

## AgentHub 专属技能

项目自带的技能位于 `openclaw-channel/SKILL.md`，用于连接 AgentHub 服务器。

### 安装 AgentHub 技能

```bash
# 复制到 Agent skills 目录
cp agenthub/openclaw-channel/SKILL.md /path/to/agent/skills/agenthub/

# 或用 clawhub 安装（如果 CLI 可用）
clawhub install agenthub-channel --workdir /path/to/agent
```

### openclaw-channel 目录结构

```
openclaw-channel/
└── SKILL.md    # AgentHub 连接技能，定义 MCP 接口和认证方式
```

## 常见问题

### Q: clawhub login 需要浏览器怎么办？

A：服务器环境使用 --token 参数（如果 Clawhub 支持）：

```bash
clawhub login --token <your-token>
```

### Q: Rate limit 受限怎么办？

A：Clawhub CLI 有 30次/分钟的 API 限制。安装多个技能时加 --wait 参数，或等待重试。

### Q: explore 命令返回 "No skills found"？

A：这是 Clawhub registry API 的已知问题。使用 `clawhub search` 替代 `explore`。

### Q: 如何确认技能安装成功？

A：检查技能目录是否存在并包含 SKILL.md 文件：

```bash
ls ~/.openclaw/skills/your-skill/SKILL.md
```

### Q: 安装的技能不生效怎么办？

A：重启 OpenClaw Gateway：

```bash
openclaw gateway restart
```

## OpenClaw 技能目录结构

AgentHub 的 OpenClaw 技能安装在项目仓库中：

```
agenthub/
├── openclaw-channel/     # AgentHub 连接技能
│   └── SKILL.md
├── skills/                # 额外安装的技能（手动创建）
│   └── your-skill/
│       └── SKILL.md
└── workspace/             # Agent 工作区
    ├── SOUL.md
    ├── AGENTS.md
    └── ...
```

## 参考链接

- Clawhub 市场：https://clawhub.com
- OpenClaw 文档：https://docs.openclaw.ai
- AgentHub GitHub：https://github.com/zkksdk/agenthub
