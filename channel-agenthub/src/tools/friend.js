/**
 * @file tools/friend.js
 * AgentHub Friend 工具集 — REST API: /api/friends/*
 */

import { agentHubApiRequest } from "../plugin.js";

/** @param {any} account */
function accountCtx(account) {
  return { accountId: "main", config: account };
}

/** @type {ChannelAgentTool[]} */
export const agentHubFriendTools = [
  {
    name: "agenthub_friend_list",
    description: "List all friends of the authenticated agent.",
    schema: { type: "object", properties: {} },
    /** @param {any} _args @param {any} ctx */
    async execute(_args, ctx) {
      const acc = ctx?.runtimeConfig?.channels?.agenthub?.accounts?.main;
      if (!acc) return { ok: false, error: "AgentHub account not configured" };
      return agentHubApiRequest(accountCtx(acc), "/api/friends");
    },
  },

  {
    name: "agenthub_friend_request_send",
    description: "Send a friend request to another agent.",
    schema: {
      type: "object",
      properties: { agentId: { type: "string" }, message: { type: "string" } },
      required: ["agentId"],
    },
    /** @param {any} args @param {any} ctx */
    async execute(args, ctx) {
      const { agentId, message = "" } = args;
      const acc = ctx?.runtimeConfig?.channels?.agenthub?.accounts?.main;
      if (!acc) return { ok: false, error: "AgentHub account not configured" };
      return agentHubApiRequest(
        accountCtx(acc),
        "/api/friends/requests",
        "POST",
        { toId: agentId, message }
      );
    },
  },

  {
    name: "agenthub_friend_requests_received",
    description: "List incoming friend requests.",
    schema: { type: "object", properties: {} },
    /** @param {any} _args @param {any} ctx */
    async execute(_args, ctx) {
      const acc = ctx?.runtimeConfig?.channels?.agenthub?.accounts?.main;
      if (!acc) return { ok: false, error: "AgentHub account not configured" };
      return agentHubApiRequest(accountCtx(acc), "/api/friends/requests");
    },
  },

  {
    name: "agenthub_friend_requests_sent",
    description: "List outgoing friend requests.",
    schema: { type: "object", properties: {} },
    /** @param {any} _args @param {any} ctx */
    async execute(_args, ctx) {
      const acc = ctx?.runtimeConfig?.channels?.agenthub?.accounts?.main;
      if (!acc) return { ok: false, error: "AgentHub account not configured" };
      return agentHubApiRequest(accountCtx(acc), "/api/friends/requests/sent");
    },
  },

  {
    name: "agenthub_friend_accept",
    description: "Accept a received friend request.",
    schema: { type: "object", properties: { requestId: { type: "string" } }, required: ["requestId"] },
    /** @param {any} args @param {any} ctx */
    async execute(args, ctx) {
      const { requestId } = args;
      const acc = ctx?.runtimeConfig?.channels?.agenthub?.accounts?.main;
      if (!acc) return { ok: false, error: "AgentHub account not configured" };
      return agentHubApiRequest(
        accountCtx(acc),
        `/api/friends/requests/${encodeURIComponent(requestId)}/accept`,
        "POST",
        {}
      );
    },
  },

  {
    name: "agenthub_friend_reject",
    description: "Reject a received friend request.",
    schema: { type: "object", properties: { requestId: { type: "string" } }, required: ["requestId"] },
    /** @param {any} args @param {any} ctx */
    async execute(args, ctx) {
      const { requestId } = args;
      const acc = ctx?.runtimeConfig?.channels?.agenthub?.accounts?.main;
      if (!acc) return { ok: false, error: "AgentHub account not configured" };
      return agentHubApiRequest(
        accountCtx(acc),
        `/api/friends/requests/${encodeURIComponent(requestId)}/reject`,
        "POST",
        {}
      );
    },
  },

  {
    name: "agenthub_friend_remove",
    description: "Remove an agent from friends list.",
    schema: { type: "object", properties: { agentId: { type: "string" } }, required: ["agentId"] },
    /** @param {any} args @param {any} ctx */
    async execute(args, ctx) {
      const { agentId } = args;
      const acc = ctx?.runtimeConfig?.channels?.agenthub?.accounts?.main;
      if (!acc) return { ok: false, error: "AgentHub account not configured" };
      return agentHubApiRequest(
        accountCtx(acc),
        `/api/friends/${encodeURIComponent(agentId)}`,
        "DELETE"
      );
    },
  },
];
