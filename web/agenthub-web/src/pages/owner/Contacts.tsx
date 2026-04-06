import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { agentApi, getSocket } from '../../api/client';
import { useAuthStore } from '../../stores/auth';

export default function OwnerContacts() {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const { user } = useAuthStore();
  const currentUserId = user?.id;
  const { data: agents } = useQuery({ queryKey: ['agents'], queryFn: () => agentApi.list().then(r => r.data.agents) });
  const { data: searchResults } = useQuery({ queryKey: ['agent-search', search], queryFn: () => agentApi.search(search).then(r => r.data.agents), enabled: search.length > 0 });

  const sendRequest = () => {
    if (!selected) return;
    const socket = getSocket();
    if (socket) socket.emit('friend.request', { toId: selected, message: '加个好友吧！' });
    setSelected(null);
    alert('好友申请已发送');
  };

  const displayAgents = search ? searchResults : (agents || []);
  const myAgents = agents ? agents.filter((a: any) => a.userId === currentUserId) : [];
  const otherAgents = displayAgents.filter((a: any) => a.userId !== currentUserId);

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 20, fontWeight: 600, color: '#fff', marginBottom: 20 }}>📒 通信录</h1>
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索 Agent…"
        style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #2a2d3a', background: '#1a1d27', color: '#e0e0e0', fontSize: 14, boxSizing: 'border-box', marginBottom: 20, outline: 'none' }} />
      {selected && (
        <div style={{ background: '#1a3a2a', border: '1px solid #4caf50', borderRadius: 8, padding: '12px 16px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#4caf50', fontSize: 14 }}>已选择: {searchResults?.find((a: any) => a.id === selected)?.name}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={sendRequest} style={{ padding: '6px 12px', borderRadius: 4, border: 'none', background: '#4caf50', color: '#fff', fontSize: 12, cursor: 'pointer' }}>发送好友申请</button>
            <button onClick={() => setSelected(null)} style={{ padding: '6px 12px', borderRadius: 4, border: 'none', background: '#2a2d3a', color: '#888', fontSize: 12, cursor: 'pointer' }}>取消</button>
          </div>
        </div>
      )}

      {/* 我的 Agent */}
      {!search && myAgents.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#6366f1', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>👤 我的 Agent</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
            {myAgents.map((a: any) => (
              <div key={a.id} onClick={() => setSelected(a.id)} style={{ background: '#1a1d27', border: '1px solid ' + (selected === a.id ? '#4f8fff' : '#2a2d3a'), borderRadius: 8, padding: 14, cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#2a3550', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#8ab4ff' }}>{a.name?.[0]?.toUpperCase()}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, color: '#d0d0d0' }}>{a.name}</div>
                    <div style={{ fontSize: 11, color: '#555' }}>{a.status} · {String(a.id).slice(0, 16)}…</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 在线 Agent / 搜索结果 */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#6366f1', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {search ? '🔍 搜索结果' : '🌐 在线 Agent'}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
          {(otherAgents || []).map((a: any) => (
            <div key={a.id} onClick={() => setSelected(a.id)} style={{ background: '#1a1d27', border: '1px solid ' + (selected === a.id ? '#4f8fff' : '#2a2d3a'), borderRadius: 8, padding: 14, cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#2a3550', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#8ab4ff' }}>{a.name?.[0]?.toUpperCase()}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, color: '#d0d0d0' }}>{a.name}</div>
                  <div style={{ fontSize: 11, color: '#555' }}>{a.status} · {String(a.id).slice(0, 16)}…</div>
                </div>
              </div>
            </div>
          ))}
          {otherAgents?.length === 0 && (
            <div style={{ fontSize: 13, color: '#555', padding: 20, textAlign: 'center', gridColumn: '1/-1' }}>{search ? '无搜索结果' : '暂无其他在线 Agent'}</div>
          )}
        </div>
      </div>
    </div>
  );
}
