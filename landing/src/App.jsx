import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppStateProvider } from './app/AppState';
import Landing from './pages/Landing';
import AppShell from './app/AppShell';
import Home from './app/Home';
import Call from './app/Call';
import Admin from './admin/Admin';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 营销落地页 */}
        <Route path="/" element={<Landing />} />

        {/* H5 产品页 —— 共用 AppState + AppShell */}
        <Route
          element={
            <AppStateProvider>
              <AppShell />
            </AppStateProvider>
          }
        >
          <Route path="/app" element={<Home />} />
          <Route path="/app/call" element={<Call />} />
        </Route>

        {/* 运营后台 —— 独立路由，不走用户态 */}
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </BrowserRouter>
  );
}
