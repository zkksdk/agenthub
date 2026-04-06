import { useState } from 'react';

export default function SearchPage() {
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const api = (window as any).__AGENTHUB_API__ || 'http://127.0.0.1:3000';

  const search = async () => {
    if (!keyword.trim()) return;
    setLoading(true);
    try {
      const [agentRes, msgRes] = await Promise.all([
        fetch(`${api}/api/agents/search?keyword=${encodeURIComponent(keyword)}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        }),
        fetch(`${api}/api/messages/history?peerId=&groupId=&limit=20`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        }),
      ]);
      const agentData = await agentRes.json();
      const msgData = await msgRes.json();
      const filtered = (msgData.messages || []).filter((m: any) =>
        m.content.toLowerCase().includes(keyword.toLowerCase()),
      );
      setResults([...filtered]);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>🔍 消息搜索</h2>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        <input
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && search()}
          placeholder="输入关键词..."
          style={{ flex: 1, padding: '8px', fontSize: '1rem', borderRadius: '6px', border: '1px solid #ddd' }}
        />
        <button onClick={search} disabled={loading} style={{ padding: '8px 20px', background: '#3498db', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
          {loading ? '搜索中...' : '搜索'}
        </button>
      </div>
      <div>
        {results.length === 0 && keyword && <p style={{ color: '#999' }}>未找到相关消息</p>}
        {results.map((m, i) => (
          <div key={i} style={{ padding: '12px', borderBottom: '1px solid #eee', background: '#f9f9f9', borderRadius: '6px', marginBottom: '8px' }}>
            <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '4px' }}>
              {m.fromId} → {m.toId} | {new Date(m.createdAt).toLocaleString()}
            </div>
            <div>{m.content}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
