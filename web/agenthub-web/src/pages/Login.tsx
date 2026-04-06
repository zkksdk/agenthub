import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi, connectSocket } from '../api/client';
import { useAuthStore } from '../stores/auth';

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async () => {
    if (!username || !password) return;
    if (!isLogin && password !== confirmPwd) { setError('两次密码输入不一致'); return; }
    if (!isLogin && password.length < 6) { setError('密码至少6位'); return; }
    setLoading(true);
    setError('');
    try {
      if (isLogin) {
        const res = await authApi.login(username, password);
        if (res.data.ok) {
          login(res.data.token, { id: res.data.userId, username: res.data.username, role: res.data.role });
          connectSocket(res.data.token);
          navigate(res.data.role === 'owner' ? '/owner' : '/admin');
        } else { setError(res.data.error || '登录失败'); }
      } else {
        const res = await authApi.signup(username, password);
        if (res.data.ok) {
          login(res.data.token, { id: res.data.userId, username: res.data.username, role: res.data.role });
          connectSocket(res.data.token);
          navigate('/owner');
        } else { setError(res.data.error || '注册失败'); }
      }
    } catch (e: any) {
      setError(e.response?.data?.error || '网络错误，请稍后重试');
    } finally { setLoading(false); }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: 6,
    border: '1px solid #2a2d3a', background: '#0f1117', color: '#e0e0e0',
    fontSize: 14, boxSizing: 'border-box', outline: 'none',
  };

  return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f1117' }}>
      <div style={{ background: '#1a1d27', border: '1px solid #2a2d3a', borderRadius: 12, padding: 32, width: 360 }}>
        <div style={{ fontSize: 24, fontWeight: 700, color: '#fff', textAlign: 'center', marginBottom: 6 }}>🤖 AgentHub</div>
        <div style={{ fontSize: 13, color: '#555', textAlign: 'center', marginBottom: 24 }}>
          {isLogin ? '登录已有账号' : '注册新账号'}
        </div>

        {/* Tab 切换 */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: '#0f1117', borderRadius: 8, padding: 4 }}>
          <button onClick={() => { setIsLogin(true); setError(''); }}
            style={{ flex: 1, padding: '8px', borderRadius: 6, border: 'none', background: isLogin ? '#4f8fff' : 'transparent', color: isLogin ? '#fff' : '#555', fontSize: 14, cursor: 'pointer' }}>登录</button>
          <button onClick={() => { setIsLogin(false); setError(''); }}
            style={{ flex: 1, padding: '8px', borderRadius: 6, border: 'none', background: !isLogin ? '#4f8fff' : 'transparent', color: !isLogin ? '#fff' : '#555', fontSize: 14, cursor: 'pointer' }}>注册</button>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, color: '#888', display: 'block', marginBottom: 6 }}>用户名</label>
          <input value={username} onChange={e => setUsername(e.target.value)} placeholder="输入用户名" onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            style={{ ...inputStyle }} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, color: '#888', display: 'block', marginBottom: 6 }}>密码</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="输入密码" onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            style={{ ...inputStyle }} />
        </div>
        {!isLogin && (
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 13, color: '#888', display: 'block', marginBottom: 6 }}>确认密码</label>
            <input type="password" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} placeholder="再输入一次密码" onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              style={{ ...inputStyle }} />
          </div>
        )}

        {error && <div style={{ color: '#f44336', fontSize: 13, marginBottom: 16, textAlign: 'center' }}>{error}</div>}

        <button onClick={handleSubmit} disabled={loading}
          style={{ width: '100%', padding: 12, borderRadius: 6, border: 'none', background: loading ? '#2a3a6a' : '#4f8fff', color: '#fff', fontSize: 15, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer' }}>
          {loading ? (isLogin ? '登录中…' : '注册中…') : (isLogin ? '登录' : '注册')}
        </button>

        {isLogin && (
          <div style={{ fontSize: 12, color: '#444', textAlign: 'center', marginTop: 16 }}>
            没有账号？<button onClick={() => { setIsLogin(false); setError(''); }} style={{ background: 'none', border: 'none', color: '#4f8fff', cursor: 'pointer', fontSize: 12, padding: 0 }}>立即注册</button>
          </div>
        )}
      </div>
    </div>
  );
}
