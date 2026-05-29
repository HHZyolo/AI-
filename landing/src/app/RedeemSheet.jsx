import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from '../components/Icon';
import { useAppState } from './appContext';

/**
 * 兑换码弹窗 —— 登录后任意时间使用。
 *
 * 用户输入兑换码 → 调 /users/redeem → 后端原子核销并增加余额。
 * 同一账号一辈子只能用一次（后端 users.redeem_code_used 拦截）。
 */
export default function RedeemSheet({ onClose }) {
  const { redeem } = useAppState();
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(null); // { bonus_seconds, code }

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = async () => {
    const trimmed = code.trim();
    if (!trimmed) return setErr('请输入兑换码');

    setErr('');
    setSubmitting(true);
    try {
      const res = await redeem(trimmed);
      setSuccess(res);
    } catch (e) {
      setErr(e.message || '兑换失败，请稍后再试');
    } finally {
      setSubmitting(false);
    }
  };

  const onEnter = (e) => {
    if (e.key === 'Enter' && !submitting) submit();
  };

  return createPortal(
    <div className="sheet-mask" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <button
          className="sheet__close"
          onClick={onClose}
          aria-label="关闭"
        >
          <Icon name="close" size={18} />
        </button>

        <span className="sheet__brand" aria-hidden="true">
          <Icon name="gift" size={22} />
        </span>

        {success ? (
          <>
            <h2 className="sheet__title">兑换成功</h2>
            <p className="sheet__desc">
              已为你增加 <b>{Math.round(success.bonus_seconds / 60)} 分钟</b> 体验时长
              <br />
              兑换码：{success.code}
            </p>
            <button
              className="btn-primary login__btn"
              onClick={onClose}
              type="button"
            >
              知道了
            </button>
          </>
        ) : (
          <>
            <h2 className="sheet__title">输入兑换码</h2>
            <p className="sheet__desc">
              每个账号仅限使用一次 · 成功后立即增加体验时长
            </p>

            <div className="auth-fields">
              <label className="auth-field">
                <Icon name="gift" size={18} className="auth-field__icon" />
                <input
                  className="input"
                  type="text"
                  autoComplete="off"
                  placeholder="请输入兑换码"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.toUpperCase());
                    setErr('');
                  }}
                  onKeyDown={onEnter}
                  maxLength={64}
                  autoFocus
                />
              </label>
            </div>

            {err && <p className="login__err">{err}</p>}

            <button
              className="btn-primary login__btn"
              onClick={submit}
              disabled={submitting || !code.trim()}
              type="button"
            >
              {submitting ? '兑换中...' : '立即兑换'}
            </button>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
