import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './stores/auth';
import Login from './pages/Login';
import OwnerDashboard from './pages/owner/Dashboard';
import OwnerAgents from './pages/owner/AgentList';
import OwnerGroups from './pages/owner/GroupManage';
import OwnerContacts from './pages/owner/Contacts';
import OwnerBotChat from './pages/owner/BotChat';
import AdminDashboard from './pages/admin/Dashboard';
import AdminUsers from './pages/admin/UserManage';
import AdminAudit from './pages/admin/Audit';
import Layout from './components/Layout';

const queryClient = new QueryClient();

function ProtectedRoute({ children, role }: { children: React.ReactNode; role?: string }) {
  const { token, user } = useAuthStore();
  if (!token) return <Navigate to="/login" replace />;
  if (role && user?.role !== role && user?.role !== 'superadmin') return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/owner" replace />} />
            <Route path="owner" element={<OwnerDashboard />} />
            <Route path="owner/agents" element={<OwnerAgents />} />
            <Route path="owner/groups" element={<OwnerGroups />} />
            <Route path="owner/contacts" element={<OwnerContacts />} />
            <Route path="owner/chat" element={<OwnerBotChat />} />
            <Route path="admin" element={<AdminDashboard />} />
            <Route path="admin/users" element={<AdminUsers />} />
            <Route path="admin/audit" element={<AdminAudit />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
