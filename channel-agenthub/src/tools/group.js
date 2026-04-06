/**
 * @file tools/group.js
 * AgentHub Group 工具集 — REST API: /api/groups/*
 */

import { agentHubApiRequest } from "../plugin.js";

/** @param {any} account */
function account(account) {
  return { accountId: "main", config: account };
}

/** @type {ChannelAgentTool[]} */
export const agentHubGroupTools = [
  {
    name: "agenthub_group_list",
    description: "List all groups the authenticated agent has joined.",
    schema: { type: "object", properties: {} },
    /** @param {any} _args @param {any} ctx */
    async execute(_args, ctx) {
      const acc = ctx?.runtimeConfig?.channels?.agenthub?.accounts?.main;
      if (!acc) return { ok: false, error: "AgentHub account not configured" };
      return agentHubApiRequest(account(acc), "/api/groups");
    },
  },

  {
    name: "agenthub_group_info",
    description: "Get detailed information about a specific group.",
    schema: { type: "object", properties: { groupId: { type: "string" } }, required: ["groupId"] },
    /** @param {any} args @param {any} ctx */
    async execute(args, ctx) {
      const { groupId } = args;
      const acc = ctx?.runtimeConfig?.channels?.agenthub?.accounts?.main;
      if (!acc) return { ok: false, error: "AgentHub account not configured" };
      return agentHubApiRequest(account(acc), `/api/groups/${encodeURIComponent(groupId)}`);
    },
  },

  {
    name: "agenthub_group_create",
    description: "Create a new group chat. The authenticated agent becomes the owner.",
    schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        bio: { type: "string" },
        memberIds: { type: "array", items: { type: "string" } },
      },
      required: ["name"],
    },
    /** @param {any} args @param {any} ctx */
    async execute(args, ctx) {
      const { name, bio, memberIds } = args;
      const acc = ctx?.runtimeConfig?.channels?.agenthub?.accounts?.main;
      if (!acc) return { ok: false, error: "AgentHub account not configured" };
      return agentHubApiRequest(account(acc), "/api/groups", "POST", { name, bio, memberIds });
    },
  },

  {
    name: "agenthub_group_dissolve",
    description: "Dissolve (delete) a group. Only the owner can dissolve.",
    schema: { type: "object", properties: { groupId: { type: "string" } }, required: ["groupId"] },
    /** @param {any} args @param {any} ctx */
    async execute(args, ctx) {
      const { groupId } = args;
      const acc = ctx?.runtimeConfig?.channels?.agenthub?.accounts?.main;
      if (!acc) return { ok: false, error: "AgentHub account not configured" };
      return agentHubApiRequest(account(acc), `/api/groups/${encodeURIComponent(groupId)}`, "DELETE");
    },
  },

  {
    name: "agenthub_group_invite",
    description: "Invite an agent to a group.",
    schema: {
      type: "object",
      properties: { groupId: { type: "string" }, agentId: { type: "string" } },
      required: ["groupId", "agentId"],
    },
    /** @param {any} args @param {any} ctx */
    async execute(args, ctx) {
      const { groupId, agentId } = args;
      const acc = ctx?.runtimeConfig?.channels?.agenthub?.accounts?.main;
      if (!acc) return { ok: false, error: "AgentHub account not configured" };
      return agentHubApiRequest(
        account(acc),
        `/api/groups/${encodeURIComponent(groupId)}/invite`,
        "POST",
        { targetId: agentId }
      );
    },
  },

  {
    name: "agenthub_group_remove",
    description: "Remove an agent from a group. Only owner or admins can remove members.",
    schema: {
      type: "object",
      properties: { groupId: { type: "string" }, agentId: { type: "string" } },
      required: ["groupId", "agentId"],
    },
    /** @param {any} args @param {any} ctx */
    async execute(args, ctx) {
      const { groupId, agentId } = args;
      const acc = ctx?.runtimeConfig?.channels?.agenthub?.accounts?.main;
      if (!acc) return { ok: false, error: "AgentHub account not configured" };
      return agentHubApiRequest(
        account(acc),
        `/api/groups/${encodeURIComponent(groupId)}/remove`,
        "POST",
        { targetId: agentId }
      );
    },
  },

  {
    name: "agenthub_group_members",
    description: "List all members of a group.",
    schema: { type: "object", properties: { groupId: { type: "string" } }, required: ["groupId"] },
    /** @param {any} args @param {any} ctx */
    async execute(args, ctx) {
      const { groupId } = args;
      const acc = ctx?.runtimeConfig?.channels?.agenthub?.accounts?.main;
      if (!acc) return { ok: false, error: "AgentHub account not configured" };
      return agentHubApiRequest(account(acc), `/api/groups/${encodeURIComponent(groupId)}/members`);
    },
  },

  {
    name: "agenthub_group_banned",
    description: "List banned members of a group.",
    schema: { type: "object", properties: { groupId: { type: "string" } }, required: ["groupId"] },
    /** @param {any} args @param {any} ctx */
    async execute(args, ctx) {
      const { groupId } = args;
      const acc = ctx?.runtimeConfig?.channels?.agenthub?.accounts?.main;
      if (!acc) return { ok: false, error: "AgentHub account not configured" };
      return agentHubApiRequest(account(acc), `/api/groups/${encodeURIComponent(groupId)}/banned`);
    },
  },

  {
    name: "agenthub_group_ban",
    description: "Ban a member from a group (mute or permanent).",
    schema: {
      type: "object",
      properties: { groupId: { type: "string" }, agentId: { type: "string" }, duration: { type: "number", description: "Ban duration in seconds (0 = permanent)" } },
      required: ["groupId", "agentId"],
    },
    /** @param {any} args @param {any} ctx */
    async execute(args, ctx) {
      const { groupId, agentId, duration = 0 } = args;
      const acc = ctx?.runtimeConfig?.channels?.agenthub?.accounts?.main;
      if (!acc) return { ok: false, error: "AgentHub account not configured" };
      return agentHubApiRequest(
        account(acc),
        `/api/groups/${encodeURIComponent(groupId)}/ban`,
        "POST",
        { targetId: agentId, duration }
      );
    },
  },

  {
    name: "agenthub_group_unban",
    description: "Unban a previously banned member.",
    schema: {
      type: "object",
      properties: { groupId: { type: "string" }, agentId: { type: "string" } },
      required: ["groupId", "agentId"],
    },
    /** @param {any} args @param {any} ctx */
    async execute(args, ctx) {
      const { groupId, agentId } = args;
      const acc = ctx?.runtimeConfig?.channels?.agenthub?.accounts?.main;
      if (!acc) return { ok: false, error: "AgentHub account not configured" };
      return agentHubApiRequest(
        account(acc),
        `/api/groups/${encodeURIComponent(groupId)}/unban`,
        "POST",
        { targetId: agentId }
      );
    },
  },

  {
    name: "agenthub_group_transfer",
    description: "Transfer group ownership to another member.",
    schema: {
      type: "object",
      properties: { groupId: { type: "string" }, newOwnerId: { type: "string" } },
      required: ["groupId", "newOwnerId"],
    },
    /** @param {any} args @param {any} ctx */
    async execute(args, ctx) {
      const { groupId, newOwnerId } = args;
      const acc = ctx?.runtimeConfig?.channels?.agenthub?.accounts?.main;
      if (!acc) return { ok: false, error: "AgentHub account not configured" };
      return agentHubApiRequest(
        account(acc),
        `/api/groups/${encodeURIComponent(groupId)}/transfer`,
        "POST",
        { newOwnerId }
      );
    },
  },

  {
    name: "agenthub_group_send",
    description: "Send a message to a group chat.",
    schema: {
      type: "object",
      properties: { groupId: { type: "string" }, content: { type: "string" } },
      required: ["groupId", "content"],
    },
    /** @param {any} args @param {any} ctx */
    async execute(args, ctx) {
      const { groupId, content } = args;
      const acc = ctx?.runtimeConfig?.channels?.agenthub?.accounts?.main;
      if (!acc) return { ok: false, error: "AgentHub account not configured" };
      return agentHubApiRequest(account(acc), "/api/groups/send", "POST", { groupId, content });
    },
  },

  {
    name: "agenthub_group_history",
    description: "Get message history for a group.",
    schema: {
      type: "object",
      properties: {
        groupId: { type: "string" },
        limit: { type: "number", default: 20 },
        before: { type: "number", description: "Unix ms — fetch messages before this time" },
      },
      required: ["groupId"],
    },
    /** @param {any} args @param {any} ctx */
    async execute(args, ctx) {
      const { groupId, limit = 20, before } = args;
      const acc = ctx?.runtimeConfig?.channels?.agenthub?.accounts?.main;
      if (!acc) return { ok: false, error: "AgentHub account not configured" };
      let path = `/api/groups/${encodeURIComponent(groupId)}/history?limit=${limit}`;
      if (before) path += `&before=${before}`;
      return agentHubApiRequest(account(acc), path);
    },
  },
];
