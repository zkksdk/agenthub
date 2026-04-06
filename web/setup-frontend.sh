#!/bin/bash
# Use the server's public URL as the API base
VITE_API_URL=""  # 空 = 使用相对路径（服务端代理模式）

cat > /workspace/agenthub/web/agenthub-web/src/api/client.ts << 'EOF'
import axios from 'axios';
import { io, Socket } from 'socket.io-client';

const API_BASE = (typeof window !== 'undefined' && (window as any)._API_URL) 
  || import.meta.env.VITE_API_URL 
  || '';  // 空 = 同源 /api/

export const api = axios.create({
  baseURL: API_BASE || '/api',
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

export function connectSocket(token: string) {
  if (socket) socket.disconnect();
  const wsBase = (typeof window !== 'undefined' && (window as any)._WS_URL)
    || import.meta.env.VITE_WS_URL
    || (window.location.protocol === 'https:' ? 'wss://' : 'ws://') + window.location.host + '/ws';
  socket = io(wsBase, { auth: { token }, path: '/ws', transports: ['websocket', 'polling'], reconnectionAttempts: 5 });
  return socket;
}

export function getSocket() { return socket; }
export function disconnectSocket() { if (socket) { socket.disconnect(); socket = null; } }

export function setAuthToken(token: string) {
  localStorage.setItem('agenthub_token', token);
  api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
}

export function clearAuth() {
  localStorage.removeItem('agenthub_token');
  delete api.defaults.headers.common['Authorization'];
}

export const authApi = {
  login: (userId: string, password: string) => api.post('/auth/login', { userId, password }),
  signup: (username: string, password: string) => api.post('/auth/signup', { username, password }),
  me: () => api.get('/auth/me'),
};

export const agentApi = {
  list: () => api.get('/agents'),
  online: () => api.get('/agents/online'),
  search: (kw: string) => api.get('/agents/search', { params: { keyword: kw } }),
  register: (userId: string, name: string, bio: string) => api.post('/agents/register', { userId, name, bio }),
  info: (id: string) => api.get('/agents/' + id),
  update: (id: string, data: { name?: string; bio?: string; avatar?: string }) => api.patch('/agents/' + id, data),
  delete: (id: string) => api.delete('/agents/' + id),
};

export const msgApi = {
  history: (peerId?: string, groupId?: string, limit = 50) =>
    api.get('/messages/history', { params: { peerId, groupId, limit } }),
};

export const adminApi = {
  stats: () => api.get('/admin/stats'),
  owners: () => api.get('/admin/owners'),
  createUser: (username: string, password: string) => api.post('/admin/users', { username, password }),
  deleteUser: (id: string) => api.delete('/admin/users/' + id),
  deleteAgent: (id: string) => api.delete('/admin/agents/' + id),
  searchMsgs: (kw: string) => api.get('/admin/messages/search', { params: { keyword: kw } }),
};
EOF

# Build with empty API URL (will use /api relative)
cd /workspace/agenthub/web/agenthub-web
VITE_API_URL="" npm run build 2>&1 | tail -4
echo "BUILD_DONE"
