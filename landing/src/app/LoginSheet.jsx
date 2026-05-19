import { useState, useEffect } from 'react';
import Icon from '../components/Icon';
import { useAppState } from './appContext';

/** 手机号登录浮层 —— PRD F08 短信验证码登录(纯前端演示,验证码任意 4 位即通过) */
export default function LoginSheet({ onClose }) {
  const { login } = useAppState();
  const [step, setStep] = useState('phone'); // phone | code
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');

  // Esc 关闭
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const phoneOk = /^1\d{10}$/.test(phone);

  const sendCode = () => {
    if (!phoneOk) {
      setErr('请输入正确的 11 位手机号');
      return;
    }
    setErr('');
    setStep('code');
  };

  const submit = () => {
    if (code.length < 4) {
      setErr('请输入收到的验证码');
      return;
    }
    login(phone);
    onClose();
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
        <h2 className="sheet__title">
          {step === 'phone' ? '登录,开始陪玩' : '输入验证码'}
        </h2>
        <p className="sheet__desc">
          {step === 'phone'
            ? '手机号登录即可领取 10 分钟免费试用 · 仅限 18 岁以上成年用户'
            : `验证码已发送至 ${phone}`}
        </p>

        {step === 'phone' ? (
          <>
            <input
              className={`input ${err ? 'is-error' : ''}`}
              type="tel"
              inputMode="numeric"
              maxLength={11}
              placeholder="请输入手机号"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value.replace(/\D/g, ''));
                setErr('');
              }}
            />
            {err && <p className="login__err">{err}</p>}
            <button
              className="btn-primary login__btn"
              onClick={sendCode}
              disabled={!phoneOk}
            >
              获取验证码
            </button>
          </>
        ) : (
          <>
            <input
              className={`input ${err ? 'is-error' : ''}`}
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="请输入验证码"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.replace(/\D/g, ''));
                setErr('');
              }}
              autoFocus
            />
            {err && <p className="login__err">{err}</p>}
            <button className="btn-primary login__btn" onClick={submit}>
              登录并领取试用
            </button>
            <button className="login__resend" onClick={() => setStep('phone')}>
              <Icon name="arrow" size={14} />
              换个手机号
            </button>
          </>
        )}

        <p className="login__legal">
          登录即表示同意《用户协议》与《隐私政策》。本服务不向未成年人提供。
        </p>
      </div>
    </div>
  );
}
