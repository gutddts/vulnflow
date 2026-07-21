<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://img.shields.io/badge/VulnFlow-FF6B6B?style=for-the-badge&logo=matrix&logoColor=white&label=⚡">
    <img alt="VulnFlow" src="https://img.shields.io/badge/⚡VulnFlow-FF6B6B?style=for-the-badge&logo=matrix&logoColor=white" width="280">
  </picture>
</p>

<p align="center">
  <b>AI Native 多智能体渗透测试平台</b><br>
  <i>Autonomous Security Assessment · Collaborative Intelligence · Full‑Kill‑Chain Automation</i>
</p>

<p align="center">
  <a href="#-项目简介"><img src="https://img.shields.io/badge/项目简介-18181B?style=flat-square&logo=openai&logoColor=white" alt="Overview"></a>
  <a href="#-系统架构"><img src="https://img.shields.io/badge/系统架构-18181B?style=flat-square&logo=diagramsdotnet&logoColor=white" alt="Architecture"></a>
  <a href="#-核心功能"><img src="https://img.shields.io/badge/核心功能-18181B?style=flat-square&logo=starship&logoColor=white" alt="Features"></a>
  <a href="#-快速开始"><img src="https://img.shields.io/badge/快速开始-18181B?style=flat-square&logo=docker&logoColor=white" alt="Quick Start"></a>
  <a href="#-技术栈"><img src="https://img.shields.io/badge/技术栈-18181B?style=flat-square&logo=stackshare&logoColor=white" alt="Tech Stack"></a>
  <a href="#-开发指南"><img src="https://img.shields.io/badge/开发指南-18181B?style=flat-square&logo=git&logoColor=white" alt="Development"></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.11%2B-3776AB?style=flat-square&logo=python&logoColor=white" alt="Python 3.11+">
  <img src="https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi&logoColor=white" alt="FastAPI">
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=white" alt="React 19">
  <img src="https://img.shields.io/badge/TypeScript-6.0-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat-square&logo=postgresql&logoColor=white" alt="PostgreSQL 16">
  <img src="https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white" alt="Docker">
  <img src="https://img.shields.io/badge/LangGraph-FF6B6B?style=flat-square&logo=graph&logoColor=white" alt="LangGraph">
  <img src="https://img.shields.io/badge/Qdrant-000000?style=flat-square&logo=qdrant&logoColor=white" alt="Qdrant">
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square" alt="MIT License">
</p>

---

## 📋 项目简介

**VulnFlow** 是一款 **AI Native** 的渗透测试智能体平台，通过**多智能体协作架构**整合大语言模型（LLM）与业界安全工具链，实现从信息收集到漏洞利用的全流程自动化渗透测试。

> **从侦察到横向移动 —— AI Agents 自主规划策略、调度工具、分析结果、生成报告，并根据发现实时调整攻击路径。**

### 为什么选择 VulnFlow？

| 传统渗透测试的痛点 | VulnFlow 的解决之道 |
|-------------------|-------------------|
| 🔴 人工测试耗时耗力，覆盖面有限 | ✅ 多 Agent 7×24 小时自动化执行完整攻击链 |
| 🔴 安全工具各自为战，缺乏上下文关联 | ✅ LLM 驱动的统一编排，实时策略自适应调整 |
| 🔴 漏洞散落在不同工具的输出中，整理繁琐 | ✅ 结构化关联分析 + 自动化报告引擎 |
| 🔴 团队知识沉淀困难，重复踩坑 | ✅ RAG 向量知识库，沉淀组织级安全经验 |
| 🔴 多工具工作流组合复杂、难以复用 | ✅ 可视化 DAG 工作流编辑器，一键编排与执行 |

---

## 🏗️ 系统架构

