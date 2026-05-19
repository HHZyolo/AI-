import { Outlet, useLocation } from 'react-router-dom';
import AppNav from './AppNav';
import './app.css';

/**
 * H5 / Web 产品页外壳 —— 桌面全宽布局。
 * 顶部网页导航栏;通话页全屏沉浸、不显示导航。
 */
export default function AppShell() {
  const { pathname } = useLocation();
  const isCall = pathname === '/app/call';

  return (
    <div className={`app-stage ${isCall ? 'app-stage--call' : ''}`}>
      {!isCall && <AppNav />}
      <Outlet />
    </div>
  );
}
