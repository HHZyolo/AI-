# AI 陪玩搭子 · 后端

面向 PC 战术 FPS 玩家的 AI 语音陪玩 MVP 后端。

## 技术栈

- Python 3.12 + FastAPI
- SQLAlchemy 2.0（异步）· SQLite 起步，上线前切 MySQL
- WebSocket 流式编排 ASR / LLM / TTS（后续功能）

## 本地启动

```bash
cd backend

# 首次：创建虚拟环境（需要 Python 3.12）
/opt/homebrew/bin/python3.12 -m venv .venv
.venv/bin/pip install -r requirements.txt

# 配置
cp .env.example .env        # 按需修改

# 启动（开发模式，热重载）
.venv/bin/uvicorn app.main:app --reload
```

服务默认监听 `http://127.0.0.1:8000`，交互式文档在 `/docs`。

## 接口

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/` | 服务信息 |
| GET | `/health` | 轻量探活 |
| GET | `/health/db` | 数据库连通性探活 |
| POST | `/auth/register` | 邮箱+密码注册，自动发放试用额度，返回 JWT |
| POST | `/auth/login` | 邮箱+密码登录，返回 JWT |
| GET | `/users/me` | 查询当前用户信息与余额（需 `Authorization: Bearer <token>`） |

### 用户系统说明

- **账号**：邮箱（`EmailStr` 校验格式）+ 密码（最少 8 位，bcrypt 哈希存储）。
  邮箱大小写不敏感，统一按小写入库。
- **注册**：成功即建号、发放试用额度并直接签发 JWT，无需再调用登录。
  重复邮箱返回 409；登录失败统一返回「邮箱或密码错误」，不暴露账号是否存在。
- **额度**：新用户发放 `TRIAL_SECONDS`（默认 600 秒）。余额是单一秒数池
  `balance_seconds`，试用与付费共用，语音对话按秒扣减。
- **找回密码**：暂未实现（后续补「邮箱验证 + 重置」）。

## 目录结构

```
backend/
  app/
    main.py           应用入口、生命周期、中间件、路由注册
    config.py         配置管理（.env → Settings 单例）
    logging_conf.py   日志配置
    database.py       异步数据库引擎、Base、get_db 依赖
    api/
      health.py       健康检查
      auth.py         /auth/register、/auth/login
      users.py        /users/me
    models/
      user.py         User（邮箱 + 密码哈希 + 余额）
    schemas/
      auth.py         请求/响应模型
    services/
      password.py     bcrypt 哈希与校验
      security.py     JWT 签发 / 解码 / get_current_user 依赖
  data/               SQLite 数据库文件（不提交）
  requirements.txt
  .env.example
```

## 切换到 MySQL

把 `.env` 的 `DATABASE_URL` 改为：

```
DATABASE_URL=mysql+aiomysql://user:pass@127.0.0.1:3306/aipeiwan
```

并 `pip install aiomysql`，业务代码无需改动。
