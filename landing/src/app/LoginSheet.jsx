import { useState, useEffect } from 'react';
import Icon from '../components/Icon';
import { useAppState } from './appContext';

/**
 * 登录 / 注册 浮层 —— 邮箱 + 密码。
 *
 * 注册 tab 多一个「确认密码」字段（仅前端比对，不提交后端）；
 * 登录 tab 只要邮箱 + 密码。成功后由 AppState 持久化 token 并关闭弹窗。
 */
export default function LoginSheet({ onClose }) {
  const { login, register } = useAppState();
  const [tab, setTab] = useState('login'); // 'login' | 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Esc 关闭
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // 邮箱格式（前端做基础校验；后端再用 pydantic EmailStr 兜底）
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const passwordOk = password.length >= 8;
  const confirmOk = tab === 'login' || password === confirm;
  const canSubmit = emailOk && passwordOk && confirmOk && !submitting;

  const switchTab = (next) => {
    if (next === tab) return;
    setTab(next);
    setErr('');
    setConfirm('');
  };

  const submit = async () => {
    if (!emailOk) return setErr('请输入正确的邮箱');
    if (!passwordOk) return setErr('密码至少 8 位');
    if (tab === 'register' && !confirmOk) return setErr('两次输入的密码不一致');

    setErr('');
    setSubmitting(true);
    try {
      if (tab === 'register') {
        await register(email.trim(), password);
      } else {
        await login(email.trim(), password);
      }
      onClose();
    } catch (e) {
      setErr(e.message || '提交失败，请稍后再试');
    } finally {
      setSubmitting(false);
    }
  };

  const onEnter = (e) => {
    if (e.key === 'Enter' && canSubmit) submit();
  };

  return (
    <div className="sheet-mask" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <button
          className="sheet__close"
          onClick={onClose}
          aria-label="关闭"
        >
          <Icon name="close" size={18} />
        </button>

        {/* 品牌图标 —— 与顶部导航同款波形 */}
        <span className="sheet__brand" aria-hidden="true">
          <svg viewBox="0 0 32 32" width="22" height="22">
            <g stroke="url(#sheet-brand-g)" strokeWidth="2.4" strokeLinecap="round" fill="none">
              <path d="M7 16h2M12 11v10M16 7v18M20 11v10M24 14v4" />
            </g>
            <defs>
              <linearGradient id="sheet-brand-g" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#FF5C9E" />
                <stop offset="1" stopColor="#9D6BFF" />
              </linearGradient>
            </defs>
          </svg>
        </span>

        <h2 className="sheet__title">
          {tab === 'login' ? '登录,开始陪玩' : '注册,领取试用'}
        </h2>
        <p className="sheet__desc">
          {tab === 'login'
            ? '使用邮箱与密码登录'
            : '邮箱注册即可领取 10 分钟免费试用 · 仅限 18 岁以上成年用户'}
        </p>

        <div className="auth-tabs" role="tablist">
          <button
            role="tab"
            aria-selected={tab === 'login'}
            className={`auth-tabs__btn ${tab === 'login' ? 'is-active' : ''}`}
            onClick={() => switchTab('login')}
            type="button"
          >
            登录
          </button>
          <button
            role="tab"
            aria-selected={tab === 'register'}
            className={`auth-tabs__btn ${tab === 'register' ? 'is-active' : ''}`}
            onClick={() => switchTab('register')}
            type="button"
          >
            注册
          </button>
        </div>

        <div className="auth-fields">
          <label className="auth-field">
            <Icon name="mail" size={18} className="auth-field__icon" />
            <input
              className="input"
              type="email"
              autoComplete="email"
              placeholder="邮箱"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setErr('');
              }}
              onKeyDown={onEnter}
            />
          </label>
          <label className="auth-field">
            <Icon name="lock" size={18} className="auth-field__icon" />
            <input
              className="input"
              type="password"
              autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
              placeholder="密码(至少 8 位)"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setErr('');
              }}
              onKeyDown={onEnter}
            />
          </label>
          {tab === 'register' && (
            <label className="auth-field">
              <Icon name="lock" size={18} className="auth-field__icon" />
              <input
                className={`input ${confirm && !confirmOk ? 'is-error' : ''}`}
                type="password"
                autoComplete="new-password"
                placeholder="确认密码"
                value={confirm}
                onChange={(e) => {
                  setConfirm(e.target.value);
                  setErr('');
                }}
                onKeyDown={onEnter}
              />
            </label>
          )}
        </div>

        {err && <p className="login__err">{err}</p>}

        <button
          className="btn-primary login__btn"
          onClick={submit}
          disabled={!canSubmit}
          type="button"
        >
          {submitting
            ? '请稍候...'
            : tab === 'login'
              ? '登录'
              : '注册并领取试用'}
        </button>

        <p className="login__legal">
          {tab === 'login' ? '登录' : '注册'}即表示同意《用户协议》与《隐私政策》。
          本服务不向未成年人提供。
        </p>
      </div>
    </div>
  );
}
