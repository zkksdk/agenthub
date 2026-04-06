import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../api/client';

export default function AdminUsers() {
  const qc = useQueryClient();
  const { data: owners } = useQuery({ queryKey: ['admin-owners'], queryFn: () => adminApi.owners().then(r => r.data.owners) });
  const [showCreate, setShowCreate] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const create = useMutation({
    mutationFn: () => adminApi.createUser(username, password),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-owners'] }); setShowCreate(false); setUsername(''); setPassword(''); }
  });

  const deleteUser = useMutation({ mutationFn: (id: string) => adminApi.deleteUser(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-owners'] }) });
  const deleteAgent = useMutation({ mutationFn: (id: string) => adminApi.deleteAgent(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-owners'] }) });

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: '#fff' }}>👥 用户管理</h1>
        <button onClick={() => setShowCreate(true)} style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: '#1a3a2a', color: '#4caf50', fontSize: 13, cursor: 'pointer' }}>+ 添加用户</button>
      </div>
      {(owners || []).map((o: any) => (
        <div key={o.userId} style={{ background: '#1a1d27', border: '1px solid #2a2d3a', borderRadius: 8, padding: 16, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <span style={{ fontSize: 15, fontWeight: 500, color: '#fff' }}>{o.username}</span>
              <span style={{ marginLeft: 8, fontSize: 11, padding: '2px 6px', borderRadius: 3, background: '#2a1a3a', color: '#ba68c8' }}>{o.status}</span>
            </div>
            <button onClick={() => deleteUser.mutate(o.userId)} style={{ padding: '4px 10px', borderRadius: 4, border: 'none', background: '#3a1a1a', color: '#f44336', fontSize: 12, cursor: 'pointer' }}>删除用户</button>
          </div>
          <div style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>Agent: {o.agentCount} 个 · 群: {o.groupCount} 个</div>
          {(o.agents || []).map((a: any) => (
            <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #1e2230' }}>
              <div style={{ fontSize: 13, color: '#aaa' }}>🤖 {a.name} <span style={{ color: '#555' }}>({a.status})</span></div>
              <button onClick={() => deleteAgent.mutate(a.id)} style={{ padding: '2px 8px', borderRadius: 4, border: 'none', background: '#3a1a1a', color: '#f44336', fontSize: 11, cursor: 'pointer' }}>删除</button>
            </div>
          ))}
        </div>
      ))}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#1a1d27', border: '1px solid #2a2d3a', borderRadius: 12, padding: 24, width: 360 }}>
            <h3 style={{ color: '#fff', marginBottom: 16 }}>添加用户</h3>
            <input value={username} onChange={e => setUsername(e.target.value)} placeholder="用户名" style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #2a2d3a', background: '#0f1117', color: '#e0e0e0', fontSize: 14, boxSizing: 'border-box', marginBottom: 12 }} />
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="密码" style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #2a2d3a', background: '#0f1117', color: '#e0e0e0', fontSize: 14, boxSizing: 'border-box', marginBottom: 16 }} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowCreate(false)} style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: '#2a2d3a', color: '#888', cursor: 'pointer' }}>取消</button>
              <button onClick={() => create.mutate()} disabled={!username || !password} style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: username && password ? '#1a3a2a' : '#2a2d3a', color: username && password ? '#4caf50' : '#555', cursor: username && password ? 'pointer' : 'not-allowed' }}>创建</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
