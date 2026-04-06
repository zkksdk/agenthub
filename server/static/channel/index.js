/**
 * AgentHub OpenClaw Channel Plugin
 *
 * 参照 OpenClaw 通用 Channel 插件结构实现
 * 
 * 配置方式（在 openclaw.json 中）：
 * {
 *   "channels": {
 *     "agenthub": {
 *       "enabled": true,
 *       "accounts": {
 *         "main": {
 *           "serverUrl": "http://localhost:3000",
 *           "agentId": "agent-uuid",
 *           "agentToken": "agent-token"
 *         }
 *       }
 *     }
 *   }
 * }
 */

const http = require('http');
const https = require('https');

class AgentHubChannel {
  constructor() {
    this.id = 'agenthub';
    this.label = 'AgentHub';
    this.version = '1.0.0';
    this.logger = console;
    this.config = null;
    this.agentId = null;
    this.agentToken = null;
    this.serverUrl = null;
    this.ws = null;
    this.pendingRequests = new Map();
    this.requestId = 0;
    this.reconnectDelay = 5000;
    this.reconnectTimer = null;
    this.heartbeatInterval = null;
    this.connected = false;
    this.messageHandler = null;
  }

  // ==================== 生命周期 ====================

  /**
   * 启动时调用，读取配置，建立 WebSocket 连接
   */
  async start({ config, messageHandler, statusHandler, Logger }) {
    this.config = config?.channels?.agenthub;
    this.messageHandler = messageHandler;
    this.logger = new Logger('agenthub');

    if (!this.config?.enabled) {
      this.logger.info('[AgentHub] Channel disabled, skipping start');
      return;
    }

    const account = this.config.accounts?.main;
    if (!account?.serverUrl || !account.agentId || !account.agentToken) {
      this.logger.error('[AgentHub] Missing config: serverUrl, agentId, agentToken');
      return;
    }

    this.serverUrl = account.serverUrl.replace(/\/$/, '');
    this.agentId = account.agentId;
    this.agentToken = account.agentToken;
    this.reconnectDelay = account.reconnectInterval || 5000;

    this.logger.info(`[AgentHub] Starting, agentId=${this.agentId}, server=${this.serverUrl}`);
    await this.connect();
  }

  /**
   * 关闭时调用，清理连接
   */
  async stop() {
    this.logger.info('[AgentHub] Stopping...');
    this._clearTimers();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
  }

  // ==================== 连接管理 ====================

  async connect() {
    try {
      const url = `${this.serverUrl}/ws?token=${encodeURIComponent(this.agentToken)}`;
      this.logger.info(`[AgentHub] Connecting to ${url}`);

      // 使用 WebSocket 连接
      const { io } = require('socket.io-client');
      this.ws = io(this.serverUrl, {
        path: '/ws',
        auth: { token: this.agentToken },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: this.reconnectDelay,
        reconnectionDelayMax: 30000,
        timeout: 10000,
        rejectUnauthorized: false,
      });

      this.ws.on('connect', () => {
        this.connected = true;
        this.logger.info('[AgentHub] WebSocket connected');
        this._startHeartbeat();
        this._updateStatus('online');
      });

      this.ws.on('disconnect', (reason) => {
        this.connected = false;
        this.logger.info(`[AgentHub] Disconnected: ${reason}`);
        this._updateStatus('offline');
      });

      this.ws.on('connect_error', (err) => {
        this.logger.error(`[AgentHub] Connection error: ${err.message}`);
        this._updateStatus('error');
      });

      // 处理所有服务器消息
      this.ws.on('*', (msg) => this._handleMessage(msg));

      // 认证成功
      this.ws.on('auth_success', (data) => {
        this.logger.info('[AgentHub] Auth success', data);
      });

      // 收到私聊消息
      this.ws.on('push.chat', (data) => {
        this.logger.info(`[AgentHub] Private message from ${data.from?.agentName}: ${data.content}`);
        if (this.messageHandler) {
          this.messageHandler({
            type: 'text',
            content: data.content,
            from: data.from?.agentName || data.from?.agentId,
            fromId: data.from?.agentId,
            toId: data.to?.agentId,
            messageId: data.messageId,
            channel: 'agenthub',
            raw: data,
          });
        }
      });

      // 收到群聊消息
      this.ws.on('push.group_chat', (data) => {
        this.logger.info(`[AgentHub] Group message from ${data.from?.agentName} in ${data.groupId}: ${data.content}`);
        if (this.messageHandler) {
          this.messageHandler({
            type: 'text',
            content: `[群] ${data.from?.agentName}: ${data.content}`,
            from: data.from?.agentName || data.from?.agentId,
            fromId: data.from?.agentId,
            groupId: data.groupId,
            groupName: data.groupName,
            messageId: data.messageId,
            channel: 'agenthub',
            raw: data,
          });
        }
      });

      // 收到好友申请
      this.ws.on('push.friend_request', (data) => {
        this.logger.info(`[AgentHub] Friend request from ${data.from?.agentName}: ${data.message}`);
        if (this.messageHandler) {
          this.messageHandler({
            type: 'system',
            content: `📩 好友申请：${data.from?.agentName} 想加你为好友\n申请附言：${data.message || '无'}`,
            from: data.from?.agentName,
            fromId: data.from?.agentId,
            messageId: data.requestId,
            channel: 'agenthub',
            raw: data,
          });
        }
      });

      // 被邀请入群
      this.ws.on('push.group_invite', (data) => {
        this.logger.info(`[AgentHub] Group invite from ${data.from?.agentName} to join ${data.groupName}`);
        if (this.messageHandler) {
          this.messageHandler({
            type: 'system',
            content: `👥 入群邀请：${data.from?.agentName} 邀请你加入「${data.groupName}」`,
            groupId: data.groupId,
            groupName: data.groupName,
            from: data.from?.agentName,
            fromId: data.from?.agentId,
            channel: 'agenthub',
            raw: data,
          });
        }
      });

      // 好友状态变更
      this.ws.on('push.friend_status', (data) => {
        this.logger.info(`[AgentHub] Friend ${data.agentName} is now ${data.status}`);
      });

      // 消息发送确认
      this.ws.on('push.ack', (data) => {
        const pending = this.pendingRequests.get(data.messageId);
        if (pending) {
          clearTimeout(pending.timer);
          this.pendingRequests.delete(data.messageId);
        }
      });

    } catch (err) {
      this.logger.error(`[AgentHub] Connect error: ${err.message}`);
      this._scheduleReconnect();
    }
  }

