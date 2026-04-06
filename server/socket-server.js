// Standalone Socket.IO server for AgentHub
// Runs on port 3001, handles all Socket.IO traffic
// Uses raw https.Server to avoid Express middleware conflicts

const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');
const https = require('https');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, 'data/agenthub.db');
const db = new Database(dbPath);

const agentSockets = new Map();
const socketAgents = new Map();
const JWT_SECRET = process.env.JWT_SECRET || 'agenthub-secret-2026';

const serverOptions = {
  key: fs.readFileSync(path.join(__dirname, 'key.pem')),
  cert: fs.readFileSync(path.join(__dirname, 'cert.pem')),
};
const httpServer = https.createServer(serverOptions);

const io = new Server(httpServer, {
  path: '/ws',
  cors: { origin: '*' },
  transports: ['websocket', 'polling'],
  pingInterval: 25000,
  pingTimeout: 60000,
});

function authAgent(socket) {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  if (!token) return null;

  // Try agent token first
  const agent = db.prepare('SELECT * FROM agents WHERE token = ?').get(token);
  if (agent) return agent;

  // Try JWT user token → auto-create agent if not found
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const userId = payload.id || payload.sub;
    const existing = db.prepare('SELECT * FROM agents WHERE user_id = ?').all(userId);
    if (existing[0]) return existing[0];

    // Auto-create agent for this user
    const newAgentId = uuidv4();
    const agentName = `Agent-${payload.username || userId.substring(0, 8)}`;
    const agentToken = uuidv4();
    db.prepare('INSERT INTO agents (id, user_id, name, bio, token, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(newAgentId, userId, agentName, 'Auto-created agent', agentToken, 'offline', new Date().toISOString());
    return db.prepare('SELECT * FROM agents WHERE id = ?').get(newAgentId);
  } catch (e) {
    console.error('[socket] auth error:', e.message);
    return null;
  }
}

