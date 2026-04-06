#!/bin/bash
DEST=/workspace/agenthub/web/agenthub-web/src

# Fix Audit.tsx - remove unused useQuery
sed -i "s/import { useState } from 'react';\nimport { useQuery } from '@tanstack\/react-query';/import { useState } from 'react';/" $DEST/pages/admin/Audit.tsx 2>/dev/null || true
grep -l "useQuery" $DEST/pages/owner/Contacts.tsx $DEST/pages/owner/GroupManage.tsx 2>/dev/null

# Fix Contacts.tsx - remove unused imports
cat > $DEST/pages/owner/Contacts.tsx << 'EOF'
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { agentApi, getSocket } from '../../api/client';

export default function OwnerContacts() {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
        {(displayAgents || []).map((a: any) => (
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
  );
}
EOF

# Fix GroupManage.tsx - remove unused imports
cat > $DEST/pages/owner/GroupManage.tsx << 'EOF'
import { useState } from 'react';
import { getSocket } from '../../api/client';

export default function OwnerGroups() {
  const [groupName, setGroupName] = useState('');
  const [memberIds, setMemberIds] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const socket = getSocket();
  const createGroup = () => {
    if (!groupName || !socket) return;
    const ids = memberIds.split(',').map((s: string) => s.trim()).filter(Boolean);
    (socket as any).emit('group.create', { name: groupName, memberIds: ids });
    setShowCreate(false);
    setGroupName('');
    setMemberIds('');
  };
  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: '#fff' }}>👥 群聊管理</h1>
        <button onClick={() => setShowCreate(true)} style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: '#1a3a2a', color: '#4caf50', fontSize: 13, cursor: 'pointer' }}>+ 创建群聊</button>
      </div>
      <div style={{ color: '#555', fontSize: 14 }}>创建群聊后，可通过 AgentWx Channel 在 OpenClaw 中管理群成员</div>
      {showCreate && (
        <div style={{ marginTop: 16, background: '#1a1d27', border: '1px solid #2a2d3a', borderRadius: 8, padding: 20 }}>
          <h3 style={{ color: '#fff', marginBottom: 16 }}>创建新群聊</h3>
          <input value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="群名称"
            style={{ width: '100%', padding: '10px', borderRadius: 6, border: '1px solid #2a2d3a', background: '#0f1117', color: '#e0e0e0', fontSize: 14, boxSizing: 'border-box', marginBottom: 12 }} />
          <input value={memberIds} onChange={e => setMemberIds(e.target.value)} placeholder="初始成员 ID（逗号分隔，可留空）"
            style={{ width: '100%', padding: '10px', borderRadius: 6, border: '1px solid #2a2d3a', background: '#0f1117', color: '#e0e0e0', fontSize: 14, boxSizing: 'border-box', marginBottom: 16 }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={createGroup} style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: '#1a3a2a', color: '#4caf50', cursor: 'pointer' }}>创建</button>
            <button onClick={() => setShowCreate(false)} style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: '#2a2d3a', color: '#888', cursor: 'pointer' }}>取消</button>
          </div>
        </div>
      )}
    </div>
  );
}
EOF

echo "Frontend fixes done"
