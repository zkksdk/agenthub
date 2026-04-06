/**
 * AgentHub ChannelPlugin — OpenClaw 插件主入口
 *
 * 完整运行时入口：注册 channel 能力 + 所有工具 + gateway 方法
 * 架构参考: googlechat/index.js, feishu/index.js
 */

import { defineChannelPluginEntry } from "../../core-BghMcc08.js";
import { agentHubPlugin } from "./plugin.js";
import { registerAllTools } from "./plugin.js";

// 运行时注册（仅在全量运行时调用，非 setup-only 模式）
/** @param {any} api */
async function registerFull(api) {
  api.logger.info("[AgentHub] Registering full runtime capabilities");

  // Gateway 方法：查询连接状态
  api.registerGatewayMethod("agenthub_status", async (params, ctx) => {
    void params;
    const cfg = ctx.config ?? {};
    const accounts = cfg?.channels?.agenthub?.accounts ?? {};
    const main = accounts?.main;
    if (!main) return { ok: false, error: "Not configured" };

    const { agentHubApiRequest } = await import("./plugin.js");
    const result = await agentHubApiRequest(
      { accountId: "main", config: main },
      `/api/agents/${main.agentId}`
    );

    return { ok: result.ok, agent: result.data, error: result.error };
  });

  // Gateway 方法：健康检查
  api.registerGatewayMethod("agenthub_health", async (params, ctx) => {
    void params;
    const cfg = ctx.config ?? {};
    const accounts = cfg?.channels?.agenthub?.accounts ?? {};
    const main = accounts?.main;
    if (!main) return { ok: false, error: "Not configured" };

    const { agentHubApiRequest } = await import("./plugin.js");
    const result = await agentHubApiRequest({ accountId: "main", config: main }, "/health");

    return { ok: result.ok, error: result.error };
  });

  // Gateway 方法：发送消息
  api.registerGatewayMethod("agenthub_send_message", async (params) => {
    const { toAgentId, content, isGroup } = params ?? {};
    if (!toAgentId || !content) {
      return { ok: false, error: "toAgentId and content are required" };
    }
    // 注意：实际发送通过 outboundAdapter，这里是快捷方式
    return { ok: false, error: "Use outbound channel route instead" };
  });

  // HTTP Route 注册（Webhook 接收）
  api.registerHttpRoute({
    path: "/gateway/agenthub/webhook",
    auth: "gateway",
    match: "prefix",
    handler: async () => false, // 由 gatewayAdapter 处理
  });

  // 注册所有 Agent Tools
  await registerAllTools(api);

  api.logger.info("[AgentHub] Full runtime registration complete");
}

// 运行时状态注入（占位）
/** @param {any} runtime */
function setRuntime(runtime) {
  void runtime;
}

const entry = defineChannelPluginEntry({
  id: "channel-agenthub",
  name: "AgentHub Channel",
  description: "OpenClaw channel plugin for AgentHub multi-agent server",
  plugin: /** @type {any} */ (agentHubPlugin),
  setRuntime,
  registerFull,
});

export default entry;
export { agentHubPlugin };
