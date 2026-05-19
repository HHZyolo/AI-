import { createContext, useContext } from 'react';

/** H5 产品页全局状态 Context —— Provider 见 AppState.jsx */
export const AppCtx = createContext(null);

export function useAppState() {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error('useAppState 必须在 AppStateProvider 内使用');
  return ctx;
}
