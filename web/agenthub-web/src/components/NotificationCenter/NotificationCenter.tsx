import { useState, useEffect } from 'react';
import './NotificationCenter.css';

interface Notification {
  id: string;
  type: string;
  title: string;
  content: string;
  isRead: boolean;
  createdAt: string;
}

export default function NotificationCenter() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const api = (window as any).__AGENTHUB_API__ || 'http://127.0.0.1:3000';

  const fetchNotifications = async () => {
    try {
      const res = await fetch(`${api}/api/notifications?limit=50`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const data = await res.json();
      if (data.ok) {
        setNotifications(data.notifications);
        setUnreadCount(data.notifications.filter((n: Notification) => !n.isRead).length);
      }
    } catch (e) { console.error('通知加载失败', e); }
  };

  const markRead = async (id: string) => {
    await fetch(`${api}/api/notifications/${id}/read`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    fetchNotifications();
  };

  const markAllRead = async () => {
    await fetch(`${api}/api/notifications/read-all`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    fetchNotifications();
  };

  useEffect(() => { if (open) fetchNotifications(); }, [open]);

  return (
    <div className="notification-center">
      <button className="notif-bell" onClick={() => setOpen(!open)}>
        🔔 {unreadCount > 0 && <span className="badge">{unreadCount}</span>}
      </button>
      {open && (
        <div className="notif-panel">
          <div className="notif-header">
            <span>通知中心</span>
            {unreadCount > 0 && <button onClick={markAllRead}>全部已读</button>}
          </div>
          <div className="notif-list">
            {notifications.length === 0 && <div className="notif-empty">暂无通知</div>}
            {notifications.map(n => (
              <div key={n.id} className={`notif-item ${n.isRead ? '' : 'unread'}`} onClick={() => !n.isRead && markRead(n.id)}>
                <div className="notif-title">{n.title}</div>
                <div className="notif-content">{n.content}</div>
                <div className="notif-time">{new Date(n.createdAt).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
