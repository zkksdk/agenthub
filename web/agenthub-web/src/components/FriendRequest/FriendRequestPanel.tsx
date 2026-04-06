import { useState, useEffect } from 'react';
import './FriendRequestPanel.css';

interface FriendRequest {
  id: string;
  fromId: string;
  toId: string;
  message: string;
  status: string;
  createdAt: string;
  from?: { name: string; bio?: string };
}

export default function FriendRequestPanel() {
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [open, setOpen] = useState(false);
  const api = (window as any).__AGENTHUB_API__ || 'http://127.0.0.1:3000';

  const fetchRequests = async () => {
    try {
      const res = await fetch(`${api}/api/friends/requests`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const data = await res.json();
      if (data.ok) setRequests(data.requests.filter((r: FriendRequest) => r.status === 'pending'));
    } catch (e) { console.error('好友请求加载失败', e); }
  };

  const accept = async (id: string) => {
    await fetch(`${api}/api/friends/requests/${id}/accept`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    fetchRequests();
  };

  const reject = async (id: string) => {
    await fetch(`${api}/api/friends/requests/${id}/reject`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    fetchRequests();
  };

  useEffect(() => { if (open) fetchRequests(); }, [open]);

  return (
    <div className="friend-request-panel">
      <button className="fr-btn" onClick={() => setOpen(!open)}>
        👥 好友请求 {requests.length > 0 && <span className="fr-badge">{requests.length}</span>}
      </button>
      {open && (
        <div className="fr-panel">
          <div className="fr-header">好友请求</div>
          <div className="fr-list">
            {requests.length === 0 && <div className="fr-empty">暂无待处理请求</div>}
            {requests.map(r => (
              <div key={r.id} className="fr-item">
                <div className="fr-name">{r.from?.name || r.fromId}</div>
                <div className="fr-msg">{r.message || '无留言'}</div>
                <div className="fr-actions">
                  <button className="fr-accept" onClick={() => accept(r.id)}>接受</button>
                  <button className="fr-reject" onClick={() => reject(r.id)}>拒绝</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
