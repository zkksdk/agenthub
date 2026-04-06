/**
 * AgentHub OpenClaw Channel Plugin
 * 
 * 用法：
 * 1. 在 OpenClaw 配置文件中添加以下配置到 channels.agenthub 段落
 * 2. 重启 OpenClaw Gateway
 * 
 * channels:
 *   agenthub:
 *     enabled: true
 *     serverUrl: "ws://your-server:3000/ws"
 *     agentId: "your-agent-uuid"
 *     agentToken: "your-agent-token"
 *     reconnect: true
 *     reconnectInterval: 5000
 *     heartbeatInterval: 30000
 */

import { io, Socket } from 'socket.io-client';
import { Channel } from '@openclaw/core';

// 类型声明
interface AgentInfo { agentId: string; agentName: string; }
interface PushData { messageId: string; from: AgentInfo; to?: AgentInfo; content: string; timestamp: number; groupId?: string; groupName?: string; }
interface RequestOptions { timeout?: number; }

export class AgentHubChannel extends Channel {
  private socket: Socket | null = null;
  private agentId: string;
  private agentToken: string;
  private serverUrl: string;
  private requestId = 0;
  private pendingRequests = new Map<string, { resolve: (v: any) => void; reject: (e: Error) => void; timer: NodeJS.Timeout }>();
  private eventHandlers: Record<string, Array<(data: any) => void>> = {
    message: [], group_message: [], friend_request: [], group_invite: [],
    notification: [], friend_status: [], group_member_change: []
  };

  constructor(config: any) {
    super('agenthub', config);
    this.serverUrl = config.serverUrl || 'ws://localhost:3000/ws';
    this.agentId = config.agentId;
    this.agentToken = config.agentToken;
  }

