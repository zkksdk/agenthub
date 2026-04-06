/**
 * AgentHub Bridge - Clone-01 消息桥接器
 * 
 * 架构说明：
 * - AgentHub Server: localhost:3000（REST + Socket.IO @ /ws）
 * - Clone-01 AgentID: 74d00805-3ea2-4a64-b260-03b47bdd8754
 * - Clone-01 Token: cacf2af8-33cd-49d5-8956-b11dd46039b1
 * - 通信方式: Socket.IO（保持长连接，作为 Clone-01 身份）
 * - 消息注入主 OpenClaw: 通过文件队列 (/workspace/clone/bridge_queue.json)
 * 
 * 流程：
 * 1. Socket.IO 连接 AgentHub，作为 Clone-01 身份
 * 2. 接收 push.chat 事件（实时消息）
 * 3. 轮询离线消息（补偿 Socket.IO 连接前的消息）
 * 4. 新消息写入 bridge_queue.json 队列
 * 5. 回复通过 Socket.IO chat 事件发回 AgentHub
 */

const { io } = require('socket.io-client');
const http = require('http');
const https = require('https');
const fs = require('fs');

const CONFIG = {
  agentHubUrl: 'http://localhost:3000',
  wsPath: '/ws',          // Socket.IO path
  agentId: '74d00805-3ea2-4a64-b260-03b47bdd8754',
  agentToken: 'cacf2af8-33cd-49d5-8956-b11dd46039b1',
  pollInterval: 5000,
  historyPollInterval: 30000,  // 每30秒补偿一次离线消息
};

const LOG_FILE = '/workspace/clone/agenthub_bridge.log';
const PID_FILE = '/workspace/clone/agenthub_bridge.pid';
const QUEUE_FILE = '/workspace/clone/bridge_queue.json';
const STATE_FILE = '/workspace/clone/bridge_state.json';

// ─── 日志 ───────────────────────────────────────────────
function log(msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

// ─── HTTP 工具 ───────────────────────────────────────────
function httpReq(method, url, headers, body) {
  return new Promise((resolve, reject) => {
    try {
      const u = new URL(url);
      const mod = u.protocol === 'https:' ? https : http;
      const opts = {
        hostname: u.hostname,
        port: u.port,
        path: u.pathname + u.search,
        method,
        headers: headers || {},
      };
      const req = mod.request(opts, res => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => resolve({ status: res.statusCode, body: d }));
      });
      req.on('error', reject);
      if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
      req.end();
    } catch (e) {
      reject(e);
    }
  });
}

// ─── 状态管理 ────────────────────────────────────────────
function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
  } catch (e) {}
  return { lastReadTime: Date.now(), processedIds: [] };
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// ─── 队列管理 ────────────────────────────────────────────
function enqueue(entry) {
  let queue = [];
  try {
    if (fs.existsSync(QUEUE_FILE)) queue = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
  } catch (e) {}
  queue.push({ ...entry, queuedAt: Date.now() });
  fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2));
  log(`📥 入队: ${entry.fromId} -> "${entry.content.substring(0, 60)}"`);
}

function readQueue() {
  try {
    if (fs.existsSync(QUEUE_FILE)) return JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
  } catch (e) {}
  return [];
}

function clearQueue() {
  try { fs.writeFileSync(QUEUE_FILE, '[]'); } catch (e) {}
}

// ─── REST: 获取离线消息历史 ─────────────────────────────
async function fetchOfflineMessages(sinceTime) {
  try {
    // 使用 before 参数获取时间点之后的消息
    const url = `${CONFIG.agentHubUrl}/api/messages/history?peerId=${CONFIG.agentId}&limit=50&before=${Date.now() + 1000}`;
    const res = await httpReq('GET', url, {
      'Authorization': `Bearer ${CONFIG.agentToken}`,
      'Content-Type': 'application/json',
    });
    if (res.status === 200) {
      const data = JSON.parse(res.body);
      const msgs = Array.isArray(data.messages) ? data.messages : [];
      // 过滤出在 sinceTime 之后的、发给 Clone-01 的消息
      return msgs.filter(m => {
        const t = new Date(m.createdAt).getTime();
        return t > sinceTime && m.toId === CONFIG.agentId;
      });
    }
  } catch (e) {
    log('获取离线消息失败: ' + e.message);
  }
  return [];
}

