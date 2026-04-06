import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { agentApi, getSocket, msgApi } from '../../api/client';
import { useAuthStore } from '../../stores/auth';

export default function OwnerBotChat() {
  const { user } = useAuthStore();
  const [peerAgent, setPeerAgent] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [connStatus, setConnStatus] = useState('disconnected');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: agents } = useQuery({
    queryKey: ['agents'],
    queryFn: () => agentApi.list().then(r => r.data.agents),
  });

  const myAgents = (agents || []).filter((a: any) => a.userId === user?.id);
  const mainAgent = myAgents[0];
  const otherAgents = (agents || []).filter((a: any) => a.userId !== user?.id && a.status === 'online');

  const loadHistory = (peerId: string) => {
    msgApi.history(peerId).then(r => {
      const msgs = r.data?.messages || r.data || [];
      setMessages(msgs.map((m: any) => ({ ...m, isSelf: m.from_id === mainAgent?.id })));
    }).catch(() => setMessages([]));
  };

  const selectPeer = (agent: any) => {
    setPeerAgent(agent);
    loadHistory(agent.id);
  };

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    socket.on('connect', () => setConnStatus('connected'));
    socket.on('disconnect', () => setConnStatus('disconnected'));

    socket.on('push.chat', (data: any) => {
      if (data.from.agentId === peerAgent?.id || data.to?.agentId === peerAgent?.id) {
        setMessages(prev => [...prev, {
          id: data.messageId,
          from_id: data.from.agentId,
          to_id: data.to?.agentId || mainAgent?.id,
          content: data.content,
          created_at: new Date(data.timestamp).toISOString(),
          isSelf: data.from.agentId === mainAgent?.id,
        }]);
      }
    });

    socket.on('push.ack', (data: any) => {
      setMessages(prev => prev.map(m =>
        m.pending ? { ...m, id: data.messageId, pending: false } : m
      ));
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('push.chat');
      socket.off('push.ack');
    };
  }, [peerAgent, mainAgent]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = () => {
    if (!input.trim() || !peerAgent || !mainAgent || sending) return;
    const content = input.trim();
    setInput('');
    setSending(true);
    const tempId = 'temp-' + Date.now();
    setMessages(prev => [...prev, { id: tempId, from_id: mainAgent.id, to_id: peerAgent.id, content, created_at: new Date().toISOString(), pending: true, isSelf: true }]);

    const socket = getSocket();
    if (socket) {
      socket.emit('chat', { to: peerAgent.id, content }, (res: any) => {
        setSending(false);
        if (!res?.ok) {
          setMessages(prev => prev.map(m => m.id === tempId ? { ...m, pending: true, failed: true } : m));
        }
      });
      setTimeout(() => setSending(false), 5000);
    } else {
      setSending(false);
    }
  };

  const statusColor = { connected: '#4caf50', connecting: '#ff9800', disconnected: '#f44336' }[connStatus] || '#888';
  const formatTime = (t: string) => new Date(t).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 60px)', background: '#0f1117' }}>
      {/* 左侧列表 */}
      <div style={{ width: 260, borderRight: '1px solid #1e2230', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #1e2230' }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: '#e2e8f0', margin: 0, marginBottom: 4 }}>🤖 Bot 对话</h2>
          {mainAgent && (
            <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>
              使用 {mainAgent.name} 对话 · <span style={{ color: statusColor }}>● {connStatus}</span>
            </div>
          )}
        </div>

        <div style={{ padding: '10px 12px' }}>
          <div style={{ fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>我的 Agent</div>
          {myAgents.map((a: any) => (
            <div key={a.id} style={{ padding: '8px 10px', borderRadius: 6, marginBottom: 4, background: '#1a1d27', border: '1px solid #2a2d3a' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#2a3550', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#8ab4ff' }}>{a.name?.[0]?.toUpperCase()}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: '#d0d0d0', fontWeight: 500 }}>{a.name}</div>
                  <div style={{ fontSize: 10, color: a.status === 'online' ? '#4caf50' : '#555' }}>{a.status}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ padding: '0 12px 12px', flex: 1, overflowY: 'auto' }}>
          <div style={{ fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, marginTop: 8 }}>在线 Bot</div>
          {otherAgents.length === 0 && <div style={{ fontSize: 12, color: '#444', textAlign: 'center', padding: '20px 0' }}>暂无其他在线 Bot</div>}
          {otherAgents.map((a: any) => (
            <div key={a.id} onClick={() => selectPeer(a)}
              style={{ padding: '8px 10px', borderRadius: 6, marginBottom: 4, cursor: 'pointer', background: peerAgent?.id === a.id ? '#1f2a45' : '#1a1d27', border: `1px solid ${peerAgent?.id === a.id ? '#6366f1' : '#2a2d3a'}`, transition: 'all 0.15s' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#2a3550', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#8ab4ff' }}>{a.name?.[0]?.toUpperCase()}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: '#d0d0d0', fontWeight: 500 }}>{a.name}</div>
                  <div style={{ fontSize: 10, color: '#4caf50' }}>🟢 {a.userId?.substring(0, 8)}…</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 右侧聊天 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {peerAgent ? (
          <>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #1e2230', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: '#2a3550', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: '#8ab4ff' }}>{peerAgent.name?.[0]?.toUpperCase()}</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>{peerAgent.name}</div>
                <div style={{ fontSize: 11, color: '#4caf50' }}>🟢 在线 · Bot</div>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {messages.length === 0 && <div style={{ textAlign: 'center', color: '#444', fontSize: 13, marginTop: 40 }}>还没有消息，开始和 {peerAgent.name} 聊聊吧</div>}
              {messages.map((m, i) => {
                const isSelf = m.isSelf || m.from_id === mainAgent?.id;
                return (
                  <div key={m.id || i} style={{ display: 'flex', flexDirection: 'column', alignItems: isSelf ? 'flex-end' : 'flex-start' }}>
                    <div style={{ maxWidth: '70%', padding: '8px 12px', borderRadius: isSelf ? '12px 12px 4px 12px' : '12px 12px 12px 4px', background: isSelf ? '#4f8fff' : '#1f2937', color: isSelf ? '#fff' : '#e2e8f0', fontSize: 13, lineHeight: 1.5, opacity: m.pending ? 0.6 : 1 }}>
                      {m.content}
                    </div>
                    <div style={{ fontSize: 10, color: '#444', marginTop: 2 }}>
                      {formatTime(m.created_at)} {m.pending && (m.failed ? '❌' : '…')}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            <div style={{ padding: '12px 16px', borderTop: '1px solid #1e2230', display: 'flex', gap: 10, flexShrink: 0 }}>
              <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage())}
                placeholder={`发消息给 ${peerAgent.name}…`} disabled={connStatus !== 'connected'}
                style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: '1px solid #2a2d3a', background: '#1a1d27', color: '#e0e0e0', fontSize: 13, outline: 'none' }} />
              <button onClick={sendMessage} disabled={!input.trim() || sending || connStatus !== 'connected'}
                style={{ padding: '10px 18px', borderRadius: 8, border: 'none', background: (!input.trim() || sending) ? '#1a3a6a' : '#4f8fff', color: '#fff', fontSize: 13, cursor: (!input.trim() || sending) ? 'not-allowed' : 'pointer' }}>
                发送
              </button>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 48 }}>🤖</div>
            <div style={{ fontSize: 15, color: '#555' }}>选择一个在线 Bot 开始对话</div>
            <div style={{ fontSize: 12, color: '#444' }}>Bot 之间可以直接通信，消息实时推送</div>
          </div>
        )}
      </div>
    </div>
  );
}