VulnFlow 基于 [LangGraph](https://github.com/langchain-ai/langgraph) 构建**五智能体认知架构**，模拟人类渗透测试团队的分工协作模式 —— 规划、执行、分析、评估、报告，形成完整的认知闭环。

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         VULNFLOW 系统架构总览                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                            客户端层 (CLIENT LAYER)                     │  │
│  │  ┌─────────────┐  ┌──────────────┐  ┌────────────┐  ┌────────────┐  │  │
│  │  │  仪表盘 &   │  │  DAG 工作流  │  │  实时渗透   │  │  报告       │  │  │
│  │  │  监控大屏    │  │  编辑器      │  │  终端       │  │  查看器     │  │  │
│  │  └─────────────┘  └──────────────┘  └────────────┘  └────────────┘  │  │
│  └──────────────────────────┬───────────────────────────────────────────┘  │
│                             │                                              │
│  ┌──────────────────────────▼───────────────────────────────────────────┐  │
│  │                     API 网关 (Nginx)                                   │  │
│  │              负载均衡 · SSL 终止 · 速率限制 · 反向代理                  │  │
│  └──────────────────────────┬───────────────────────────────────────────┘  │
│                             │                                              │
│  ┌──────────────────────────▼───────────────────────────────────────────┐  │
│  │                     后端服务层 (FastAPI)                                │  │
│  │  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────────┐ │  │
│  │  │ 认证与  │ │ REST API │ │WebSocket │ │ SSE      │ │ 任务队列     │ │  │
│  │  │ 权限控制 │ │ 接口     │ │ /ws      │ │ /stream  │ │ (Celery)    │ │  │
│  │  └─────────┘ └──────────┘ └──────────┘ └──────────┘ └──────┬──────┘ │  │
│  └─────────────────────────────────────────────────────────────┼────────┘  │
│                                                                │           │
│  ┌─────────────────────────────────────────────────────────────▼────────┐  │
│  │                      AI 编排层 (AI ORCHESTRATION LAYER)                │  │
│  │                                                                        │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────────┐  │  │
│  │  │ Planner   │  │ Executor   │  │ Analyzer   │  │ Reporter       │  │  │
│  │  │ 规划智能体  │──▶ 执行智能体  │──▶ 分析智能体  │──▶ 报告智能体     │  │  │
│  │  │ (攻击策略) │  │ (工具调度)  │  │ (漏洞关联)  │  │ (报告生成)     │  │  │
│  │  └─────┬──────┘  └─────┬──────┘  └──────┬─────┘  └────────┬───────┘  │  │
│  │        │               │                │                  │          │  │
│  │        └───────────────┴────────────────┴──────────────────┘          │  │
│  │                              │                                        │  │
│  │                    ┌─────────▼──────────┐                             │  │
│  │                    │  Evaluator 评估智能体 │                             │  │
│  │                    │  (元认知 · 决策是否继续/优化/终止)                 │  │
│  │                    └────────────────────┘                             │  │
│  │                                                                        │  │
│  │  ┌────────────────────────────────────────────────────────────────┐   │  │
│  │  │              LangGraph 工作流引擎                                │   │  │
│  │  │  状态图 · 条件路由 · 递归限制 · 工具调用 · 流式输出              │   │  │
│  │  └────────────────────────────────────────────────────────────────┘   │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │                   LLM 模型层 (LLM PROVIDER LAYER)                       │  │
│  │  ┌──────────┐  ┌──────────┐  ┌─────────────┐  ┌──────────────────┐   │  │
│  │  │ OpenAI   │  │ Claude   │  │ Ollama      │  │ 自定义模型适配器  │   │  │
│  │  │ GPT-4o   │  │ Opus/Sonnet│  │ 本地模型    │  │ (Ollama/TGI/vLLM)│   │  │
│  │  └──────────┘  └──────────┘  └─────────────┘  └──────────────────┘   │  │
│  │  ┌────────────────────────────────────────────────────────────────┐   │  │
│  │  │  智能决策链路：Chain-of-Thought 推理 → 工具选择 → 参数生成 →     │   │  │
│  │  │  结果评估 → 自适应迭代                                         │   │  │
│  │  └────────────────────────────────────────────────────────────────┘   │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │                      安全工具链 (SECURITY TOOLCHAIN)                     │  │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌──────────┐ ┌─────────┐ │  │
│  │  │ Nmap   │ │ Nuclei │ │ SQLMap │ │ FFUF   │ │Metasploit│ │ Subfinder│ │  │
│  │  │ 端口扫描 │ │ CVE检测 │ │ SQL注入 │ │ 目录模糊│ │ 漏洞利用  │ │ 子域名   │ │  │
│  │  └────────┘ └────────┘ └────────┘ └────────┘ └──────────┘ └─────────┘ │  │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌──────────────────────┐ │  │
│  │  │ httpx  │ │ Katana │ │ 自定义  │ │ Docker │ │ 100+ 内置渗透技能    │ │  │
│  │  │ 存活探测│ │ 爬虫   │ │ 脚本   │ │ 沙箱   │ │ (持续更新)           │ │  │
│  │  └────────┘ └────────┘ └────────┘ └────────┘ └──────────────────────┘ │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │                      数据基础设施 (DATA INFRASTRUCTURE)                  │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────┐  ┌──────┐  ┌─────────┐ │  │
│  │  │PostgreSQL│  │  Redis   │  │Elasticsearch  │  │MinIO │  │ Qdrant  │ │  │
│  │  │ 主数据库  │  │ 缓存/队列 │  │ 日志与全文搜索 │  │对象存储│  │ 向量库  │ │  │
│  │  │          │  │          │  │               │  │      │  │ (RAG)   │ │  │
│  │  └──────────┘  └──────────┘  └───────────────┘  └──────┘  └─────────┘ │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 智能体协作流程

```
用户输入 (目标 URL / 描述 / 项目范围)
    │
    ▼
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   Planner        │────▶│   Executor       │────▶│   Analyzer       │
│   (规划智能体)    │     │   (执行智能体)    │     │   (分析智能体)    │
│                  │     │                  │     │                  │
│  · 分解攻击目标    │     │  · 调度安全工具    │     │  · 关联多源发现   │
│  · CoT 推理攻击路径│     │  · 执行利用链     │     │  · 提取利用证据   │
│  · 生成 DAG 方案  │     │  · 采集原始数据   │     │  · 富化 RAG 上下文│
│  · 遴选可用技能   │     │  · 处理超时/重试  │     │  · 误报智能过滤   │
│  · 风险预评估     │     │  · 沙箱隔离执行   │     │  · 漏洞危害评级   │
└──────────────────┘     └────────┬─────────┘     └────────┬─────────┘
       │                          │                        │
       └──────────────────────────┴────────────────────────┘
                                  │
                                  ▼
                        ┌──────────────────┐
                        │   Evaluator      │
                        │   (评估智能体)    │
                        │                  │
                        │  · 评估任务完整度  │
                        │  · 验证发现准确性  │
                        │  · 分析覆盖率缺口  │
                        │  · 决策：          │
                        │    ▶ 继续迭代     │
                        │    ▶ 调整策略     │
                        │    ▶ 终止任务     │
                        └────────┬─────────┘
                                 │
                        ┌────────▼─────────┐
                        │   Reporter       │
                        │   (报告智能体)    │
                        │                  │
                        │  · 生成结构化报告  │
                        │  · PDF/HTML/MD   │
                        │  · 风险评分与分布  │
                        │  · 修复建议清单    │
                        │  · 证据包打包      │
                        └──────────────────┘
```

---

## ✨ 核心功能

### 🤖 多智能体协作引擎

| 智能体 | 职责 | 核心技术 |
|--------|------|---------|
| **Planner** 规划智能体 | 拆解安全目标，生成攻击路径 DAG，Chain-of-Thought 推理 | LangGraph · CoT Prompting |
| **Executor** 执行智能体 | 编排安全工具执行，智能选择参数，管理 Docker 沙箱 | LangChain Tools · Docker SDK |
| **Analyzer** 分析智能体 | 跨工具关联发现，误报过滤，RAG 知识富化 | RAG · Embedding · Semantic Search |
| **Evaluator** 评估智能体 | 元认知层：评估覆盖率，决策继续/优化/终止 | 反射机制 · 状态评估 |
| **Reporter** 报告智能体 | 生成专业渗透测试报告，包含修复建议 | WeasyPrint · Jinja2 模板 |

### 🔬 智能扫描与利用

- **自动化信息收集** — 子域名枚举、端口扫描、服务指纹识别、WAF 检测、技术栈分析
- **漏洞自动化发现** — Nuclei CVE 模板匹配、SQL/XSS/SSRF/命令注入检测、目录模糊测试
- **智能利用链生成** — AI 根据上下文自动选择 exploitation 路径，集成 Metasploit
- **持续学习进化** — 每次渗透发现沉淀到向量知识库，下次评估自动引用历史经验

### 🎯 RAG 安全知识库

- **语义检索** — 通过向量相似度检索相关 CVE、利用技术、加固建议
- **组织记忆** — 沉淀团队成员的安全知识，新成员不再重复研究
- **多 Embedding 支持** — Qdrant 向量数据库，可切换多种 Embedding 模型

### 📊 实时协作与监控

- **实时渗透终端** — WebSocket 流式输出每个 Agent 的推理过程和工具执行结果
- **事件流推送** — SSE 实时推送扫描进度、漏洞发现、状态变更
- **多通知渠道** — 邮件、Slack、Discord、企业微信、钉钉

### 📈 智能报告系统

- **自动生成报告** — PDF / HTML / Markdown 三种格式，含高管摘要和技术附录
- **风险评分** — CVSS 3.1 基础评分 + 自定义权重聚合
- **修复路线图** — 按优先级排序的修复建议，附带操作步骤
- **证据打包** — 截图、工具原始输出、PoC 代码的统一归档

### 🛡️ 企业级特性

- **RBAC 权限控制** — 管理员 / 分析师 / 观察者三种角色，细粒度权限
- **完整审计日志** — Elasticsearch 结构化存储所有操作记录
- **多项目隔离** — 每个项目独立的作用域、凭据、发现和报告
- **离线部署** — 支持完全离线/物理隔离环境部署，内置导出导入工具
- **健康监控** — 10+ 微服务的自动健康检查与状态告警

---

## 🚀 快速开始

### 环境要求

- Docker Engine 20.10+ & Docker Compose V2
- 最低 8 GB 内存（推荐 16 GB）
- 20 GB 可用磁盘空间

### 一键部署

```bash
# 克隆项目
git clone https://github.com/gutddts/vulnflow.git
cd vulnflow

# 一键部署
make setup

# 或手动部署：
cp .env.example .env
# 编辑 .env 配置密钥、API Key 等
docker compose up -d --build
docker compose exec backend alembic upgrade head
docker compose exec backend python -m app.cli create-admin \
  --email admin@vulnflow.local \
  --password YourPassword123 \
  --name "管理员"
```

### 服务地址

| 服务 | 地址 | 说明 |
|------|------|------|
| **前端控制台** | [http://localhost:3000](http://localhost:3000) | React 管理界面 |
| **API 文档** | [http://localhost:8000/docs](http://localhost:8000/docs) | Swagger / OpenAPI |
| **API 文档 (ReDoc)** | [http://localhost:8000/redoc](http://localhost:8000/redoc) | ReDoc 格式 |
| **MinIO 控制台** | [http://localhost:9001](http://localhost:9001) | 对象存储管理 |
| **Qdrant 面板** | [http://localhost:6333/dashboard](http://localhost:6333/dashboard) | 向量数据库管理 |
| **Elasticsearch** | [http://localhost:9200](http://localhost:9200) | 日志搜索 |

> 默认管理员：`admin@vulnflow.local` / `admin@123` — **首次登录后请立即修改密码！**

---

## 🛠 技术栈

| 层级 | 技术选型 | 说明 |
|------|---------|------|
| **前端框架** | React 19 · TypeScript 6.0 · Tailwind CSS 4 | 现代化响应式 UI |
| **UI 组件库** | Shadcn UI · Lucide Icons | 高定制性组件体系 |
| **状态管理** | Zustand 5 · TanStack React Query | 轻量高性能状态方案 |
| **后端框架** | Python 3.12+ · FastAPI · SQLAlchemy 2.0 (async) | 高性能异步 API |
| **数据校验** | Pydantic 2 · Zod 4 | 前后端双端校验 |
| **AI 编排** | LangChain 0.2 · LangGraph · LangChain Community | 多智能体工作流 |
| **LLM 模型** | OpenAI GPT-4o · Claude Opus/Sonnet · Ollama (本地模型) | 灵活切换模型供应商 |
| **任务队列** | Celery 5.4 · Redis 7 (Broker/Backend) | 分布式异步任务调度 |
| **主数据库** | PostgreSQL 16 (tuned config) | 关系型数据存储 |
| **缓存** | Redis 7 | 会话管理 & 缓存加速 |
| **搜索引擎** | Elasticsearch 8.15 | 日志与全文搜索分析 |
| **向量数据库** | Qdrant | RAG 知识库 Embedding 存储 |
| **对象存储** | MinIO (S3 兼容) | 截图、报告、证据文件 |
| **容器化** | Docker · Docker Compose · 多阶段构建 | 一键部署 & 工具沙箱 |
| **安全沙箱** | Docker-in-Docker (socket bind) | 隔离执行安全工具 |
| **认证授权** | JWT · bcrypt · RBAC | 安全的身份与权限管理 |
| **表单 & 路由** | React Hook Form · React Router 7 | 前端路由与表单管理 |

---

## 📁 项目结构

```
vulnflow/
├── backend/                          # Python FastAPI 后端
│   ├── app/
│   │   ├── ai/                       # AI 编排层
│   │   │   ├── agents/               # 智能体实现 (Planner/Executor/Analyzer 等)
│   │   │   ├── graph/                # LangGraph 状态图 & 监督器
│   │   │   ├── llm/                  # LLM 供应商工厂 & 模型配置
│   │   │   └── prompts/              # 各智能体系统提示词
│   │   ├── api/                      # REST & WebSocket API 路由
│   │   ├── core/                     # 核心基础设施 (DB/Redis/安全/日志)
│   │   ├── models/                   # SQLAlchemy ORM 模型
│   │   ├── schemas/                  # Pydantic 请求/响应模型
│   │   ├── services/                 # 业务逻辑服务
│   │   ├── tasks/                    # Celery 后台任务
│   │   └── utils/                    # 通用工具函数
│   ├── alembic/                      # 数据库迁移脚本
│   ├── tests/                        # 测试套件 (单元/集成/e2e)
│   └── Dockerfile
├── frontend/                         # React TypeScript 前端
│   ├── src/
│   │   ├── components/               # 可复用 UI 组件
│   │   │   ├── chat/                 # AI 对话界面组件
│   │   │   ├── common/               # 通用 UI 原语
│   │   │   ├── dashboard/            # 仪表盘组件 & 图表
│   │   │   ├── layout/               # 应用布局 (侧边栏/顶栏)
│   │   │   ├── settings/             # 配置面板
│   │   │   ├── skills/               # 技能管理组件
│   │   │   └── ui/                   # Shadcn UI 原语
│   │   ├── pages/                    # 路由页面组件
│   │   ├── hooks/                    # 自定义 React Hooks
│   │   ├── stores/                   # Zustand 状态管理
│   │   ├── types/                    # TypeScript 类型定义
│   │   └── lib/                      # 工具模块
│   └── Dockerfile
├── docker/                           # 基础设施配置
│   ├── nginx/                        # Nginx 反向代理配置
│   ├── postgres/                     # PostgreSQL 初始化脚本
│   ├── redis/                        # Redis 配置
│   └── elasticsearch/                # Elasticsearch 配置
├── scripts/                          # 运维 & DevOps 脚本
│   ├── setup.sh                      # 一键部署
│   ├── backup.sh                     # 数据备份
│   ├── healthcheck.sh                # 健康检查
│   └── offline-export.sh             # 离线部署导出
├── skills/                           # 自定义安全技能定义
│   ├── port_scan/                    # 端口扫描技能
│   ├── subdomain_enum/               # 子域名枚举技能
│   ├── nuclei_scan/                  # Nuclei 漏洞扫描技能
│   ├── dir_bruteforce/               # 目录爆破技能
│   ├── sqli/                         # SQL 注入检测技能
│   ├── xss/                          # XSS 检测技能
│   └── waf_detect/                   # WAF 检测技能
├── docker-compose.yml                # 多服务编排
├── Makefile                          # 命令快捷键
└── .env.example                      # 环境变量模板
```

---

## 📖 使用指南

### 执行一次渗透测试

1. **创建项目** — 定义测试范围、目标 URL、授权参数
2. **配置 Agent** — 选择 LLM 模型、Agent 工作模式、最大迭代次数
3. **启动测试** — 一键启动自动化渗透，实时流式查看 Agent 推理与工具输出
4. **审查结果** — 查看 Analyzer 关联后的漏洞列表，含严重等级、证据链
5. **生成报告** — 一键导出专业渗透测试报告（PDF / HTML / Markdown）

### Agent 工作模式

| 模式 | 说明 | 适用场景 |
|------|------|---------|
| **🚀 Auto 全自动** | Agent 自主规划、执行、分析、迭代，无需人工介入 | 已知环境 · CI/CD 管线 |
| **🔍 Semi 半自动** | Agent 提出建议，关键步骤（利用、提权）需人工审批 | 生产环境渗透 |
| **📋 Review 审核** | Agent 执行后呈现结果，每一步需人工确认 | CTF · 教学 · 审计 |

### 工作流编排

可视化 DAG 编辑器支持自定义渗透管线，拖拽即可编排：

```
[信息收集] ──▶ [漏洞扫描] ──▶ [漏洞利用] ──▶ [后渗透]
    │              │              │              │
    ▼              ▼              ▼              ▼
[子域名枚举]   [Nuclei CVE扫描]  [Metasploit]   [权限提升]
[端口扫描]     [SQL注入检测]     [自定义Exploit]  [横向移动]
[指纹识别]     [目录模糊测试]    [密码攻击]      [数据提取]
[WAF检测]      [XSS检测]        [SSRF利用]      [痕迹清理]
```

---

## 🔧 开发指南

### 本地开发环境

```bash
# 启动基础设施
docker compose up -d postgres redis elasticsearch minio qdrant

# 启动后端 (./backend)
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# 启动前端 (./frontend)
npm install
npm run dev

# 启动 Celery Worker (./backend)
celery -A app.tasks.celery_app worker --loglevel=info --concurrency=4
```

### 运行测试

```bash
make test              # 运行全部测试
make test-coverage     # 带覆盖率报告
make test-frontend     # 仅前端测试
```

### 代码规范

```bash
cd backend && ruff check .    # Python 代码检查
cd backend && mypy .          # Python 类型检查
cd frontend && npm run lint   # 前端代码检查 (oxlint)
```

---

## 📦 运维管理

### 数据备份

```bash
make backup                          # 全量备份
BACKUP_PATH=/mnt/backups make backup  # 自定义备份路径
BACKUP_RETENTION_DAYS=60 make backup  # 保留策略
```

备份内容：PostgreSQL 逻辑备份（自定义格式 + SQL）、数据卷（MinIO / Qdrant / ES / Redis）、配置文件（`docker-compose.yml` / `.env`）

### 健康检查

```bash
make healthcheck
# 输出示例:
# ╔═════════════════════════════════════╗
# ║  总计: 20  正常: 19  告警: 1  异常: 0  ║
# ╚═════════════════════════════════════╝
```

### 离线部署（物理隔离环境）

```bash
make offline-export                              # 在有网环境生成离线包
scp offline-package/vulnflow-offline-*.tar.gz user@target:/opt/
tar xzf vulnflow-offline-*.tar.gz
cd vulnflow-offline-*/ && ./install-offline.sh
```

---

## 🌐 环境变量

| 变量 | 说明 | 必填 | 默认值 |
|------|------|------|--------|
| `SECRET_KEY` | 应用加密密钥 | **是** | — |
| `JWT_SECRET_KEY` | JWT 签名密钥 | **是** | — |
| `POSTGRES_PASSWORD` | 数据库密码 | **是** | `vulnflow_secret` |
| `MINIO_ACCESS_KEY` | MinIO 访问密钥 | 否 | `minioadmin` |
| `MINIO_SECRET_KEY` | MinIO 密钥 | 否 | `minioadmin` |
| `OPENAI_API_KEY` | OpenAI API Key | 否* | — |
| `ANTHROPIC_API_KEY` | Anthropic API Key | 否* | — |
| `OLLAMA_BASE_URL` | 本地 LLM 地址 | 否 | `http://localhost:11434` |

*\* 至少需要配置一个 LLM 供应商的 Key。*

---

## 🔒 安全声明

本工具仅供**授权的安全测试和学术研究**使用。使用前请确保：

- 已获得目标系统的**书面授权**
- 遵守当地法律法规
- 合理、负责任地使用平台功能

> **作者对任何未授权或非法使用本平台的行为不承担任何责任。**

---

## 🤝 参与贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交改动 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 提交 Pull Request

---

## 📄 开源协议

本项目采用 [MIT License](LICENSE) 开源。

---

<p align="center">
  为安全研究社区而建 ❤️<br>
  <b>VulnFlow</b> — <i>让渗透测试更智能、更高效、更协作</i>
</p>

<p align="center">
  <a href="https://github.com/gutddts/vulnflow">
    <img src="https://img.shields.io/github/stars/gutddts/vulnflow?style=social" alt="GitHub stars">
  </a>
  <a href="https://github.com/gutddts/vulnflow">
    <img src="https://img.shields.io/github/forks/gutddts/vulnflow?style=social" alt="GitHub forks">
  </a>
</p>
