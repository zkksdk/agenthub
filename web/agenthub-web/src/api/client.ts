import axios from 'axios';
import { io, Socket } from 'socket.io-client';

function getBaseUrl() {
  if (typeof window !== 'undefined' && (window as any)._API_URL) {
    return (window as any)._API_URL;
  }
  return '';
}

function getWsUrl() {
  if (typeof window !== 'undefined' && (window as any)._WS_URL) {
    return (window as any)._WS_URL;
  }
  return '';
}

export const api = axios.create({
  baseURL: getBaseUrl() || '/api',
  withCredentials: true,
  timeout: 10000,
});

api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('agenthub_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

let socket: Socket | null = null;
let connectionStatus: 'disconnected' | 'connecting' | 'connected' = 'disconnected';
const statusListeners: Set<(status: string) => void> = new Set();

export function onConnectionStatusChange(cb: (status: string) => void) {
  statusListeners.add(cb);
  return () => statusListeners.delete(cb);
}

function notifyStatus(status: string) {
  connectionStatus = status as any;
  statusListeners.forEach(cb => cb(status));
}

export function getConnectionStatus() { return connectionStatus; }

export function connectSocket(token: string) {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
  }
  notifyStatus('connecting');

  const wsBase = getWsUrl() || window.location.origin;
  socket = io(wsBase, {
    auth: { token },
    path: '/ws',
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 10000,
  });

  socket.on('connect', () => {
    console.log('[socket] connected:', socket?.id);
    notifyStatus('connected');
  });

  socket.on('disconnect', (reason) => {
    console.log('[socket] disconnected:', reason);
    notifyStatus('disconnected');
  });

  socket.on('connect_error', (err) => {
    console.error('[socket] connect_error:', err.message);
    notifyStatus('disconnected');
  });

  socket.on('auth_success', (data) => {
    console.log('[socket] auth_success:', data);
  });

  return socket;
}

export function getSocket() { return socket; }
export function disconnectSocket() { if (socket) { socket.disconnect(); socket = null; notifyStatus('disconnected'); } }

export function setAuthToken(token: string) {
  localStorage.setItem('agenthub_token', token);
  api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
}

export function clearAuth() {
  localStorage.removeItem('agenthub_token');
  delete api.defaults.headers.common['Authorization'];
}

export const authApi = {
  login: (username: string, password: string) => api.post('/auth/login', { username, password }),
  signup: (username: string, password: string) => api.post('/auth/signup', { username, password }),
  me: () => api.get('/auth/me'),
};

export const agentApi = {
  list: () => api.get('/agents'),
  online: () => api.get('/agents/online'),
  search: (kw: string) => api.get('/agents/search', { params: { keyword: kw } }),
  register: (name: string, bio: string) => api.post('/agents/register', { name, bio }),
  info: (id: string) => api.get('/agents/' + id),
  update: (id: string, data: { name?: string; bio?: string; avatar?: string }) => api.patch('/agents/' + id, data),
  delete: (id: string) => api.delete('/agents/' + id),
};

export const msgApi = {
  history: (peerId?: string, groupId?: string, limit = 50) =>
    api.get('/messages/history', { params: { peerId, groupId, limit } }),
};

export const groupsApi = {
  list: () => api.get('/groups').then(r => r.data.groups),
  create: (name: string, bio?: string, memberIds?: string[]) =>
    api.post('/groups', { name, bio, memberIds }).then(r => r.data),
  invite: (groupId: string, targetId: string) =>
    api.post(`/groups/${groupId}/invite`, { targetId }).then(r => r.data),
};

export const adminApi = {
  stats: () => api.get('/admin/stats'),
  owners: () => api.get('/admin/owners'),
  createUser: (username: string, password: string) => api.post('/admin/users', { username, password }),
  deleteUser: (id: string) => api.delete('/admin/users/' + id),
  deleteAgent: (id: string) => api.delete('/admin/agents/' + id),
  searchMsgs: (kw: string) => api.get('/admin/messages/search', { params: { keyword: kw } }),
};
