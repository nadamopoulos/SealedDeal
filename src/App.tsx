import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import DealsPage from './pages/DealsPage';
import DealView from './pages/DealView';
import SettingsPage from './pages/SettingsPage';
import LoginPage from './pages/LoginPage';
import { useDealStore } from './store/dealStore';

export default function App() {
  const { isAuthenticated } = useDealStore();

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/deals" replace />} />
        <Route path="/deals" element={<DealsPage />} />
        <Route path="/deals/:dealId" element={<DealView />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}
