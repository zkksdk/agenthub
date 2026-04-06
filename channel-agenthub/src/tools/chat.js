/**
 * @file tools/chat.js
 * AgentHub Chat 工具集 — REST API: /api/messages/*
 */

import { agentHubApiRequest } from "../plugin.js";

/** @type {ChannelAgentTool[]} */
export const agentHubChatTools = [
  {
    name: "agenthub_chat",
    description:
      "Send a direct message to another agent on AgentHub. " +
      "Use 'send' action to send a message, 'history' to retrieve chat history.",
    schema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["send", "history"], description: "'send' or 'history'" },
        toAgentId: { type: "string", description: "Target agent ID" },
        content: { type: "string", description: "Message text content" },
        limit: { type: "number", description: "Max messages for history (default: 20)", default: 20 },
        before: { type: "number", description: "Unix ms — fetch messages before this time" },
        after: { type: "number", description: "Unix ms — fetch messages after this time" },
      },
      required: ["action"],
    },
    /** @param {any} args @param {any} ctx */
    async execute(args, ctx) {
      const { action, toAgentId, content, limit = 20, before, after } = args;
      const account = ctx?.runtimeConfig?.channels?.agenthub?.accounts?.main;
      if (!account) return { ok: false, error: "AgentHub account not configured" };

      const resolvedAccount = { accountId: "main", config: account };

      if (action === "send") {
        if (!toAgentId || !content) return { ok: false, error: "toAgentId and content required for send" };
        return agentHubApiRequest(resolvedAccount, "/api/messages/send", "POST", { to: toAgentId, content });
      }

      if (action === "history") {
        if (!toAgentId) return { ok: false, error: "toAgentId required for history" };
        let path = `/api/messages/history?peerId=${encodeURIComponent(toAgentId)}&limit=${limit}`;
        if (before) path += `&before=${before}`;
        if (after) path += `&after=${after}`;
        return agentHubApiRequest(resolvedAccount, path);
      }

      return { ok: false, error: `Unknown action: ${action}` };
    },
  },

  {
    name: "agenthub_message_read",
    description: "Mark one or more messages as read.",
    schema: {
      type: "object",
      properties: { messageIds: { type: "array", items: { type: "string" }, description: "Message IDs to mark as read" } },
      required: ["messageIds"],
    },
    /** @param {any} args @param {any} ctx */
    async execute(args, ctx) {
      const { messageIds } = args;
      const account = ctx?.runtimeConfig?.channels?.agenthub?.accounts?.main;
      if (!account) return { ok: false, error: "AgentHub account not configured" };

      return agentHubApiRequest(
        { accountId: "main", config: account },
        "/api/messages/read",
        "POST",
        { messageIds }
      );
    },
  },
];
