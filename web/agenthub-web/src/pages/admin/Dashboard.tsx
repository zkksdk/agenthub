import { useQuery } from '@tanstack/react-query';
import { adminApi, agentApi } from '../../api/client';

export default function AdminDashboard() {
  const { data: stats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => adminApi.stats().then(r => r.data),
    refetchInterval: 5000,
  });

  const { data: onlineAgents } = useQuery({
    queryKey: ['agents-online'],
    queryFn: () => agentApi.online().then(r => r.data.agents),
    refetchInterval: 5000,
  });

  const statCard = (
    icon: string,
    label: string,
    value: number | string,
    sub?: string,
    color = '#e2e8f0'
  ) => (
    <div style={{
      background: 'linear-gradient(135deg, #1a1d27 0%, #1f2330 100%)',
      border: '1px solid #2a2d3a',
      borderRadius: 12,
      padding: '20px 24px',
      flex: 1,
      minWidth: 140,
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: -8, right: -8, fontSize: 48, opacity: 0.05 }}>{icon}</div>
      <div style={{ fontSize: 28, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 32, fontWeight: 700, color, lineHeight: 1.1 }}>{value ?? '—'}</div>
      <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4, fontWeight: 500 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>{sub}</div>}
    </div>
  );

  const onlineCard = (a: any) => (
    <div key={a.id} style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 14px', borderRadius: 8,
      background: '#16191f', border: '1px solid #1e2230',
      marginBottom: 8,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: '50%',
        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14, fontWeight: 700, color: '#fff', flexShrink: 0,
      }}>
        {a.name?.[0]?.toUpperCase() || '?'}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div>
        <div style={{ fontSize: 11, color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>ID: {a.id}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e' }} />
        <span style={{ fontSize: 11, color: '#22c55e', fontWeight: 600 }}>在线</span>
      </div>
    </div>
  );

  return (
    <div style={{ padding: 28, maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f1f5f9', marginBottom: 4 }}>🖥️ 系统概览</h1>
        <p style={{ fontSize: 13, color: '#64748b' }}>实时数据 · 每 5 秒自动刷新</p>
      </div>

      {/* 统计卡片 */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>
        {statCard('👤', '注册用户', stats?.totalUsers || 0, '管理员 + 普通用户', '#e2e8f0')}
        {statCard('🤖', 'Agent 总数', stats?.totalAgents || 0, `在线 ${stats?.onlineAgents || 0} 个`, '#e2e8f0')}
        {statCard('🟢', '在线 Agent', stats?.onlineAgents || 0, '正在运行中', '#22c55e')}
        {statCard('👥', '群聊数', stats?.totalGroups || 0, '已创建群组', '#e2e8f0')}
        {statCard('💬', '消息总量', stats?.totalMessages || 0, '全部消息数', '#e2e8f0')}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* 实时在线 Agent */}
        <div style={{ background: '#13161d', border: '1px solid #1e2230', borderRadius: 12, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              🟢 在线 Agent
            </h2>
            <span style={{ fontSize: 12, background: '#1a2a1a', color: '#22c55e', padding: '2px 8px', borderRadius: 12 }}>
              {(onlineAgents || []).length} 个
            </span>
          </div>
          {(onlineAgents || []).length === 0
            ? <div style={{ color: '#334155', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>暂无在线 Agent</div>
            : (onlineAgents || []).map(onlineCard)
          }
        </div>

        {/* 快速操作 */}
        <div style={{ background: '#13161d', border: '1px solid #1e2230', borderRadius: 12, padding: 20 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16 }}>
            ⚡ 快速操作
          </h2>
          {[
            { label: '管理用户', href: '/admin/users', color: '#6366f1', icon: '👥' },
            { label: '对话审计', href: '/admin/audit', color: '#f59e0b', icon: '🔍' },
            { label: '系统设置', href: '/admin/settings', color: '#64748b', icon: '⚙️', disabled: true },
          ].map(item => (
            <a key={item.href} href={item.disabled ? '#' : item.href}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 14px', borderRadius: 8,
                background: item.disabled ? '#1a1d27' : '#1a2030',
                border: `1px solid ${item.disabled ? '#1e2230' : item.color + '40'}`,
                color: item.disabled ? '#334155' : '#e2e8f0',
                textDecoration: 'none', marginBottom: 8,
                cursor: item.disabled ? 'not-allowed' : 'pointer',
                opacity: item.disabled ? 0.5 : 1,
              }}>
              <span style={{ fontSize: 18 }}>{item.icon}</span>
              <span style={{ fontSize: 14, fontWeight: 500 }}>{item.label}</span>
              <span style={{ marginLeft: 'auto', fontSize: 12, color: '#475569' }}>→</span>
            </a>
          ))}
          <div style={{ marginTop: 16, padding: '10px 12px', background: '#13161d', border: '1px solid #1e2230', borderRadius: 6, fontSize: 12, color: '#475569', lineHeight: 1.6 }}>
            💡 <strong style={{ color: '#64748b' }}>提示：</strong>点击「对话审计」可查看所有私聊和群聊消息记录
          </div>
        </div>
      </div>

      {/* 系统状态 */}
      <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        {[
          { label: '数据库', value: '🟢 正常', color: '#22c55e' },
          { label: 'API 响应', value: '🟢 正常', color: '#22c55e' },
          { label: 'WebSocket', value: '🟢 已连接', color: '#22c55e' },
        ].map(s => (
          <div key={s.label} style={{ background: '#13161d', border: '1px solid #1e2230', borderRadius: 8, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: '#64748b' }}>{s.label}</span>
            <span style={{ fontSize: 12, color: s.color, fontWeight: 600 }}>{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
