import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppStateProvider } from './app/AppState';
import Landing from './pages/Landing';
import AppShell from './app/AppShell';
import Home from './app/Home';
import CharacterSelect from './app/CharacterSelect';
import Call from './app/Call';

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
          <Route path="/app/characters" element={<CharacterSelect />} />
          <Route path="/app/call" element={<Call />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
