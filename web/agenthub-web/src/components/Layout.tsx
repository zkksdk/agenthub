import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';

export default function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: '-apple-system, sans-serif', background: '#0f1117', color: '#e0e0e0' }}>
      {/* Sidebar */}
      <div style={{ width: 220, background: '#1a1d27', borderRight: '1px solid #2a2d3a', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px', borderBottom: '1px solid #2a2d3a' }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#fff' }}>🤖 AgentHub</div>
          <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>{user?.username} · {user?.role}</div>
        </div>

        <nav style={{ flex: 1, padding: '8px' }}>
          {isAdmin && (
            <>
              <div style={{ fontSize: 11, color: '#555', padding: '8px 12px 4px', textTransform: 'uppercase' }}>管理员</div>
              <NavLink to="/admin" style={({ isActive }) => isActive ? activeNavStyle : navStyle}>📊 系统概览</NavLink>
              <NavLink to="/admin/users" style={({ isActive }) => isActive ? activeNavStyle : navStyle}>👥 用户管理</NavLink>
              <NavLink to="/admin/audit" style={({ isActive }) => isActive ? activeNavStyle : navStyle}>🔍 对话审计</NavLink>
              <div style={{ fontSize: 11, color: '#555', padding: '8px 12px 4px', marginTop: 8, textTransform: 'uppercase' }}>主人后台</div>
            </>
          )}
          <NavLink to="/owner" style={({ isActive }) => isActive ? activeNavStyle : navStyle}>🏠 仪表盘</NavLink>
          <NavLink to="/owner/agents" style={({ isActive }) => isActive ? activeNavStyle : navStyle}>🤖 Agent 管理</NavLink>
          <NavLink to="/owner/contacts" style={({ isActive }) => isActive ? activeNavStyle : navStyle}>📒 通信录</NavLink>
          <NavLink to="/owner/chat" style={({ isActive }) => isActive ? activeNavStyle : navStyle}>💬 Bot 对话</NavLink>
          <NavLink to="/owner/groups" style={({ isActive }) => isActive ? activeNavStyle : navStyle}>👥 群聊管理</NavLink>
        </nav>

        <div style={{ padding: 12, borderTop: '1px solid #2a2d3a' }}>
          <button onClick={() => { logout(); navigate('/login'); }} style={{ width: '100%', padding: '8px', borderRadius: 6, border: 'none', background: '#2a2d3a', color: '#888', cursor: 'pointer', fontSize: 13 }}>退出登录</button>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <Outlet />
      </div>
    </div>
  );
}

const navStyle: React.CSSProperties = { display: 'block', padding: '8px 12px', borderRadius: 6, color: '#aaa', textDecoration: 'none', fontSize: 14, marginBottom: 2, transition: 'background .15s' };
const activeNavStyle: React.CSSProperties = { ...navStyle, color: '#fff', background: '#2a2d3a' };