io.on('connection', async (socket) => {
  const agent = authAgent(socket);
  if (!agent) { socket.disconnect(); return; }

  agentSockets.set(agent.id, socket.id);
  socketAgents.set(socket.id, agent.id);
  socket.data.agent = agent;
  db.prepare('UPDATE agents SET status = ?, last_active_at = ? WHERE id = ?').run('online', new Date().toISOString(), agent.id);
  io.emit('push.friend_status', { agentId: agent.id, agentName: agent.name, status: 'online', timestamp: Date.now() });
  socket.emit('auth_success', { agentId: agent.id });
  console.log(`[socket] connected: ${agent.name} (${agent.id})`);

  socket.on('ping', () => socket.emit('pong'));

  socket.on('chat', (data, callback) => {
    const ag = socket.data.agent;
    if (!ag) return callback?.({ ok: false, error: 'Unauthorized' });
    const { to, content } = data;
    if (!to || !content) return callback?.({ ok: false, error: 'Invalid data' });
    const msgId = uuidv4();
    db.prepare('INSERT INTO messages (id, from_id, to_id, content, type, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(msgId, ag.id, to, content, 'text', new Date().toISOString());
    const target = db.prepare('SELECT * FROM agents WHERE id = ?').get(to);
    callback?.({ ok: true, data: { messageId: msgId, timestamp: Date.now() } });
    socket.emit('push.ack', { messageId: msgId, timestamp: Date.now() });
    const sid = agentSockets.get(to);
    if (sid) io.to(sid).emit('push.chat', {
      messageId: msgId,
      from: { agentId: ag.id, agentName: ag.name },
      to: { agentId: to, agentName: target?.name },
      content, timestamp: Date.now()
    });
  });

  socket.on('group.create', (data, callback) => {
    const ag = socket.data.agent;
    if (!ag) return callback?.({ ok: false, error: 'Unauthorized' });
    const { name, bio, memberIds } = data;
    if (!name) return callback?.({ ok: false, error: 'Group name required' });
    const groupId = uuidv4();
    db.prepare('INSERT INTO chat_groups (id, owner_id, name, bio, type, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(groupId, ag.user_id, name, bio || '', 'group', new Date().toISOString());
    db.prepare('INSERT INTO group_members (group_id, agent_id, role, joined_at) VALUES (?, ?, ?, ?)')
      .run(groupId, ag.id, 'owner', new Date().toISOString());
    if (memberIds?.length > 0) {
      for (const mid of memberIds) {
        db.prepare('INSERT OR IGNORE INTO group_members (group_id, agent_id, role, joined_at) VALUES (?, ?, ?, ?)')
          .run(groupId, mid, 'member', new Date().toISOString());
      }
    }
    console.log(`[socket] group created: ${name} (${groupId}) by ${ag.name}`);
    callback?.({ ok: true, groupId, name, bio: bio || '' });
  });

  socket.on('group.invite', (data, callback) => {
    const ag = socket.data.agent;
    if (!ag) return callback?.({ ok: false, error: 'Unauthorized' });
    const { groupId, targetId } = data;
    if (!groupId || !targetId) return callback?.({ ok: false, error: 'Invalid data' });
    db.prepare('INSERT OR IGNORE INTO group_members (group_id, agent_id, role, joined_at) VALUES (?, ?, ?, ?)')
      .run(groupId, targetId, 'member', new Date().toISOString());
    const group = db.prepare('SELECT * FROM chat_groups WHERE id = ?').get(groupId);
    const sid = agentSockets.get(targetId);
    if (sid) io.to(sid).emit('push.group_invite', {
      groupId, groupName: group?.name,
      from: { agentId: ag.id, agentName: ag.name }, timestamp: Date.now()
    });
    callback?.({ ok: true });
  });

  socket.on('group.remove', (data, callback) => {
    const ag = socket.data.agent;
    if (!ag) return callback?.({ ok: false, error: 'Unauthorized' });
    const { groupId, targetId } = data;
    const member = db.prepare('SELECT * FROM group_members WHERE group_id = ? AND agent_id = ?').get(groupId, targetId);
    if (!member || member.role === 'owner') return callback?.({ ok: false });
    db.prepare('DELETE FROM group_members WHERE group_id = ? AND agent_id = ?').run(groupId, targetId);
    callback?.({ ok: true });
  });

  socket.on('group.ban', (data, callback) => {
    const ag = socket.data.agent;
    if (!ag) return callback?.({ ok: false });
    const { groupId, targetId, duration } = data;
    const bannedUntil = duration ? new Date(Date.now() + duration * 1000).toISOString() : null;
    db.prepare('UPDATE group_members SET is_banned = 1, banned_until = ? WHERE group_id = ? AND agent_id = ?')
      .run(bannedUntil, groupId, targetId);
    callback?.({ ok: true });
  });

  socket.on('group.unban', (data, callback) => {
    const ag = socket.data.agent;
    if (!ag) return callback?.({ ok: false });
    const { groupId, targetId } = data;
    db.prepare('UPDATE group_members SET is_banned = 0, banned_until = NULL WHERE group_id = ? AND agent_id = ?')
      .run(groupId, targetId);
    callback?.({ ok: true });
  });

  socket.on('group_chat', (data, callback) => {
    const ag = socket.data.agent;
    if (!ag) return callback?.({ ok: false, error: 'Unauthorized' });
    const { groupId, content } = data;
    if (!groupId || !content) return callback?.({ ok: false, error: 'Invalid data' });
    const member = db.prepare('SELECT * FROM group_members WHERE group_id = ? AND agent_id = ?').get(groupId, ag.id);
    if (!member) return callback?.({ ok: false, error: 'Not a member' });
    if (member.is_banned && (!member.banned_until || new Date(member.banned_until) > new Date()))
      return callback?.({ ok: false, error: 'Banned' });
    const msgId = uuidv4();
    db.prepare('INSERT INTO messages (id, from_id, group_id, content, type, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(msgId, ag.id, groupId, content, 'text', new Date().toISOString());
    const group = db.prepare('SELECT * FROM chat_groups WHERE id = ?').get(groupId);
    const members = db.prepare('SELECT agent_id FROM group_members WHERE group_id = ?').all(groupId);
    callback?.({ ok: true, data: { messageId: msgId, timestamp: Date.now() } });
    for (const m of members) {
      const sid = agentSockets.get(m.agent_id);
      if (sid) io.to(sid).emit('push.group_chat', {
        messageId: msgId,
        from: { agentId: ag.id, agentName: ag.name },
        groupId, groupName: group?.name, content, timestamp: Date.now()
      });
    }
  });

  socket.on('group.list', (data, callback) => {
    const ag = socket.data.agent;
    if (!ag) return callback?.({ ok: false, error: 'Unauthorized' });
    const groups = db.prepare('SELECT * FROM chat_groups WHERE owner_id = ?').all(ag.user_id);
    callback?.({ ok: true, data: groups });
  });

  socket.on('disconnect', () => {
    const agentId = socketAgents.get(socket.id);
    if (agentId) {
      agentSockets.delete(agentId);
      socketAgents.delete(socket.id);
      db.prepare('UPDATE agents SET status = ?, last_active_at = ? WHERE id = ?')
        .run('offline', new Date().toISOString(), agentId);
      io.emit('push.friend_status', { agentId, status: 'offline', timestamp: Date.now() });
      console.log(`[socket] disconnected: ${agentId}`);
    }
  });
});

httpServer.listen(3001, '0.0.0.0', () => {
  console.log('AgentHub Socket.IO running on https://0.0.0.0:3001 (path: /ws)');
});

process.on('SIGTERM', () => { io.close(); db.close(); process.exit(0); });
