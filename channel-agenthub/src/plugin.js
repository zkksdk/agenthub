/**
 * @file plugin.js
 * AgentHub ChannelPlugin 定义
 * 架构参考: feishu channel plugin
 * 核心接口: ChannelPlugin<TResolvedAccount>
 *
 * 注意: 此文件由 OpenClaw 插件系统加载。
 *       所有 channel plugin 类型（ChannelConfigAdapter 等）由 openclaw 核心提供，
 *       在运行时通过 ../../core-BghMcc08.js 导入。
 *       JSDoc @type 注解仅供 IDE 类型提示，不影响运行时行为。
 */

const CHANNEL_ID = "agenthub";

// ─── 统一 API 请求 ────────────────────────────────────────────────────────────
/**
 * @param {{ accountId:string, config:import('./types').AgentHubAccountConfig }} account
 * @param {string} path
 * @param {'GET'|'POST'|'PATCH'|'DELETE'} [method='GET']
 * @param {Record<string,unknown>|undefined} [body]
 * @returns {Promise<{ok:boolean, data?:unknown, error?:string}>}
 */
export async function agentHubApiRequest(account, path, method = "GET", body) {
  const url = `${account.config.serverUrl}${path}`;

  /** @type {Record<string,string>} */
  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${account.config.agentToken}`,
  };
  if (account.config.apiKey) headers["X-Api-Key"] = account.config.apiKey;

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, error: `HTTP ${res.status}: ${text}` };
    }

    const data = await res.json().catch(() => ({}));
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

// ─── Config Adapter ───────────────────────────────────────────────────────────
/** @type {any} — ChannelConfigAdapter */
const configAdapter = {
  /** @param {any} cfg @param {string} [accountId] */
  async resolveAccount(cfg, accountId) {
    const accounts = cfg?.channels?.agenthub?.accounts ?? {};
    const id = accountId ?? Object.keys(accounts)[0] ?? "main";
    const raw = accounts[id];
    if (!raw) return null;

    return {
      accountId: id,
      config: {
        serverUrl: raw.serverUrl ?? "",
        agentId: raw.agentId ?? "",
        agentToken: raw.agentToken ?? "",
        apiKey: raw.apiKey,
        webhookPath: raw.webhookPath ?? "/gateway/agenthub/webhook",
        pollIntervalMs: raw.pollIntervalMs ?? 5000,
      },
    };
  },

  async writeAccount() { return { ok: true }; },
  async deleteAccount() { return { ok: true }; },

  /** @param {any} cfg */
  async listAccounts(cfg) {
    return Object.keys(cfg?.channels?.agenthub?.accounts ?? {});
  },
};

// ─── Session Key Builder ──────────────────────────────────────────────────────
/**
 * @param {string} channel
 * @param {string} accountId
 * @param {string} kind  'direct' | 'group'
 * @param {string} id
 */
function buildSessionKey(channel, accountId, kind, id) {
  return `${channel}:${accountId}:${kind}:${id}`;
}

// ─── Messaging Adapter ────────────────────────────────────────────────────────
/** @type {any} — ChannelMessagingAdapter */
const messagingAdapter = {
  /** @param {any} ctx */
  async resolveOutboundSessionRoute(ctx) {
    const { cfg, accountId, peer } = ctx;
    const account = await configAdapter.resolveAccount(cfg, accountId ?? "main");
    if (!account) throw new Error("[AgentHub] No account resolved");

    const kind = peer.kind === "group" ? "group" : "direct";
    const sessionKey = buildSessionKey("agenthub", account.accountId, kind, peer.id);

    return {
      sessionKey,
      chatType: kind,
      senderId: account.config.agentId,
      isGroup: peer.kind === "group",
    };
  },

  /** @param {any} ctx */
  async resolveInboundSessionRoute(ctx) {
    const { accountId, conversationId, threadId } = ctx;
    const kind = threadId ? "group" : "direct";
    const sessionKey = buildSessionKey("agenthub", accountId ?? "main", kind, conversationId ?? "");
    return { sessionKey, isGroup: !!threadId, threadId };
  },
};

// ─── Outbound Adapter ─────────────────────────────────────────────────────────
/** @type {any} — ChannelOutboundAdapter */
const outboundAdapter = {
  /** @param {any} ctx */
  async sendText(ctx) {
    const { cfg, accountId, peer, content } = ctx;
    const account = await configAdapter.resolveAccount(cfg, accountId ?? "main");
    if (!account) return { ok: false, error: "No account", channel: "agenthub" };

    const isGroup = peer.kind === "group";
    const endpoint = isGroup ? "/api/groups/send" : "/api/messages/send";
    const payload = isGroup ? { groupId: peer.id, content } : { to: peer.id, content };

    const result = await agentHubApiRequest(account, endpoint, "POST", payload);
    return {
      ok: result.ok,
      error: result.error,
      channel: "agenthub",
      messageId: result?.data?.messageId,
    };
  },

  async sendMedia() {
    return { ok: false, error: "Use agenthub_chat tool for media", channel: "agenthub" };
  },

  async sendPoll() {
    return { ok: false, error: "Poll not supported", channel: "agenthub" };
  },
};

// ─── Gateway Adapter (Webhook 接收) ──────────────────────────────────────────
/** @type {any} — ChannelGatewayAdapter */
const gatewayAdapter = {
  /**
   * @param {import('node:http').IncomingMessage} req
   * @param {import('node:http').ServerResponse} res
   * @param {any} ctx
   */
  async handleInbound(req, res, ctx) {
    if (req.method !== "POST") {
      res.writeHead(405);
      res.end("Method Not Allowed");
      return false;
    }

    let raw = "";
    for await (const chunk of req) { raw += chunk; }

    /** @type {any} */
    let payload;
    try { payload = JSON.parse(raw); } catch {
      res.writeHead(400);
      res.end("Invalid JSON");
      return false;
    }

    /** @type {any} */
    const msg = {
      channel: "agenthub",
      accountId: ctx.accountId ?? "main",
      conversationId: payload?.data?.groupId ?? payload?.data?.fromId ?? "",
      senderId: payload?.data?.fromId ?? "",
      senderName: payload?.data?.fromAgentName,
      content: payload?.data?.content ?? JSON.stringify(payload),
      messageId: payload?.data?.messageId,
      timestamp: payload?.data?.timestamp ?? Date.now(),
      isGroup: !!payload?.data?.groupId,
      threadId: payload?.data?.groupId,
      raw: payload,
    };

    void msg; // consumed by gateway router

    res.writeHead(200);
    res.end(JSON.stringify({ ok: true }));
    return true;
  },
};

// ─── Status Adapter ───────────────────────────────────────────────────────────
/** @type {any} — ChannelStatusAdapter */
const statusAdapter = {
  /** @param {any} cfg @param {string} [accountId] */
  async snapshot(cfg, accountId) {
    const account = await configAdapter.resolveAccount(cfg, accountId ?? "main");
    if (!account) return { ok: false, error: "Account not found", channel: "agenthub" };

    const result = await agentHubApiRequest(account, `/api/agents/${account.config.agentId}`);

    return {
      ok: true,
      channel: "agenthub",
      accountId: account.accountId,
      summary: result.ok
        ? `Connected as ${result?.data?.name ?? account.config.agentId}`
        : `Disconnected: ${result.error}`,
      active: result.ok,
    };
  },
};

// ─── Security Adapter ─────────────────────────────────────────────────────────
/** @type {any} — ChannelSecurityAdapter */
const securityAdapter = {
  async resolveDmPolicy() { return "allow"; },
  async resolveGroupPolicy() { return "allow"; },
  async resolveAllowFrom() { return null; },
};

// ─── Group Adapter ────────────────────────────────────────────────────────────
/** @type {any} — ChannelGroupAdapter */
const groupsAdapter = {
  /** @param {any} cfg @param {string} [accountId] @param {string} groupId */
  async resolveGroupSessionKey(cfg, accountId, groupId) {
    return buildSessionKey("agenthub", accountId ?? "main", "group", groupId);
  },
};

// ─── Threading Adapter ─────────────────────────────────────────────────────────
/** @type {any} — ChannelThreadingAdapter */
const threadingAdapter = {
  /** @param {any} cfg @param {string} [accountId] @param {string} [chatType] */
  resolveReplyToMode(cfg, accountId, chatType) {
    void cfg; void accountId; void chatType;
    return "thread";
  },
};

// ─── 工具注册 ────────────────────────────────────────────────────────────────
/** @param {any} api */
export async function registerAllTools(api) {
  const { agentHubAgentTools } = await import("./tools/agent.js");
  const { agentHubChatTools } = await import("./tools/chat.js");
  const { agentHubGroupTools } = await import("./tools/group.js");
  const { agentHubFriendTools } = await import("./tools/friend.js");

  for (const tool of [...agentHubAgentTools, ...agentHubChatTools, ...agentHubGroupTools, ...agentHubFriendTools]) {
    api.registerTool(tool, { name: tool.name });
  }
}

// ─── Plugin ──────────────────────────────────────────────────────────────────
// Wizard 动态导入（setup-wizard.js 会重新导入 plugin.js，避免循环依赖）
/** @param {any} api */
async function getWizard(api) {
  try {
    const mod = await import("./setup-wizard.js");
    return mod.agentHubSetupWizard;
  } catch {
    return undefined;
  }
}

/** @type {any} — ChannelPlugin */
export const agentHubPlugin = {
  id: CHANNEL_ID,
  meta: {
    id: CHANNEL_ID,
    label: "AgentHub",
  },
  // setupWizard 动态获取（避免循环导入）
  get setupWizard() { return undefined; },
  config: configAdapter,
  setup() {},
  gateway: gatewayAdapter,
  messaging: messagingAdapter,
  outbound: outboundAdapter,
  security: securityAdapter,
  status: statusAdapter,
  groups: groupsAdapter,
  threading: threadingAdapter,
  agentTools: [], // 动态注册 via registerAllTools
};
