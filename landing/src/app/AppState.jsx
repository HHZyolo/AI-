import { useState, useCallback } from 'react';
import { AppCtx } from './appContext';

/**
 * H5 产品页全局状态 —— 纯前端,数据存内存(刷新即重置)。
 * 真实产品里这些来自后端:角色选择、剩余试用额度、登录态。
 */
const TRIAL_TOTAL = 10 * 60; // 试用额度 10 分钟,单位秒

export function AppStateProvider({ children }) {
  const [characterId, setCharacterId] = useState('genki');
  const [trialLeft, setTrialLeft] = useState(TRIAL_TOTAL); // 剩余秒数
  const [loggedIn, setLoggedIn] = useState(false);
  const [phone, setPhone] = useState('');

  // 通话时消耗试用额度
  const consume = useCallback((sec) => {
    setTrialLeft((t) => Math.max(0, t - sec));
  }, []);

  const value = {
    characterId,
    setCharacterId,
    trialLeft,
    trialTotal: TRIAL_TOTAL,
    consume,
    loggedIn,
    phone,
    login: (p) => {
      setPhone(p);
      setLoggedIn(true);
    },
  };

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}
