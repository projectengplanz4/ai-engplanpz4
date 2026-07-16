import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { AuthPage } from './pages/AuthPage';
import { DashboardLayout, type View } from './components/DashboardLayout';
import { DashboardOverview } from './pages/DashboardOverview';
import { ChatPage } from './pages/ChatPage';
import { DocumentsPage } from './pages/DocumentsPage';
import { DataManagementPage } from './pages/DataManagementPage';
import { FullPageSpinner } from './components/ui/Spinner';

function AppContent() {
  const { session, loading } = useAuth();
  const [view, setView] = useState<View>('dashboard');

  if (loading) return <FullPageSpinner />;
  if (!session) return <AuthPage />;

  return (
    <DashboardLayout currentView={view} onNavigate={setView}>
      {view === 'dashboard' && <DashboardOverview onNavigate={setView} />}
      {view === 'chat' && <ChatPage />}
      {view === 'documents' && <DocumentsPage />}
      {view === 'data' && <DataManagementPage />}
    </DashboardLayout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </AuthProvider>
  );
}
