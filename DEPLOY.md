# VulnFlow 一键部署与启动指南

## 环境要求

| 环境 | 最低版本 | 推荐方式 |
|------|---------|---------|
| Docker（推荐）| Docker Desktop 4.0+ | **一键部署** |
| Python | 3.11+ | 本地便携 |
| Node.js | 18+ | 本地便携 |
| PostgreSQL | 16.x（便携版自带） | 本地便携 |
| Redis | 7.x（便携版自带） | 本地便携 |

---

## 方式一：Docker Compose（推荐，一劳永逸）

在安装了 Docker Desktop 的环境中运行速度最快，**无需手动装任何依赖**。

```bash
# 进入项目根目录，执行：
docker compose up -d --build

# 初始化数据库（仅首次）：
docker compose exec backend python -m app.init_db
```

访问：
- 前端：http://localhost:3000
- API 文档：http://localhost:8000/docs
- 管理员：`admin@vulnflow.local` / `admin@123`

---

## 方式二：本地便携模式（无 Docker）

> **⚠ 重要：项目路径不能包含中文字符！**
>
> 如果路径包含中文（如 `D:\1-yinyong\ai编程\...`），cmd.exe 会因编码问题崩溃。
> 请将项目复制到纯英文路径再操作，例如：
> - `C:\vulnflow\`
> - `D:\vulnflow-project\`

### Windows 快速启动

方法 A：右键 `start_vulnflow.ps1` → **"Run with PowerShell"**（推荐，路径有中文也能用）

方法 B：复制到纯英文路径后，双击 `start_vulnflow.bat`

### 手动分步启动（排错用）

打开 4 个 `PowerShell 7` 或 `Windows Terminal` 窗口：

**窗口 1 — PostgreSQL**
```powershell
cd scripts\postgresql
.\pgsql\bin\pg_ctl.exe -D .\data -l .\data\pg.log start
```

**窗口 2 — Redis**
```powershell
cd scripts\redis
.\redis-server.exe redis.windows.conf
```

**窗口 3 — 后端**
```powershell
cd backend
.venv\Scripts\uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

**窗口 4 — 前端**
```powershell
cd frontend
C:\Users\86133\.workbuddy\binaries\node\versions\22.22.2\node.exe node_modules\vite\bin\vite.js --port 3000 --host
```

### Linux / macOS 启动

```bash
cd /opt/vulnflow

# 方式 A：Docker（推荐）
docker compose up -d --build
docker compose exec backend python -m app.init_db

# 方式 B：本地
./scripts/postgresql/bin/pg_ctl -D ./scripts/postgresql/data -l pg.log start
redis-server ./scripts/redis/redis.conf &
cd backend && source .venv/bin/activate && uvicorn app.main:app --host 0.0.0.0 --port 8000 &
cd frontend && node node_modules/vite/bin/vite.js --port 3000 --host &
```

---

## 停止服务

```powershell
# Windows - 右键 stop_vulnflow.ps1 → Run with PowerShell

# 或手动停止：
taskkill /F /IM python.exe
taskkill /F /IM node.exe
taskkill /F /IM redis-server.exe
cd scripts\postgresql && .\pgsql\bin\pg_ctl.exe -D .\data stop

# Docker 停止
docker compose down
```

---

## 管理员账号

| 字段 | 值 |
|------|-----|
| 邮箱 | `admin@vulnflow.local` |
| 密码 | `admin@123` |
| 角色 | admin |

---

## 常见问题

### Q：postgresql 启动超时
**原因**：WAL 日志过多导致 checkpoint 延迟（可能 2 分钟）。
**解决**：等待即可，或删除 `scripts\postgresql\data\pg_wal\` 中的旧日志。

### Q：start.bat 双击秒关
**原因**：项目路径含中文，cmd.exe 解析 `%~dp0` 时崩溃。
**解决**：右键 `start_vulnflow.ps1` → "Run with PowerShell"，或将项目复制到纯英文路径。

### Q：后端启动失败
```powershell
# 检查日志
cd backend
Get-Content uvicorn-error.log -Tail 20

# 确保依赖已安装
.venv\Scripts\pip install -r requirements.txt
```

### Q：前端启动失败
```powershell
cd frontend
# 确保依赖已安装
npm install
# 手动启动
node node_modules/vite/bin/vite.js --port 3000 --host
```

---

## 访问入口

| 服务 | 地址 | 说明 |
|------|------|------|
| 前端 | http://localhost:3000 | VulnFlow 仪表盘 |
| API 文档 | http://localhost:8000/docs | Swagger UI |
| 健康检查 | http://localhost:8000/health | JSON 状态 |
</content>
