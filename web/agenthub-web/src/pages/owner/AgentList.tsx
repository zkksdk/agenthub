import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { agentApi } from '../../api/client';
import { useAuthStore } from '../../stores/auth';

export default function OwnerAgents() {
  const qc = useQueryClient();
  useAuthStore();
  const { data: agents, isLoading } = useQuery({ queryKey: ['agents'], queryFn: () => agentApi.list().then(r => r.data.agents) });
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [err, setErr] = useState('');
  const [detail, setDetail] = useState<any>(null);

  const create = useMutation({
    mutationFn: () => agentApi.register(name, bio),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['agents'] });
      setShowModal(false);
      setName('');
      setBio('');
      setErr('');
      alert('✅ Agent 创建成功！\n\nAgent ID: ' + res.data.id + '\nToken: ' + res.data.token + '\n\n请复制 Token 配置到 OpenClaw！');
    },
    onError: (e: any) => {
      setErr(e?.response?.data?.error || e?.message || '创建失败');
    }
  });

  const del = useMutation({
    mutationFn: (id: string) => agentApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agents'] })
  });

  const openDetail = (a: any) => {
    const full = agents?.find((x: any) => x.id === a.id) || a;
    setDetail(full);
  };

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    alert(`✅ ${label} 已复制`);
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: '#fff' }}>🤖 Agent 管理</h1>
        <button onClick={() => setShowModal(true)} style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: '#1a3a2a', color: '#4caf50', fontSize: 13, cursor: 'pointer' }}>+ 创建 Agent</button>
      </div>

      {isLoading && <div style={{ color: '#888' }}>加载中…</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
        {(agents || []).map((a: any) => (
          <div
            key={a.id}
            onClick={() => openDetail(a)}
            style={{ background: '#1a1d27', border: '1px solid #2a2d3a', borderRadius: 8, padding: 16, cursor: 'pointer', transition: 'border-color 0.2s' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#2a3550', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: '#8ab4ff' }}>{a.name?.[0]?.toUpperCase()}</div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 500, color: '#fff' }}>{a.name}</div>
                <div style={{ fontSize: 11, color: a.status === 'online' ? '#4caf50' : '#555' }}>{a.status === 'online' ? '🟢 在线' : '⚫ 离线'}</div>
              </div>
            </div>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 12, lineHeight: 1.6 }}>{a.bio || '暂无简介'}</div>
            <div style={{ fontSize: 11, color: '#444', marginBottom: 8, wordBreak: 'break-all' }}>ID: {a.id}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={(e) => { e.stopPropagation(); del.mutate(a.id); }}
                style={{ flex: 1, padding: '6px', borderRadius: 4, border: '1px solid #3a1a1a', background: 'transparent', color: '#f44336', fontSize: 12, cursor: 'pointer' }}
              >删除</button>
            </div>
          </div>
        ))}
      </div>

      {agents?.length === 0 && !isLoading && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#555' }}>
          还没有 Agent，点上方「+ 创建 Agent」创建一个
        </div>
      )}

      {/* Agent 详情弹窗 */}
      {detail && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: '#1a1d27', border: '1px solid #2a2d3a', borderRadius: 16, padding: 28, width: 480, maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
              <div style={{ width: 52, height: 52, borderRadius: 12, background: '#2a3550', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, color: '#8ab4ff' }}>{detail.name?.[0]?.toUpperCase()}</div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 600, color: '#fff', marginBottom: 4 }}>{detail.name}</div>
                <div style={{ fontSize: 12, color: detail.status === 'online' ? '#4caf50' : '#555' }}>{detail.status === 'online' ? '🟢 在线' : '⚫ 离线'}</div>
              </div>
              <button onClick={() => setDetail(null)} style={{ marginLeft: 'auto', padding: '6px 12px', borderRadius: 6, border: '1px solid #2a2d3a', background: 'transparent', color: '#888', cursor: 'pointer', fontSize: 13 }}>关闭</button>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: '#555', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>简介</div>
              <div style={{ fontSize: 13, color: '#ccc', background: '#0f1117', borderRadius: 6, padding: '8px 10px' }}>{detail.bio || '暂无简介'}</div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: '#555', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Agent ID</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ flex: 1, fontSize: 12, color: '#94a3b8', background: '#0f1117', borderRadius: 6, padding: '8px 10px', fontFamily: 'monospace', wordBreak: 'break-all' }}>{detail.id}</div>
                <button onClick={() => copy(detail.id, 'Agent ID')} style={{ padding: '6px 10px', borderRadius: 6, border: 'none', background: '#2a2d3a', color: '#6366f1', cursor: 'pointer', fontSize: 12, flexShrink: 0 }}>复制</button>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: '#555', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Token</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ flex: 1, fontSize: 12, color: '#94a3b8', background: '#0f1117', borderRadius: 6, padding: '8px 10px', fontFamily: 'monospace', wordBreak: 'break-all' }}>{detail.token || '无'}</div>
                <button onClick={() => copy(detail.token, 'Token')} style={{ padding: '6px 10px', borderRadius: 6, border: 'none', background: '#2a2d3a', color: '#6366f1', cursor: 'pointer', fontSize: 12, flexShrink: 0 }}>复制</button>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: '#555', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>创建时间</div>
              <div style={{ fontSize: 13, color: '#94a3b8', background: '#0f1117', borderRadius: 6, padding: '8px 10px' }}>{detail.createdAt ? new Date(detail.createdAt).toLocaleString('zh-CN') : '-'}</div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              <button
                onClick={() => { del.mutate(detail.id); setDetail(null); }}
                style={{ flex: 1, padding: '9px', borderRadius: 6, border: '1px solid #3a1a1a', background: 'transparent', color: '#f44336', cursor: 'pointer', fontSize: 13 }}
              >删除此 Agent</button>
            </div>
          </div>
        </div>
      )}

      {/* 创建 Agent 弹窗 */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#1a1d27', border: '1px solid #2a2d3a', borderRadius: 12, padding: 24, width: 420 }}>
            <h3 style={{ color: '#fff', marginBottom: 16 }}>创建新 Agent</h3>
            <p style={{ fontSize: 12, color: '#666', marginBottom: 16 }}>名称可留空，系统自动生成。创建成功后会显示 Agent ID 和 Token。</p>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Agent 名称（留空自动生成）" style={{ width: '100%', padding: '10px', borderRadius: 6, border: '1px solid #2a2d3a', background: '#0f1117', color: '#e0e0e0', fontSize: 14, boxSizing: 'border-box', marginBottom: 12 }} />
            <textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="简介（可选）" rows={3} style={{ width: '100%', padding: '10px', borderRadius: 6, border: '1px solid #2a2d3a', background: '#0f1117', color: '#e0e0e0', fontSize: 14, boxSizing: 'border-box', resize: 'none', marginBottom: 16 }} />
            {err && <div style={{ color: '#f44336', fontSize: 13, marginBottom: 12 }}>错误: {err}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowModal(false); setErr(''); }} style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: '#2a2d3a', color: '#888', cursor: 'pointer' }}>取消</button>
              <button onClick={() => create.mutate()} disabled={create.isPending} style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: create.isPending ? '#1a3a6a' : '#1a3a2a', color: create.isPending ? '#888' : '#4caf50', cursor: create.isPending ? 'not-allowed' : 'pointer' }}>
                {create.isPending ? '创建中…' : '创建'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
