import { useState, useCallback, useEffect } from 'react';
import { AppCtx } from './appContext';
import { api } from './api';

/**
 * H5 产品页全局状态。
 *
 * 登录态：从 localStorage 恢复 token，启动后调 /users/me 拉取用户信息；
 * 失败（token 过期/无效）则清掉本地凭证、退到未登录态。
 *
 * 试用额度：以后端 user.balance_seconds 为准；通话时本地先扣（乐观更新），
 * 真正的扣费在接入语音对话后由后端做。
 */
const TOKEN_KEY = 'aipw_token';

// MVP 单角色策略：固定 sister。后续多角色恢复时改回 useState
const FIXED_CHARACTER_ID = 'sister';

export function AppStateProvider({ children }) {
  const [characterId, setCharacterId] = useState(FIXED_CHARACTER_ID);
  const [user, setUser] = useState(null); // { id, email, balance_seconds, ... }
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [bootstrapped, setBootstrapped] = useState(false);

  // 启动时如果本地有 token，拉一次 /users/me 验证并填充用户
  useEffect(() => {
    if (!token) {
      setBootstrapped(true);
      return;
    }
    let abort = false;
    api.me(token)
      .then((u) => {
        if (!abort) setUser(u);
      })
      .catch(() => {
        if (!abort) {
          localStorage.removeItem(TOKEN_KEY);
          setToken(null);
          setUser(null);
        }
      })
      .finally(() => {
        if (!abort) setBootstrapped(true);
      });
    return () => {
      abort = true;
    };
  }, [token]);

  const persistToken = useCallback((t) => {
    localStorage.setItem(TOKEN_KEY, t);
    setToken(t);
  }, []);

  const register = useCallback(
    async (email, password) => {
      const { access_token } = await api.register(email, password);
      persistToken(access_token);
      const me = await api.me(access_token);
      setUser(me);
      return me;
    },
    [persistToken],
  );

  // 登录后核销兑换码：成功后用后端返回的余额更新本地 user
  const redeem = useCallback(
    async (code) => {
      if (!token) throw new Error('请先登录');
      const res = await api.redeem(token, code);
      setUser((u) =>
        u
          ? { ...u, balance_seconds: res.balance_seconds, redeem_code_used: res.code }
          : u,
      );
      return res; // { balance_seconds, bonus_seconds, code }
    },
    [token],
  );

  const login = useCallback(
    async (email, password) => {
      const { access_token } = await api.login(email, password);
      persistToken(access_token);
      const me = await api.me(access_token);
      setUser(me);
      return me;
    },
    [persistToken],
  );

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  // 通话结束时上报本次消耗秒数，后端是权威账本。
  // 本地先乐观更新 UI，再后端落库；最终以后端返回为准。
  const consume = useCallback(
    async (sec) => {
      if (!sec || sec <= 0 || !token) return;
      setUser((u) =>
        u ? { ...u, balance_seconds: Math.max(0, u.balance_seconds - sec) } : u,
      );
      try {
        const { balance_seconds } = await api.consume(token, sec);
        setUser((u) => (u ? { ...u, balance_seconds } : u));
      } catch (e) {
        // 上报失败时刷新一次后端数据，避免 UI 跟数据库长期不一致
        try {
          const me = await api.me(token);
          setUser(me);
        } catch {
          /* ignore */
        }
        // 把异常抛给调用方，方便上层 toast
        throw e;
      }
    },
    [token],
  );

  // 注册赠送的免费秒数（与后端 TRIAL_SECONDS 保持一致，仅做未登录时的 UI 占位）
  const TRIAL_TOTAL = 3 * 60;

  const value = {
    characterId,
    setCharacterId,
    // 未登录时不显示「剩余 X 分钟」，由 UI 自己根据 loggedIn 决定文案
    trialLeft: user?.balance_seconds ?? 0,
    trialTotal: TRIAL_TOTAL,
    consume,
    loggedIn: !!user,
    email: user?.email ?? '',
    bootstrapped,
    register,
    login,
    logout,
    redeem,
    redeemCodeUsed: user?.redeem_code_used ?? null,
  };

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}
