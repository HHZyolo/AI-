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

export function AppStateProvider({ children }) {
  const [characterId, setCharacterId] = useState('genki');
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

  // 通话本地乐观扣减额度（真扣费等后端语音接口接通后再校正）
  const consume = useCallback((sec) => {
    setUser((u) =>
      u ? { ...u, balance_seconds: Math.max(0, u.balance_seconds - sec) } : u,
    );
  }, []);

  const TRIAL_TOTAL = 10 * 60;

  const value = {
    characterId,
    setCharacterId,
    trialLeft: user?.balance_seconds ?? TRIAL_TOTAL,
    trialTotal: TRIAL_TOTAL,
    consume,
    loggedIn: !!user,
    email: user?.email ?? '',
    bootstrapped,
    register,
    login,
    logout,
  };

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}
