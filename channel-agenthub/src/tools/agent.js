/**
 * @file tools/agent.js
 * AgentHub Agent 工具集 — REST API: /api/agents/*
 */

import { agentHubApiRequest } from "../plugin.js";

/** @type {ChannelAgentTool[]} */
export const agentHubAgentTools = [
  {
    name: "agenthub_agent_list",
    description:
      "List all agents registered on the AgentHub server. Returns agent ID, name, status, and bio.",
    schema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Maximum number of agents to return (default: 20)", default: 20 },
        offset: { type: "number", description: "Pagination offset (default: 0)", default: 0 },
      },
    },
    /** @param {any} args @param {any} ctx */
    async execute(args, ctx) {
      const { limit = 20, offset = 0 } = args;
      const account = ctx?.runtimeConfig?.channels?.agenthub?.accounts?.main;
      if (!account) return { ok: false, error: "AgentHub account not configured" };

      return agentHubApiRequest(
        { accountId: "main", config: account },
        `/api/agents?limit=${limit}&offset=${offset}`
      );
    },
  },

  {
    name: "agenthub_agent_info",
    description: "Get detailed information about a specific agent by ID.",
    schema: {
      type: "object",
      properties: { agentId: { type: "string", description: "The agent ID to query" } },
      required: ["agentId"],
    },
    /** @param {any} args @param {any} ctx */
    async execute(args, ctx) {
      const { agentId } = args;
      const account = ctx?.runtimeConfig?.channels?.agenthub?.accounts?.main;
      if (!account) return { ok: false, error: "AgentHub account not configured" };

      return agentHubApiRequest(
        { accountId: "main", config: account },
        `/api/agents/${encodeURIComponent(agentId)}`
      );
    },
  },

  {
    name: "agenthub_agent_my_info",
    description: "Get information about the currently authenticated agent.",
    schema: { type: "object", properties: {} },
    /** @param {any} _args @param {any} ctx */
    async execute(_args, ctx) {
      const account = ctx?.runtimeConfig?.channels?.agenthub?.accounts?.main;
      if (!account) return { ok: false, error: "AgentHub account not configured" };

      return agentHubApiRequest(
        { accountId: "main", config: account },
        `/api/agents/${encodeURIComponent(account.agentId)}`
      );
    },
  },

  {
    name: "agenthub_agent_search",
    description: "Search for agents by keyword (matches name or bio).",
    schema: {
      type: "object",
      properties: {
        keyword: { type: "string", description: "Search keyword" },
        limit: { type: "number", description: "Maximum results (default: 10)", default: 10 },
      },
      required: ["keyword"],
    },
    /** @param {any} args @param {any} ctx */
    async execute(args, ctx) {
      const { keyword, limit = 10 } = args;
      const account = ctx?.runtimeConfig?.channels?.agenthub?.accounts?.main;
      if (!account) return { ok: false, error: "AgentHub account not configured" };

      return agentHubApiRequest(
        { accountId: "main", config: account },
        `/api/agents/search?keyword=${encodeURIComponent(keyword)}&limit=${limit}`
      );
    },
  },

  {
    name: "agenthub_agent_update",
    description: "Update the authenticated agent's profile (name, bio, avatar).",
    schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "New display name" },
        bio: { type: "string", description: "New bio/description" },
        avatar: { type: "string", description: "New avatar URL" },
      },
    },
    /** @param {any} args @param {any} ctx */
    async execute(args, ctx) {
      const { name, bio, avatar } = args;
      const account = ctx?.runtimeConfig?.channels?.agenthub?.accounts?.main;
      if (!account) return { ok: false, error: "AgentHub account not configured" };

      /** @type {Record<string,string>} */
      const body = {};
      if (name) body.name = name;
      if (bio) body.bio = bio;
      if (avatar) body.avatar = avatar;

      return agentHubApiRequest(
        { accountId: "main", config: account },
        `/api/agents/${encodeURIComponent(account.agentId)}`,
        "PATCH",
        body
      );
    },
  },
];
