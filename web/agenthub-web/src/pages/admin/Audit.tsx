import { useState } from 'react';
import { adminApi } from '../../api/client';

export default function AdminAudit() {
  const [kw, setKw] = useState('');
  const [result, setResult] = useState<any[] | null>(null);
  const [searching, setSearching] = useState(false);

  const search = async () => {
    if (!kw.trim()) return;
    setSearching(true);
    try {
      const r = await adminApi.searchMsgs(kw);
      setResult(r.data.messages || []);
    } finally { setSearching(false); }
  };

  const fmtTime = (t: string) => new Date(t).toLocaleString();

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 20, fontWeight: 600, color: '#fff', marginBottom: 20 }}>🔍 对话审计</h1>
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <input value={kw} onChange={e => setKw(e.target.value)} onKeyDown={e => e.key === 'Enter' && search()} placeholder="搜索聊天内容关键词…"
          style={{ flex: 1, padding: '10px 12px', borderRadius: 6, border: '1px solid #2a2d3a', background: '#1a1d27', color: '#e0e0e0', fontSize: 14, outline: 'none' }} />
        <button onClick={search} disabled={searching} style={{ padding: '10px 20px', borderRadius: 6, border: 'none', background: '#4f8fff', color: '#fff', fontSize: 14, cursor: 'pointer' }}>
          {searching ? '搜索中…' : '搜索'}
        </button>
      </div>
      {result !== null && (
        <div>
          <div style={{ fontSize: 13, color: '#666', marginBottom: 12 }}>找到 {result.length} 条结果</div>
          {result.map((m: any) => (
            <div key={m.id} style={{ background: '#1a1d27', border: '1px solid #2a2d3a', borderRadius: 6, padding: '10px 14px', marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: '#8ab4ff' }}>from: {m.fromId?.slice(0, 16)}… → to: {m.toId?.slice(0, 16)}…</span>
                <span style={{ fontSize: 11, color: '#555' }}>{fmtTime(m.createdAt)}</span>
              </div>
              <div style={{ fontSize: 13, color: '#d0d0d0' }}>{m.content}</div>
            </div>
          ))}
          {result.length === 0 && <div style={{ color: '#555', fontSize: 14 }}>没有找到相关记录</div>}
        </div>
      )}
    </div>
  );
}
