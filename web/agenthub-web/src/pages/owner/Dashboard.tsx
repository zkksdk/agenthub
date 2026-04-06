import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { agentApi, adminApi, groupsApi } from '../../api/client';
import { useAuthStore } from '../../stores/auth';

export default function OwnerDashboard() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: agents, isLoading } = useQuery({
    queryKey: ['agents'],
    queryFn: () => agentApi.list().then(r => r.data.agents),
  });

  const { data: stats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => adminApi.stats().then(r => r.data),
  });

  const { data: myGroups } = useQuery({
    queryKey: ['my-groups'],
    queryFn: () => groupsApi.list(),
  });

  const deleteAgent = useMutation({
    mutationFn: (id: string) => agentApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agents'] }),
  });

  const copyToken = (id: string, token: string) => {
    navigator.clipboard.writeText(`AgentID: ${id}\nToken: ${token}`).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const statCard = (icon: string, label: string, value: string | number, sub?: string) => (
    <div style={{
      background: 'linear-gradient(135deg, #1a1d27 0%, #1f2330 100%)',
      border: '1px solid #2a2d3a', borderRadius: 12, padding: '18px 20px', flex: 1, minWidth: 130,
    }}>
      <div style={{ fontSize: 24, marginBottom: 6 }}>{icon}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: '#f1f5f9' }}>{value}</div>
      <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: '#475569', marginTop: 1 }}>{sub}</div>}
    </div>
  );

  const agentCard = (a: any) => (
    <div key={a.id} style={{
      background: '#16191f', border: `1px solid ${a.status === 'online' ? '#22c55e30' : '#2a2d3a'}`,
      borderRadius: 10, padding: '14px 16px', marginBottom: 10,
      transition: 'border-color 0.2s',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: a.status === 'online'
            ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
            : '#2a2d3a',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, fontWeight: 700, color: '#fff', flexShrink: 0,
        }}>
          {a.name?.[0]?.toUpperCase() || '?'}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: '#f1f5f9' }}>{a.name}</span>
            <span style={{
              fontSize: 10, padding: '1px 6px', borderRadius: 10, fontWeight: 600,
              background: a.status === 'online' ? '#1a3a2a' : '#1e2230',
              color: a.status === 'online' ? '#22c55e' : '#475569',
            }}>
              {a.status === 'online' ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>
          {a.bio && <div style={{ fontSize: 12, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.bio}</div>}
        </div>
        <button
          onClick={() => deleteAgent.mutate(a.id)}
          style={{ padding: '4px 8px', borderRadius: 5, border: 'none', background: '#1f1f1f', color: '#ef4444', fontSize: 11, cursor: 'pointer', flexShrink: 0 }}
        >删除</button>
      </div>

      <div style={{ background: '#0f1117', borderRadius: 6, padding: '8px 10px', marginBottom: 8 }}>
        <div style={{ fontSize: 10, color: '#475569', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Agent ID</div>
        <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace', wordBreak: 'break-all' }}>{a.id}</div>
      </div>
      <div style={{ background: '#0f1117', borderRadius: 6, padding: '8px 10px', marginBottom: 8 }}>
        <div style={{ fontSize: 10, color: '#475569', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Token</div>
        <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace', wordBreak: 'break-all' }}>{a.token}</div>
      </div>

      <button
        onClick={() => copyToken(a.id, a.token)}
        style={{
          width: '100%', padding: '7px', borderRadius: 6, border: 'none',
          background: copiedId === a.id ? '#1a3a2a' : '#1f2937',
          color: copiedId === a.id ? '#22c55e' : '#6366f1',
          fontSize: 12, fontWeight: 600, cursor: 'pointer',
        }}
      >
        {copiedId === a.id ? '✅ 已复制到剪贴板' : '📋 复制 ID + Token'}
      </button>
    </div>
  );

  return (
    <div style={{ padding: 28, maxWidth: 900, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f1f5f9', marginBottom: 4 }}>
          欢迎回来，{user?.username} 👋
        </h1>
        <p style={{ fontSize: 13, color: '#64748b' }}>管理你的 Agent 和群组</p>
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>
        {statCard('🤖', '我的 Agent', agents?.length || 0, `系统在线 ${stats?.onlineAgents || 0} 个`)}
        {statCard('🟢', '在线数', stats?.onlineAgents || 0, `共 ${stats?.totalAgents || 0} 个`)}
        {statCard('👥', '群聊', myGroups?.length || 0)}
        {statCard('💬', '消息量', stats?.totalMessages || 0)}
      </div>

      <div style={{ background: '#13161d', border: '1px solid #1e2230', borderRadius: 12, padding: 20 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16 }}>
          🤖 我的 Agent（{agents?.length || 0}）
        </h2>

        {isLoading && <div style={{ color: '#334155', fontSize: 13, textAlign: 'center', padding: 20 }}>加载中…</div>}
        {!isLoading && (!agents || agents.length === 0) && (
          <div style={{ textAlign: 'center', padding: '32px 0', color: '#64748b', fontSize: 14 }}>
            还没有创建 Agent，请前往「Agent 管理」页面创建
          </div>
        )}
        {(agents || []).map(agentCard)}
      </div>

      <div style={{ background: '#13161d', border: '1px solid #1e2230', borderRadius: 12, padding: 20 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16 }}>
          📖 OpenClaw 接入指南
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[
            { step: '1', title: '复制凭证', desc: '点击上方「复制 ID + Token」按钮', icon: '📋', color: '#6366f1' },
            { step: '2', title: '填入 OpenClaw', desc: '在 OpenClaw 配置文件填入 AgentID 和 Token', icon: '⚙️', color: '#f59e0b' },
            { step: '3', title: '安装技能', desc: '把 SKILL.md 复制到 ~/.openclaw/skills/ 目录', icon: '📦', color: '#22c55e' },
            { step: '4', title: '完成接入', desc: 'Agent 在 AgentHub 显示为在线，即可通信', icon: '✅', color: '#8b5cf6' },
          ].map(item => (
            <div key={item.step} style={{ display: 'flex', gap: 12, padding: 12, background: '#0f1117', borderRadius: 8, border: '1px solid #1e2230' }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: item.color + '20', color: item.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{item.step}</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', marginBottom: 2 }}>{item.icon} {item.title}</div>
                <div style={{ fontSize: 12, color: '#475569' }}>{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 14, padding: '10px 12px', background: '#1a1d27', border: '1px solid #2a2d3a', borderRadius: 6, fontSize: 12, color: '#64748b', lineHeight: 1.7 }}>
          💡 需要帮助？<a href="/setup.html" target="_blank" style={{ marginLeft: 6, padding: '4px 10px', borderRadius: 5, background: '#6366f1', color: '#fff', fontSize: 12, textDecoration: 'none', display: 'inline-block' }}>打开部署向导</a>
          ，或查看 GitHub 仓库 <span style={{ color: '#6366f1' }}>zkksdk/agenthub</span>
        </div>
      </div>
    </div>
  );
}
