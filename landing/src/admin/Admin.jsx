import { useEffect, useState, useCallback } from 'react';
import Icon from '../components/Icon';
import './admin.css';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000';
const TOKEN_KEY = 'aipw_admin_token';

/**
 * 运营后台 —— 兑换码管理。
 *
 * 极简鉴权：用 X-Admin-Token header 调后端 /admin/* 接口。
 * token 本地保存（仅 localStorage），刷新页面不丢。
 * 这是个内部工具，不对用户开放，所以鉴权与样式都从简。
 */
export default function Admin() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || '');
  const [authed, setAuthed] = useState(false);
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  // 创建表单
  const [newCode, setNewCode] = useState('');
  const [newBonus, setNewBonus] = useState(30);
  const [newMax, setNewMax] = useState('');
  const [newNote, setNewNote] = useState('');
  const [creating, setCreating] = useState(false);

  const headers = useCallback(
    () => ({
      'Content-Type': 'application/json',
      'X-Admin-Token': token,
    }),
    [token],
  );

  const fetchCodes = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const res = await fetch(`${API_BASE}/admin/redeem-codes`, {
        headers: headers(),
      });
      if (res.status === 401) {
        setErr('Admin Token 无效，请重新输入');
        setAuthed(false);
        return;
      }
      if (!res.ok) throw new Error(`请求失败 (${res.status})`);
      const data = await res.json();
      setCodes(data);
      setAuthed(true);
      localStorage.setItem(TOKEN_KEY, token);
    } catch (e) {
      setErr(e.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [token, headers]);

  // 已有 token 时自动尝试加载（避免每次刷新都要重输）
  useEffect(() => {
    if (token && !authed) fetchCodes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createCode = async (e) => {
    e.preventDefault();
    setCreating(true);
    setErr('');
    try {
      const body = {
        code: newCode.trim() || null,
        bonus_seconds: Number(newBonus) * 60,
        max_uses: newMax ? Number(newMax) : null,
        note: newNote.trim() || null,
      };
      const res = await fetch(`${API_BASE}/admin/redeem-codes`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(body),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.detail || `创建失败 (${res.status})`);
      // 重置表单 + 刷新列表
      setNewCode('');
      setNewBonus(30);
      setNewMax('');
      setNewNote('');
      await fetchCodes();
    } catch (e) {
      setErr(e.message || '创建失败');
    } finally {
      setCreating(false);
    }
  };

  const deleteCode = async (id, code) => {
    if (!confirm(`确认删除兑换码「${code}」？`)) return;
    try {
      const res = await fetch(`${API_BASE}/admin/redeem-codes/${id}`, {
        method: 'DELETE',
        headers: headers(),
      });
      if (!res.ok && res.status !== 204) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.detail || `删除失败 (${res.status})`);
      }
      await fetchCodes();
    } catch (e) {
      setErr(e.message || '删除失败');
    }
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken('');
    setAuthed(false);
    setCodes([]);
  };

  // ─── 登录页 ─────────────────────────────────
  if (!authed) {
    return (
      <div className="admin-login">
        <div className="admin-login__box">
          <h1>兑换码后台</h1>
          <p className="admin-login__hint">
            输入 Admin Token 进入。Token 在后端 .env 的 ADMIN_TOKEN 字段。
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              fetchCodes();
            }}
          >
            <input
              type="password"
              placeholder="Admin Token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              autoFocus
              className="admin-input"
            />
            <button type="submit" className="admin-btn admin-btn--primary">
              {loading ? '验证中...' : '进入'}
            </button>
          </form>
          {err && <p className="admin-err">{err}</p>}
        </div>
      </div>
    );
  }

  // ─── 管理页 ─────────────────────────────────
  return (
    <div className="admin">
      <header className="admin__head">
        <h1>兑换码管理</h1>
        <button onClick={logout} className="admin-btn admin-btn--ghost">
          退出
        </button>
      </header>

      {/* 创建表单 */}
      <section className="admin__panel">
        <h2>创建新兑换码</h2>
        <form className="admin-form" onSubmit={createCode}>
          <label>
            <span>兑换码（留空自动生成 8 位）</span>
            <input
              type="text"
              value={newCode}
              onChange={(e) => setNewCode(e.target.value.toUpperCase())}
              placeholder="例如 WELCOME2026"
              maxLength={64}
              className="admin-input"
            />
          </label>
          <label>
            <span>奖励时长（分钟）</span>
            <input
              type="number"
              value={newBonus}
              onChange={(e) => setNewBonus(e.target.value)}
              min={1}
              required
              className="admin-input"
            />
          </label>
          <label>
            <span>使用次数上限（留空不限）</span>
            <input
              type="number"
              value={newMax}
              onChange={(e) => setNewMax(e.target.value)}
              min={1}
              placeholder="例如 100"
              className="admin-input"
            />
          </label>
          <label>
            <span>备注（仅运营自见）</span>
            <input
              type="text"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="例如 小红书首发"
              maxLength={255}
              className="admin-input"
            />
          </label>
          <button
            type="submit"
            disabled={creating}
            className="admin-btn admin-btn--primary"
          >
            {creating ? '创建中...' : '创建兑换码'}
          </button>
        </form>
      </section>

      {err && <p className="admin-err">{err}</p>}

      {/* 列表 */}
      <section className="admin__panel">
        <div className="admin__panel-head">
          <h2>全部兑换码（{codes.length}）</h2>
          <button onClick={fetchCodes} className="admin-btn admin-btn--ghost">
            刷新
          </button>
        </div>
        {loading ? (
          <p>加载中...</p>
        ) : codes.length === 0 ? (
          <p className="admin-empty">还没有兑换码</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>兑换码</th>
                <th>奖励</th>
                <th>使用情况</th>
                <th>备注</th>
                <th>创建时间</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {codes.map((c) => (
                <tr key={c.id}>
                  <td>
                    <code className="admin-code">{c.code}</code>
                  </td>
                  <td>{Math.round(c.bonus_seconds / 60)} 分钟</td>
                  <td>
                    {c.used_count} / {c.max_uses ?? '∞'}
                  </td>
                  <td className="admin-note">{c.note || '—'}</td>
                  <td>{new Date(c.created_at).toLocaleString()}</td>
                  <td>
                    <button
                      onClick={() => deleteCode(c.id, c.code)}
                      className="admin-btn admin-btn--danger"
                    >
                      <Icon name="close" size={14} />
                      删除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
