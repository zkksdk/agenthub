/**
 * AgentHub ChannelPlugin — Setup 入口
 *
 * 仅导出 { plugin }，用于引导用户完成配置。
 * 包含完整的 setupWizard 定义，plugin.js 的 wizard 仅为占位。
 * 架构参考: feishu/setup-entry.js, signal/setup-entry.js
 */

import { defineSetupPluginEntry } from "../../core-BghMcc08.js";

const CHANNEL = "agenthub";
const DEFAULT_ACCOUNT_ID = "main";

// ─── 配置检查 ──────────────────────────────────────────────────────────────

/** @param {any} cfg @returns {boolean} */
function isAgentHubConfigured(cfg) {
  const account = cfg?.channels?.[CHANNEL]?.accounts?.[DEFAULT_ACCOUNT_ID] ?? {};
  return Boolean(
    typeof account.serverUrl === "string" && account.serverUrl.trim() &&
    typeof account.agentId === "string" && account.agentId.trim() &&
    typeof account.agentToken === "string" && account.agentToken.trim()
  );
}

/** @param {any} cfg @returns {Promise<{ok:boolean, botName?:string, error?:string}>} */
async function probeAgentHub(cfg) {
  const account = cfg?.channels?.[CHANNEL]?.accounts?.[DEFAULT_ACCOUNT_ID];
  if (!account?.serverUrl || !account?.agentToken) return { ok: false, error: "Not configured" };
  try {
    const res = await fetch(`${account.serverUrl}/api/agents/${account.agentId}`, {
      headers: {
        Authorization: `Bearer ${account.agentToken}`,
        ...(account.apiKey ? { "X-Api-Key": account.apiKey } : {}),
      },
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const data = await res.json().catch(() => ({}));
    return { ok: true, botName: data?.name ?? account.agentId };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

/** @param {any} cfg @param {any} patch */
function buildPatch(cfg, patch) {
  return {
    ...cfg,
    channels: {
      ...cfg.channels,
      [CHANNEL]: {
        ...cfg.channels?.[CHANNEL],
        enabled: true,
        accounts: {
          ...cfg.channels?.[CHANNEL]?.accounts,
          [DEFAULT_ACCOUNT_ID]: {
            ...cfg.channels?.[CHANNEL]?.accounts?.[DEFAULT_ACCOUNT_ID],
            ...patch,
          },
        },
      },
    },
  };
}

// ─── Setup Adapter ─────────────────────────────────────────────────────────
const agentHubSetupAdapter = {
  resolveAccountId: () => DEFAULT_ACCOUNT_ID,
  applyAccountConfig({ cfg }) {
    return buildPatch(cfg, {});
  },
};

// ─── Wizard ─────────────────────────────────────────────────────────────────
const agentHubSetupWizard = {
  channel: CHANNEL,
  resolveAccountIdForConfigure: () => DEFAULT_ACCOUNT_ID,
  resolveShouldPromptAccountIds: () => false,

  status: {
    configuredLabel: "configured",
    unconfiguredLabel: "needs configuration",
    configuredHint: "connected",
    unconfiguredHint: "not configured",
    configuredScore: 2,
    unconfiguredScore: 0,
    resolveConfigured: isAgentHubConfigured,
    async resolveStatusLines(cfg, configured) {
      if (!configured) return [`${CHANNEL}: needs server URL, agent ID, and token`];
      const probe = await probeAgentHub(cfg);
      if (probe.ok) return [`${CHANNEL}: connected as ${probe.botName}`];
      return [`${CHANNEL}: configured — ${probe.error}`];
    },
  },

  credentials: [
    {
      label: "AgentHub Server URL",
      hint: "e.g. https://your-server.com",
      resolveValue: (cfg) => cfg?.channels?.[CHANNEL]?.accounts?.[DEFAULT_ACCOUNT_ID]?.serverUrl ?? "https://",
      validate: (v) => {
        if (!v?.trim()) return "Required";
        if (!/^https?:\/\//.test(v.trim())) return "Must start with http:// or https://";
        return null;
      },
    },
    {
      label: "Agent ID",
      hint: "From AgentHub dashboard → agent settings",
      resolveValue: (cfg) => cfg?.channels?.[CHANNEL]?.accounts?.[DEFAULT_ACCOUNT_ID]?.agentId ?? "",
      validate: (v) => (!v?.trim() ? "Required" : null),
    },
    {
      label: "Agent Token",
      hint: "From AgentHub dashboard → agent settings",
      resolveValue: (cfg) => cfg?.channels?.[CHANNEL]?.accounts?.[DEFAULT_ACCOUNT_ID]?.agentToken ?? "",
      validate: (v) => (!v?.trim() ? "Required" : null),
    },
  ],

  async finalize({ cfg, prompter }) {
    let patch = {};

    await prompter.note(
      [
        `AgentHub channel setup`,
        ``,
        `1. Open your AgentHub dashboard and go to your agent's settings`,
        `2. Copy the Agent ID and Agent Token`,
        `3. Make sure the server is reachable from this OpenClaw instance`,
      ].join("\n"),
      "AgentHub"
    );

    const serverUrl = (await prompter.text({
      message: "AgentHub Server URL",
      initialValue: cfg?.channels?.[CHANNEL]?.accounts?.[DEFAULT_ACCOUNT_ID]?.serverUrl ?? "https://",
      validate: (v) => {
        if (!v?.trim()) return "Required";
        if (!/^https?:\/\//.test(v.trim())) return "Must start with http:// or https://";
        return null;
      },
    })).trim();

    const agentId = (await prompter.text({
      message: "Agent ID",
      initialValue: cfg?.channels?.[CHANNEL]?.accounts?.[DEFAULT_ACCOUNT_ID]?.agentId ?? "",
      validate: (v) => (!v?.trim() ? "Required" : null),
    })).trim();

    const agentTokenResult = await prompter.secret({
      message: "Agent Token",
      initialValue: "",
      validate: (v) => (!v?.trim() ? "Required" : null),
    });
    const agentToken = typeof agentTokenResult === "string" ? agentTokenResult.trim()
      : agentTokenResult?.value?.trim() ?? "";

    patch = { serverUrl, agentId, agentToken };

    const probe = await probeAgentHub(buildPatch(cfg, patch));
    if (probe.ok) {
      await prompter.note(`✅ Connected as "${probe.botName}"`, "Success");
    } else {
      await prompter.error(`Connection failed: ${probe.error}`);
      await prompter.note("You can update the configuration later.", "Note");
    }

    return buildPatch(cfg, patch);
  },
};

// ─── Plugin (setup 模式最小化对象) ─────────────────────────────────────────
const setupPlugin = {
  id: CHANNEL,
  meta: { id: CHANNEL, label: "AgentHub" },
  setupWizard: agentHubSetupWizard,
  setup() {},
  config: {
    resolveAccount: () => null,
    async listAccounts(cfg) {
      return Object.keys(cfg?.channels?.[CHANNEL]?.accounts ?? {});
    },
    async writeAccount() { return { ok: true }; },
    async deleteAccount() { return { ok: true }; },
    setup: agentHubSetupAdapter,
  },
  // 重量级属性在 setup 模式下置空
  agentTools: [],
  gateway: undefined,
  outbound: undefined,
  status: undefined,
  security: undefined,
  groups: undefined,
  messaging: undefined,
  threading: undefined,
};

const entry = defineSetupPluginEntry(setupPlugin);

export default entry;
