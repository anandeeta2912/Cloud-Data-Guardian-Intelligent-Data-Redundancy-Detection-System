import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Datasets from './pages/Datasets';
import DatasetDetail from './pages/DatasetDetail';
import Ingestion from './pages/Ingestion';
import Duplicates from './pages/Duplicates';
import Analytics from './pages/Analytics';
import Reports from './pages/Reports';
import Users from './pages/Users';
import Settings from './pages/Settings';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Database } from 'lucide-react';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token, user } = useAuthStore();
  if (!token || !user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
      <div className="text-center">
        <Database className="w-16 h-16 text-slate-600 mx-auto mb-4" />
        <h1 className="text-3xl font-bold text-white mb-2">404</h1>
        <p className="text-slate-400 mb-6">The page you're looking for doesn't exist.</p>
        <button onClick={() => window.location.hash = ''} className="btn btn-primary">
          Go Home
        </button>
      </div>
    </div>
  );
}

function App() {
  const { token, hydrated } = useAuthStore();

  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/login" element={token ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/register" element={token ? <Navigate to="/" replace /> : <Register />} />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="datasets" element={<Datasets />} />
          <Route path="datasets/:datasetId" element={<DatasetDetail />} />
          <Route path="ingestion" element={<Ingestion />} />
          <Route path="duplicates" element={<Duplicates />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="reports" element={<Reports />} />
          <Route path="users" element={<Users />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </ErrorBoundary>
  );
}

export default App;
