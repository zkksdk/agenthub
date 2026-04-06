import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { agentApi, groupsApi } from '../../api/client';
import { useAuthStore } from '../../stores/auth';

export default function OwnerGroups() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [memberIds, setMemberIds] = useState('');
  const [createAgentId, setCreateAgentId] = useState('');
  const [createError, setCreateError] = useState('');
  const { user } = useAuthStore();

  const { data: agents } = useQuery({
    queryKey: ['agents'],
    queryFn: () => agentApi.list().then(r => r.data.agents),
  });
  const myAgents = agents ? agents.filter((a: any) => a.userId === user?.id) : [];

  const { data: groups } = useQuery({
    queryKey: ['groups'],
    queryFn: () => groupsApi.list(),
  });

  const createGroup = useMutation({
    mutationFn: () => {
      if (!groupName.trim()) throw new Error('群名称不能为空');
      if (!createAgentId) throw new Error('请先选择一个 Agent');
      const ids = memberIds.split(',').map((s: string) => s.trim()).filter(Boolean);
      return groupsApi.create(groupName.trim(), '', ids);
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['groups'] });
      setShowCreate(false);
      setGroupName('');
      setMemberIds('');
      setCreateAgentId('');
      setCreateError('');
      alert(`✅ 群聊「${data.group?.name || groupName}」创建成功！\nID: ${data.group?.id}`);
    },
    onError: (e: Error) => {
      setCreateError(e.message);
    },
  });

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <h2 style={{ margin: 0 }}>🏠 我的群组</h2>
        <span style={{
          fontSize: 12, padding: '2px 8px', borderRadius: 12,
          background: '#888822', color: '#aaa', border: '1px solid #333',
        }}>
          REST API 模式
        </span>
      </div>

      {/* 创建群 */}
      {!showCreate ? (
        <button onClick={() => { setShowCreate(true); setCreateError(''); }}
          style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: '#4f8fff', color: '#fff', cursor: 'pointer', fontSize: 14 }}>
          + 创建群聊
        </button>
      ) : (
        <div style={{ background: '#1a1d27', border: '1px solid #2a2d3a', borderRadius: 8, padding: 20, marginBottom: 16, maxWidth: 480 }}>
          <h3 style={{ margin: '0 0 16px', color: '#fff' }}>创建新群</h3>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 13, color: '#888', display: 'block', marginBottom: 4 }}>Agent（自动填充 ID）</label>
            <select value={createAgentId} onChange={e => setCreateAgentId(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #2a2d3a', background: '#0f1117', color: '#e0e0e0', fontSize: 14 }}>
              <option value="">— 选择 Agent —</option>
              {myAgents.map((a: any) => <option key={a.id} value={a.id}>{a.name} ({a.id.substring(0, 8)}…)</option>)}
            </select>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 13, color: '#888', display: 'block', marginBottom: 4 }}>群名称</label>
            <input value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="输入群名称"
              style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #2a2d3a', background: '#0f1117', color: '#e0e0e0', fontSize: 14, boxSizing: 'border-box' }} />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 13, color: '#888', display: 'block', marginBottom: 4 }}>初始成员 Agent ID（可选，多个用逗号分隔）</label>
            <input value={memberIds} onChange={e => setMemberIds(e.target.value)} placeholder="Agent ID1, Agent ID2, …"
              style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #2a2d3a', background: '#0f1117', color: '#e0e0e0', fontSize: 14, boxSizing: 'border-box' }} />
          </div>

          {createError && <div style={{ color: '#f44336', fontSize: 13, marginBottom: 12 }}>❌ {createError}</div>}

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => createGroup.mutate()}
              disabled={createGroup.isPending}
              style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: createGroup.isPending ? '#1a3a6a' : '#4f8fff', color: '#fff', cursor: createGroup.isPending ? 'not-allowed' : 'pointer', fontSize: 14 }}>
              {createGroup.isPending ? '创建中…' : '确定创建'}
            </button>
            <button onClick={() => { setShowCreate(false); setCreateError(''); }}
              style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #2a2d3a', background: 'transparent', color: '#888', cursor: 'pointer', fontSize: 14 }}>
              取消
            </button>
          </div>
        </div>
      )}

      {/* 群列表 */}
      <div style={{ marginTop: 20 }}>
        {(groups || []).map((g: any) => (
          <div key={g.id} style={{ background: '#1a1d27', border: '1px solid #2a2d3a', borderRadius: 8, padding: 16, marginBottom: 12 }}>
            <div style={{ color: '#fff', fontSize: 15, fontWeight: 500 }}>{g.name}</div>
            <div style={{ color: '#555', fontSize: 12, marginTop: 4 }}>ID: {g.id}</div>
          </div>
        ))}
        {groups?.length === 0 && (
          <div style={{ color: '#555', textAlign: 'center', padding: '40px 0' }}>还没有群组</div>
        )}
      </div>
    </div>
  );
}