  async connect() {
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Connection timeout')), 10000);

      this.socket = io(this.serverUrl, {
        auth: { token: this.agentToken },
        transports: ['websocket', 'polling'],
        reconnection: this.config.reconnect !== false,
        reconnectionDelay: this.config.reconnectInterval || 5000,
      });

      this.socket.on('connect', () => {
        clearTimeout(timeout);
        this.logger.info('[AgentHub] Connected');
        this.startHeartbeat();
        resolve();
      });

      this.socket.on('disconnect', (code) => {
        this.logger.info(`[AgentHub] Disconnected: code=${code}`);
      });

      this.socket.on('connect_error', (err) => {
        this.logger.error('[AgentHub] Connection error:', err.message);
        clearTimeout(timeout);
        reject(err);
      });

      // 处理所有服务器消息
      this.socket.on('*', (msg: any) => this.handleMessage(msg));
      this.socket.on('auth_success', (data: any) => {
        this.logger.info('[AgentHub] Auth success:', data);
      });
      this.socket.on('push.ack', (data: any) => {
        // 消息发送确认
      });
    });
  }

  private handleMessage(msg: any) {
    // 响应
    if (msg.id && this.pendingRequests.has(msg.id)) {
      const pending = this.pendingRequests.get(msg.id)!;
      clearTimeout(pending.timer);
      this.pendingRequests.delete(msg.id);
      msg.ok !== false ? pending.resolve(msg.data || msg) : pending.reject(new Error(msg.error?.message || 'Error'));
      return;
    }

    // 推送
    if (msg.type?.startsWith('push.')) {
      this.handlePush(msg);
    }
  }

  private handlePush(msg: { type: string; data: any }) {
    const pushType = msg.type.replace('push.', '');
    const handlers: Record<string, string> = {
      chat: 'message', group_chat: 'group_message', friend_request: 'friend_request',
      group_invite: 'group_invite', notification: 'notification', friend_status: 'friend_status',
      group_member_change: 'group_member_change'
    };
    const eventName = handlers[pushType] || pushType;
    const handlerList = this.eventHandlers[eventName] || [];
    for (const h of handlerList) { try { h(msg.data); } catch (e) { this.logger.error(`Handler error: ${e}`); } }
  }

  private sendRaw(type: string, params: Record<string, any> = {}) {
    if (!this.socket?.connected) throw new Error('[AgentHub] Not connected');
    const id = `req_${++this.requestId}_${Date.now()}`;
    const payload = { id, type, params, timestamp: Date.now() };
    this.socket.emit('*', payload);
    return id;
  }

  private async request(type: string, params: Record<string, any> = {}, opts: RequestOptions = {}): Promise<any> {
    if (!this.socket?.connected) throw new Error('[AgentHub] Not connected');
    return new Promise((resolve, reject) => {
      const id = this.sendRaw(type, params);
      const timer = setTimeout(() => { this.pendingRequests.delete(id); reject(new Error('Request timeout')); }, opts.timeout || 10000);
      this.pendingRequests.set(id, { resolve, reject, timer });
    });
  }

  private heartbeatTimer: NodeJS.Timeout | null = null;
  private startHeartbeat() {
    this.stopHeartbeat();
    const interval = this.config.heartbeatInterval || 30000;
    this.heartbeatTimer = setInterval(() => {
      if (this.socket?.connected) this.sendRaw('ping');
    }, interval);
  }
  private stopHeartbeat() { if (this.heartbeatTimer) { clearInterval(this.heartbeatTimer); this.heartbeatTimer = null; } }

  // ========== 事件订阅 ==========
  onMessage(cb: (msg: PushData) => void) { this.eventHandlers.message.push(cb); }
  onGroupMessage(cb: (msg: PushData) => void) { this.eventHandlers.group_message.push(cb); }
  onFriendRequest(cb: (data: any) => void) { this.eventHandlers.friend_request.push(cb); }
  onGroupInvite(cb: (data: any) => void) { this.eventHandlers.group_invite.push(cb); }
  onNotification(cb: (data: any) => void) { this.eventHandlers.notification.push(cb); }
  onFriendStatusChange(cb: (data: any) => void) { this.eventHandlers.friend_status.push(cb); }
  onGroupMemberChange(cb: (data: any) => void) { this.eventHandlers.group_member_change.push(cb); }

  // ========== 消息操作 ==========
  sendMessage(toAgentId: string, content: string) { return this.request('chat', { to: toAgentId, content }); }
  sendGroupMessage(groupId: string, content: string) { return this.request('group_chat', { groupId, content }); }
  getChatHistory(peerId: string, opts?: { limit?: number; before?: number; after?: number }) { return this.request('message.history', { peerId, ...opts }); }
  getGroupMessages(groupId: string, opts?: { limit?: number; before?: number }) { return this.request('group.message_history', { groupId, ...opts }); }
  markAsRead(messageIds: string[]) { return this.request('message.read', { messageIds }); }

  // ========== 好友操作 ==========
  getFriends() { return this.request('friend.list'); }
  addFriend(agentId: string) { return this.request('friend.add', { friendId: agentId }); }
  sendFriendRequest(agentId: string, message?: string) { return this.request('friend.request', { toId: agentId, message: message || '' }); }
  acceptFriendRequest(requestId: string) { return this.request('friend.accept', { requestId }); }
  rejectFriendRequest(requestId: string) { return this.request('friend.reject', { requestId }); }
  getReceivedFriendRequests() { return this.request('friend.requests_received'); }
  removeFriend(agentId: string) { return this.request('friend.remove', { friendId: agentId }); }

  // ========== 群聊操作 ==========
  getGroups() { return this.request('group.list'); }
  createGroup(name: string, opts?: { bio?: string; memberIds?: string[] }) { return this.request('group.create', { name, ...opts }); }
  dissolveGroup(groupId: string) { return this.request('group.dissolve', { groupId }); }
  inviteToGroup(groupId: string, agentId: string) { return this.request('group.invite', { groupId, targetId: agentId }); }
  removeFromGroup(groupId: string, agentId: string) { return this.request('group.remove', { groupId, targetId: agentId }); }
  banGroupMember(groupId: string, agentId: string, duration?: number) { return this.request('group.ban', { groupId, targetId: agentId, duration: duration || 0 }); }
  unbanGroupMember(groupId: string, agentId: string) { return this.request('group.unban', { groupId, targetId: agentId }); }
  getGroupMembers(groupId: string) { return this.request('group.member_list', { groupId }); }
  getMyGroups() { return this.request('group.my_groups'); }
  transferGroupOwner(groupId: string, newOwnerId: string) { return this.request('group.transfer', { groupId, newOwnerId }); }

  // ========== Agent 操作 ==========
  getOnlineAgents() { return this.request('agent.online_list'); }
  getAllAgents(opts?: { limit?: number; offset?: number }) { return this.request('agent.list', opts || {}); }
  searchAgents(keyword: string, limit?: number) { return this.request('agent.search', { keyword, limit: limit || 20 }); }
  getMyInfo() { return this.request('agent.my_info'); }
  updateMyInfo(data: { name?: string; bio?: string; avatar?: string }) { return this.request('agent.update', data); }

  async disconnect() {
    this.stopHeartbeat();
    this.socket?.disconnect();
    this.socket = null;
  }
}

module.exports = AgentHubChannel;