// ─── REST: AgentHub API 检查 ────────────────────────────
async function checkAgentHubHealth() {
  try {
    const res = await httpReq('GET', `${CONFIG.agentHubUrl}/api/agents/${CONFIG.agentId}`, {
      'Authorization': `Bearer ${CONFIG.agentToken}`,
    });
    if (res.status === 200) {
      const data = JSON.parse(res.body);
      log(`AgentHub 健康: Agent=${data.agent?.name}, status=${data.agent?.status}`);
      return data.agent;
    }
  } catch (e) {
    log('AgentHub 健康检查失败: ' + e.message);
  }
  return null;
}

// ─── Socket.IO 连接（作为 Clone-01） ───────────────────
let socket = null;
let isConnected = false;

function connectSocketIO() {
  return new Promise((resolve) => {
    log('🔌 正在连接 AgentHub Socket.IO...');
    
    socket = io(CONFIG.agentHubUrl, {
      path: CONFIG.wsPath,
      auth: { token: CONFIG.agentToken },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 3000,
      reconnectionAttempts: Infinity,
      timeout: 10000,
    });

    socket.on('connect', () => {
      log('✅ Socket.IO 已连接 (id=' + socket.id + ')');
      isConnected = true;
      resolve(true);
    });

    socket.on('disconnect', (reason) => {
      log('⚠️ Socket.IO 断开: ' + reason);
      isConnected = false;
    });

    socket.on('connect_error', (err) => {
      log('❌ Socket.IO 连接错误: ' + err.message);
      isConnected = false;
    });

    socket.on('auth_success', (data) => {
      log('🔐 认证成功: ' + JSON.stringify(data));
    });

    // ── 实时消息推送 ──
    socket.on('push.chat', (data) => {
      handleIncomingMessage(data, 'socket');
    });

    // ── 消息送达确认 ──
    socket.on('push.ack', (data) => {
      log(`✓ 消息已送达: msgId=${data.messageId}, ts=${new Date(data.timestamp).toISOString()}`);
    });

    // ── 好友状态变化 ──
    socket.on('push.friend_status', (data) => {
      log(`👤 好友状态: ${data.agentName} -> ${data.status}`);
    });

    // ── 收到错误 ──
    socket.on('error', (err) => {
      log('Socket.IO 错误: ' + JSON.stringify(err));
    });

    // 10秒超时
    setTimeout(() => {
      if (!isConnected) {
        log('⚠️ Socket.IO 连接超时（10s）');
        resolve(false);
      }
    }, 10000);
  });
}

// ─── 处理收到的消息 ─────────────────────────────────────
function handleIncomingMessage(data, source) {
  const msgId = data.messageId;
  const fromId = data.from?.agentId || data.fromId;
  const content = data.content;
  
  if (!msgId || !content) return;

  const state = loadState();
  if (state.processedIds.includes(msgId)) {
    log(`⏭️ 重复消息跳过: ${msgId}`);
    return;
  }

  log(`📩 [${source}] 收到消息 from=${fromId} msgId=${msgId}: "${content.substring(0, 80)}"`);

  // 写入队列（供主 OpenClaw 消费）
  enqueue({
    id: msgId,
    fromId,
    fromName: data.from?.agentName,
    content,
    timestamp: data.timestamp,
    source,
  });

  // 标记已处理
  state.processedIds.push(msgId);
  if (state.processedIds.length > 200) state.processedIds = state.processedIds.slice(-200);
  saveState(state);

  // 通过 Socket.IO 标记消息已读
  if (source === 'socket' && socket && isConnected) {
    socket.emit('message.read', { messageIds: [msgId] });
  }
}

// ─── 发送回复 ────────────────────────────────────────────
// 由主 OpenClaw 调用：写入 /workspace/clone/bridge_outbox.json
// Bridge 轮询检测并通过 Socket.IO 发送
const OUTBOX_FILE = '/workspace/clone/bridge_outbox.json';

