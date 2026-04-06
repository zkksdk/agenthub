import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { agentApi } from '../../api/client';

export default function AdminContacts() {
  const [tab, setTab] = useState<'friends' | 'requests'>('friends');
  const [searchKw, setSearchKw] = useState('');
  const [searchResult, setSearchResult] = useState<any[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const [msgContent, setMsgContent] = useState('');
  const [sent, setSent] = useState<string | null>(null);

  const { data: friends } = useQuery({
    queryKey: ['friends'],
    queryFn: () => agentApi.list().then(r => r.data.agents || []),
  });

  const searchAgents = async () => {
    if (!searchKw.trim()) return;
    setSearching(true);
    try {
      const r = await agentApi.search(searchKw);
      setSearchResult(r.data.agents || []);
    } finally { setSearching(false); }
  };

  const sendMsg = useMutation({
    mutationFn: ({ toId, content }: { toId: string; content: string }) =>
      fetch('/api/agents/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('agenthub_token')}` },
        body: JSON.stringify({ to: toId, content }),
      }).then(r => r.json()),
    onSuccess: (_, vars) => {
      setSent(vars.toId);
      setSendingTo(null);
      setMsgContent('');
    },
  });

  const tabStyle = (active: boolean) => ({
    padding: '8px 18px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
    background: active ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : '#1a1d27',
    color: active ? '#fff' : '#64748b',
  });

  const cardStyle = { background: '#16191f', border: '1px solid #1e2230', borderRadius: 10, padding: '14px 16px', marginBottom: 10 };

  const AgentCard = ({ a, showSend = false }: { a: any; showSend?: boolean }) => (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: a.bio ? 8 : 0 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: '#2a3550', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, color: '#8ab4ff', fontWeight: 700 }}>
          {a.name?.[0]?.toUpperCase() || '?'}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>{a.name}</div>
          <div style={{ fontSize: 11, color: '#475569', fontFamily: 'monospace' }}>{a.id.slice(0, 24)}…</div>
        </div>
        {a.status === 'online' && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e' }} />}
      </div>
      {a.bio && <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>{a.bio}</div>}
      {showSend && (
        <div>
          {sent === a.id
            ? <div style={{ fontSize: 12, color: '#22c55e', textAlign: 'center', padding: '6px', background: '#1a3a2a', borderRadius: 6 }}>✅ 消息已发送</div>
            : <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={sendingTo === a.id ? msgContent : ''}
                  onChange={e => { setSendingTo(a.id); setMsgContent(e.target.value); }}
                  placeholder="输入消息内容…"
                  style={{ flex: 1, padding: '7px 10px', borderRadius: 6, border: '1px solid #2a2d3a', background: '#0f1117', color: '#e2e8f0', fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
                />
                <button
                  onClick={() => sendMsg.mutate({ toId: a.id, content: msgContent || '你好！' })}
                  disabled={!msgContent.trim() && sendingTo === a.id}
                  style={{ padding: '7px 14px', borderRadius: 6, border: 'none', background: '#6366f1', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                >发送</button>
              </div>
          }
        </div>
      )}
    </div>
  );

  return (
    <div style={{ padding: 28, maxWidth: 800, margin: '0 auto' }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: '#f1f5f9', marginBottom: 20 }}>🔗 联系人管理</h1>

      {/* Tab */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button style={tabStyle(tab === 'friends')} onClick={() => setTab('friends')}>🤖 所有 Agent</button>
        <button style={tabStyle(tab === 'requests')} onClick={() => setTab('requests')}>🔍 搜索 Agent</button>
      </div>

      {/* 搜索 */}
      {tab === 'requests' && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            <input
              value={searchKw}
              onChange={e => { setSearchKw(e.target.value); setSearchResult(null); }}
              onKeyDown={e => e.key === 'Enter' && searchAgents()}
              placeholder="输入 Agent 名称或关键词搜索…"
              style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: '1px solid #2a2d3a', background: '#1a1d27', color: '#e2e8f0', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
            />
            <button onClick={searchAgents} disabled={searching}
              style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: '#6366f1', color: '#fff', fontSize: 14, fontWeight: 600, cursor: searching ? 'not-allowed' : 'pointer', opacity: searching ? 0.6 : 1 }}>
              {searching ? '搜索中…' : '🔍 搜索'}
            </button>
          </div>
          {searchResult !== null && (
            <div>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 10 }}>
                {searchResult.length === 0 ? '未找到匹配结果' : `找到 ${searchResult.length} 个 Agent`}
              </div>
              {searchResult.map((a: any) => <AgentCard key={a.id} a={a} showSend />)}
            </div>
          )}
        </div>
      )}

      {/* 全部 Agent */}
      {tab === 'friends' && (
        <div>
          {(!friends || friends.length === 0)
            ? <div style={{ textAlign: 'center', padding: '40px 0', color: '#334155', fontSize: 14 }}>暂无 Agent，搜索 tab 可以查找其他 Agent</div>
            : friends.map((a: any) => <AgentCard key={a.id} a={a} showSend />)
          }
        </div>
      )}
    </div>
  );
}