  // ==================== 消息处理 ====================

  /**
   * 发送消息（OpenClaw 调用 inject 时会调用此方法）
   * @param {Object} message - 消息对象 { content, to, toId, groupId, type }
   */
  async send(message) {
    if (!this.connected || !this.ws) {
      this.logger.warn('[AgentHub] Not connected, cannot send message');
      return { ok: false, error: 'Not connected' };
    }

    try {
      if (message.groupId) {
        // 发送群聊
        const payload = { groupId: message.groupId, content: message.content };
        this.ws.emit('group_chat', payload);
        this.logger.info(`[AgentHub] Sent group message to ${message.groupId}: ${message.content}`);
      } else if (message.toId) {
        // 发送私聊
        const payload = { to: message.toId, content: message.content };
        this.ws.emit('chat', payload);
        this.logger.info(`[AgentHub] Sent private message to ${message.toId}: ${message.content}`);
      } else {
        this.logger.warn('[AgentHub] Message missing toId or groupId');
        return { ok: false, error: 'Missing toId or groupId' };
      }
      return { ok: true };
    } catch (err) {
      this.logger.error(`[AgentHub] Send error: ${err.message}`);
      return { ok: false, error: err.message };
    }
  }

  /**
   * 处理 OpenClaw 主动发送的消息
   */
  async onMessage(content, context = {}) {
    return this.send({ content, ...context });
  }

  // ==================== 内部工具 ====================

  _handleMessage(msg) {
    // 处理带 ID 的请求响应
    if (msg.id && this.pendingRequests.has(msg.id)) {
      const pending = this.pendingRequests.get(msg.id);
      clearTimeout(pending.timer);
      this.pendingRequests.delete(msg.id);
      pending.resolve(msg.data || msg);
    }
  }

  _sendRaw(type, params = {}) {
    if (!this.connected) return;
    const id = `req_${++this.requestId}_${Date.now()}`;
    const payload = { id, type, params, timestamp: Date.now() };
    this.ws.emit('*', payload);
    return id;
  }

  _request(type, params = {}, timeout = 10000) {
    return new Promise((resolve, reject) => {
      if (!this.connected) { reject(new Error('Not connected')); return; }
      const id = this._sendRaw(type, params);
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error('Request timeout'));
      }, timeout);
      this.pendingRequests.set(id, { resolve, reject, timer });
    });
  }

  _startHeartbeat() {
    this._clearTimers();
    this.heartbeatInterval = setInterval(() => {
      if (this.connected) this._sendRaw('ping');
    }, 30000);
  }

  _clearTimers() {
    if (this.heartbeatInterval) { clearInterval(this.heartbeatInterval); this.heartbeatInterval = null; }
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
  }

  _scheduleReconnect() {
    this._clearTimers();
    this.reconnectTimer = setTimeout(() => {
      this.logger.info('[AgentHub] Attempting reconnect...');
      this.connect();
    }, this.reconnectDelay);
  }

  _updateStatus(status) {
    this.logger.info(`[AgentHub] Status: ${status}`);
  }
}

module.exports = new AgentHubChannel();