async function processOutbox() {
  let outbox = [];
  try {
    if (fs.existsSync(OUTBOX_FILE)) outbox = JSON.parse(fs.readFileSync(OUTBOX_FILE, 'utf8'));
  } catch (e) {}
  if (outbox.length === 0) return;

  if (!socket || !isConnected) {
    log('⚠️ Socket.IO 未连接，暂不发送回复');
    return;
  }

  const remaining = [];
  for (const item of outbox) {
    try {
      const result = await sendChatMessage(item.toId, item.content);
      if (result) {
        log(`✓ 回复已发送 to=${item.toId}: "${item.content.substring(0, 60)}"`);
      } else {
        remaining.push(item);
      }
    } catch (e) {
      log('发送回复失败: ' + e.message);
      remaining.push(item);
    }
  }
  if (remaining.length > 0) {
    fs.writeFileSync(OUTBOX_FILE, JSON.stringify(remaining, null, 2));
  } else {
    try { fs.unlinkSync(OUTBOX_FILE); } catch (e) {}
  }
}

function sendChatMessage(toId, content) {
  return new Promise((resolve) => {
    if (!socket || !isConnected) { resolve(false); return; }
    socket.emit('chat', { to: toId, content }, (ack) => {
      if (ack && ack.ok) {
        resolve(true);
      } else {
        log('chat ack error: ' + JSON.stringify(ack));
        resolve(false);
      }
    });
    // 3秒超时
    setTimeout(() => resolve(false), 3000);
  });
}

// ─── 主循环 ─────────────────────────────────────────────
async function main() {
  log('==========================================');
  log('  AgentHub Bridge 启动');
  log('  AgentID: ' + CONFIG.agentId);
  log('  Socket.IO: ' + CONFIG.agentHubUrl + CONFIG.wsPath);
  log('  REST API: ' + CONFIG.agentHubUrl + '/api');
  log('  轮询间隔: ' + CONFIG.pollInterval + 'ms');
  log('==========================================');

  // 保存 PID
  fs.writeFileSync(PID_FILE, String(process.pid));
  log('PID: ' + process.pid);

  // 健康检查
  const agent = await checkAgentHubHealth();
  if (!agent) {
    log('❌ AgentHub 连接失败，请检查服务状态');
  }

  // Socket.IO 连接
  const connected = await connectSocketIO();
  if (!connected) {
    log('⚠️ Socket.IO 连接失败，将仅使用 REST 轮询模式');
  }

  const state = loadState();
  let tick = 0;

  // 主轮询循环
  while (true) {
    try {
      tick++;

      // 每 pollInterval ms: 处理发件箱（Socket.IO 回复）
      await processOutbox();

      // 如果 Socket.IO 未连接，使用 REST 补偿离线消息
      if (!isConnected && tick % 6 === 0) { // 约每30秒
        const offlineMsgs = await fetchOfflineMessages(state.lastReadTime);
        for (const msg of offlineMsgs) {
          handleIncomingMessage({
            messageId: msg.id,
            fromId: msg.fromId,
            from: { agentId: msg.fromId, agentName: 'unknown' },
            content: msg.content,
            timestamp: new Date(msg.createdAt).getTime(),
          }, 'rest');
          const t = new Date(msg.createdAt).getTime();
          if (t > state.lastReadTime) state.lastReadTime = t;
        }
        if (offlineMsgs.length > 0) saveState(state);
      }

      // 每分钟日志
      if (tick % 12 === 0) {
        const queueLen = readQueue().length;
        log(`💓 心跳 #${(tick/12)|0}min | Socket.IO=${isConnected} | 队列待处理=${queueLen} | 最后时间=${new Date(state.lastReadTime).toISOString()}`);
      }

    } catch (e) {
      log('轮询异常: ' + e.message);
    }

    await new Promise(r => setTimeout(r, CONFIG.pollInterval));
  }
}

// ─── 信号处理 ────────────────────────────────────────────
process.on('SIGTERM', () => { log('收到 SIGTERM，退出'); process.exit(0); });
process.on('SIGINT', () => { log('收到 SIGINT，退出'); process.exit(0); });

main().catch(e => { log('Fatal: ' + e.message); process.exit(1); });
