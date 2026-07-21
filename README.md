<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://img.shields.io/badge/VulnFlow-FF6B6B?style=for-the-badge&logo=matrix&logoColor=white&label=⚡">
    <img alt="VulnFlow" src="https://img.shields.io/badge/⚡VulnFlow-FF6B6B?style=for-the-badge&logo=matrix&logoColor=white" width="280">
  </picture>
</p>

<p align="center">
  <b>AI-Native Multi-Agent Penetration Testing Platform</b><br>
  <i>Autonomous security assessment driven by collaborative intelligence</i>
</p>

<p align="center">
  <a href="#-overview"><img src="https://img.shields.io/badge/Overview-18181B?style=flat-square&logo=openai&logoColor=white" alt="Overview"></a>
  <a href="#-architecture"><img src="https://img.shields.io/badge/Architecture-18181B?style=flat-square&logo=diagramsdotnet&logoColor=white" alt="Architecture"></a>
  <a href="#-key-features"><img src="https://img.shields.io/badge/Features-18181B?style=flat-square&logo=starship&logoColor=white" alt="Features"></a>
  <a href="#-quick-start"><img src="https://img.shields.io/badge/Quick_Start-18181B?style=flat-square&logo=docker&logoColor=white" alt="Quick Start"></a>
  <a href="#-tech-stack"><img src="https://img.shields.io/badge/Tech_Stack-18181B?style=flat-square&logo=stackshare&logoColor=white" alt="Tech Stack"></a>
  <a href="#-development"><img src="https://img.shields.io/badge/Development-18181B?style=flat-square&logo=git&logoColor=white" alt="Development"></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.11%2B-3776AB?style=flat-square&logo=python&logoColor=white" alt="Python 3.11+">
  <img src="https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi&logoColor=white" alt="FastAPI">
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=white" alt="React 19">
  <img src="https://img.shields.io/badge/TypeScript-6.0-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat-square&logo=postgresql&logoColor=white" alt="PostgreSQL 16">
  <img src="https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white" alt="Docker">
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square" alt="MIT License">
</p>

<p align="center">
  <a href="README.zh-CN.md">🇨🇳 中文</a>
</p>

---

## 📋 Overview

**VulnFlow** is a next-generation, AI-native penetration testing platform that orchestrates autonomous security assessments through a **multi-agent collaborative architecture**. By integrating Large Language Models (LLMs) with an extensive security toolchain, VulnFlow transforms the traditional penetration testing workflow into an intelligent, automated, and continuously learning system.

> **From reconnaissance to exploitation — VulnFlow's AI agents plan, execute, analyze, and report, adapting their strategy in real time based on findings.**

### Why VulnFlow?

| Challenge | VulnFlow Solution |
|-----------|-------------------|
| Manual pentesting is slow & labor-intensive | Autonomous AI agents handle the full kill chain 24/7 |
| Security tools lack contextual reasoning | LLM-powered orchestration with real-time strategy adaptation |
| Findings buried in fragmented outputs | Structured, correlated evidence with automated report generation |
| Knowledge silos across teams | RAG-powered knowledge base captures and retrieves organizational expertise |
| Complex multi-tool workflows | Visual DAG workflow editor with one-click execution |

---

## 🏗️ Architecture

VulnFlow employs a **five-agent cognitive architecture** built on [LangGraph](https://github.com/langchain-ai/langgraph), enabling dynamic planning, execution, and reflection — much like a human penetration testing team.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           VULNFLOW SYSTEM ARCHITECTURE                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                           CLIENT LAYER                                │  │
│  │  ┌─────────────┐  ┌──────────────┐  ┌────────────┐  ┌────────────┐  │  │
│  │  │   Dashboard  │  │  Workflow    │  │  Real-time  │  │  Report    │  │  │
│  │  │   & Metrics  │  │  Editor (DAG)│  │  Terminal   │  │  Viewer    │  │  │
│  │  └─────────────┘  └──────────────┘  └────────────┘  └────────────┘  │  │
│  └──────────────────────────┬───────────────────────────────────────────┘  │
│                             │                                              │
│  ┌──────────────────────────▼───────────────────────────────────────────┐  │
│  │                     API GATEWAY (Nginx)                                │  │
│  │              Load Balancing · SSL Termination · Rate Limiting          │  │
│  └──────────────────────────┬───────────────────────────────────────────┘  │
│                             │                                              │
│  ┌──────────────────────────▼───────────────────────────────────────────┐  │
│  │                     BACKEND (FastAPI)                                  │  │
│  │  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────────┐ │  │
│  │  │ Auth &  │ │ REST API │ │WebSocket │ │ SSE      │ │ Task Queue  │ │  │
│  │  │ RBAC    │ │ Endpoints│ │ /ws      │ │ /stream  │ │ (Celery)    │ │  │
│  │  └─────────┘ └──────────┘ └──────────┘ └──────────┘ └──────┬──────┘ │  │
│  └─────────────────────────────────────────────────────────────┼────────┘  │
│                                                                │           │
│  ┌─────────────────────────────────────────────────────────────▼────────┐  │
│  │                    AI ORCHESTRATION LAYER                              │  │
│  │                                                                        │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────────┐  │  │
│  │  │   Planner  │  │  Executor  │  │  Analyzer  │  │   Reporter     │  │  │
│  │  │   Agent    │──▶   Agent    │──▶   Agent    │──▶    Agent       │  │  │
│  │  │ (Strategy) │  │ (Tactics)  │  │ (Findings) │  │ (Reports)      │  │  │
│  │  └─────┬──────┘  └─────┬──────┘  └──────┬─────┘  └────────┬───────┘  │  │
│  │        │               │                │                  │          │  │
│  │        └───────────────┴────────────────┴──────────────────┘          │  │
│  │                              │                                        │  │
│  │                    ┌─────────▼──────────┐                             │  │
│  │                    │  Evaluator Agent   │                             │  │
│  │                    │  (Meta-Cognition)  │                             │  │
│  │                    └────────────────────┘                             │  │
│  │                                                                        │  │
│  │  ┌────────────────────────────────────────────────────────────────┐   │  │
│  │  │                   LangGraph Workflow Engine                     │   │  │
│  │  │  State Graph · Conditional Routing · Recursion Limits · Tools   │   │  │
│  │  └────────────────────────────────────────────────────────────────┘   │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │                      LLM PROVIDER LAYER                                 │  │
│  │  ┌──────────┐  ┌──────────┐  ┌─────────────┐  ┌──────────────────┐   │  │
│  │  │ OpenAI   │  │ Claude   │  │ Ollama (Local)│  │ Custom Adapters  │   │  │
│  │  │ GPT-4o   │  │ Opus 4.8 │  │ Llama/Mistral │  │ (Ollama/TGI/vLLM)│   │  │
│  │  └──────────┘  └──────────┘  └─────────────┘  └──────────────────┘   │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │                      SECURITY TOOLCHAIN                                  │  │
│  │  ┌──────┐ ┌────────┐ ┌───────┐ ┌──────┐ ┌───────────┐ ┌────────────┐ │  │
│  │  │Nmap  │ │ Nuclei │ │SQLMap │ │ FFUF │ │Metasploit │ │ Nuclei     │ │  │
│  │  │Scan. │ │ CVE     │ │Injection│ │Fuzz  │ │Exploit    │ │ Templates  │ │  │
│  │  └──────┘ └────────┘ └───────┘ └──────┘ └───────────┘ └────────────┘ │  │
│  │  ┌──────┐ ┌────────┐ ┌───────┐ ┌──────┐ ┌───────────┐ ┌────────────┐ │  │
│  │  │Subfinder│ │ httpx │ │Katana │ │ GAU  │ │ 自定义   │ │  Docker    │ │  │
│  │  │Enum.  │ │Probe  │ │Crawler│ │Urls  │ │ 脚本     │ │ Sandbox    │ │  │
│  │  └──────┘ └────────┘ └───────┘ └──────┘ └───────────┘ └────────────┘ │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │                      DATA INFRASTRUCTURE                                 │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────┐  ┌──────┐  ┌─────────┐ │  │
│  │  │PostgreSQL│  │  Redis   │  │Elasticsearch  │  │MinIO │  │ Qdrant  │ │  │
│  │  │Primary DB│  │Cache/Queue│  │ Logs & Search │  │Object│  │Vector DB│ │  │
│  │  │          │  │          │  │               │  │Store │  │ (RAG)   │ │  │
│  │  └──────────┘  └──────────┘  └───────────────┘  └──────┘  └─────────┘ │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Agent Collaboration Model

```
User Input
    │
    ▼
┌──────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   Planner    │────▶│    Executor      │────▶│    Analyzer      │
│  - Decomposes│     │  - Runs security │     │  - Correlates    │
│    objectives│     │    tools/skills  │     │    findings      │
│  - Generates │     │  - Executes      │     │  - Extracts      │
│    attack    │     │    exploit chain │     │    evidence      │
│    plan (DAG)│     │  - Collects raw  │     │  - Enriches with │
│  - Selects   │     │    output        │     │    RAG context   │
│    skills    │     └────────┬─────────┘     └────────┬─────────┘
└──────────────┘              │                        │
       │                      │                        │
       └──────────────────────┴────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │   Evaluator      │
                    │  - Assesses      │
                    │    completeness  │
                    │  - Validates     │
                    │    findings      │
                    │  - Decides:      │
                    │    continue/     │
                    │    refine/stop   │
                    └────────┬─────────┘
                             │
                    ┌────────▼─────────┐
                    │    Reporter      │
                    │  - Generates     │
                    │    structured    │
                    │    report (PDF/  │
                    │    HTML/MD)      │
                    │  - Risk scoring  │
                    │  - Remediation   │
                    │    recommendations│
                    └──────────────────┘
```

---

## ✨ Key Features

### 🤖 Multi-Agent Intelligence
- **Planner Agent** — Decomposes security objectives into attack plans using chain-of-thought reasoning; generates optimal DAG workflows dynamically
- **Executor Agent** — Orchestrates security tool execution with intelligent parameter selection; manages Docker-based sandboxed skill containers
- **Analyzer Agent** — Correlates findings across tools, extracts evidence, and enriches data via RAG-powered knowledge retrieval
- **Evaluator Agent** — Meta-cognitive layer that validates findings, assesses coverage, and decides whether to continue, refine, or conclude
- **Reporter Agent** — Produces structured penetration test reports with risk scoring, severity distribution, and remediation guidance

### 🔬 Intelligent Scanning & Exploitation
- **Automated Reconnaissance** — Subdomain enumeration, port scanning, service fingerprinting, technology stack detection
- **Vulnerability Discovery** — CVE matching via Nuclei templates, custom plugin system, intelligent false-positive filtering
- **Smart Exploitation** — AI-driven exploit chain generation with contextual awareness; Metasploit integration
- **Continuous Learning** — Findings enrich the vector knowledge base, improving future assessments

### 🎯 RAG-Powered Knowledge Base
- **Semantic Search** — Retrieve relevant CVEs, exploit techniques, and remediation steps via vector similarity
- **Organizational Memory** — Capture pentest findings as reusable knowledge; never repeat the same research twice
- **Multi-Model Support** — Qdrant vector database with configurable embedding models

### 📊 Real-Time Collaboration
- **Live PenTest Terminal** — WebSocket-powered real-time output streaming; watch each agent's reasoning and tool execution as it happens
- **Event Streaming** — Server-Sent Events (SSE) for live progress updates and finding notifications
- **Multi-Channel Notifications** — Email, Slack, Discord, WeChat Work, DingTalk

### 📈 Comprehensive Reporting
- **Auto-Generated Reports** — PDF, HTML, and Markdown output with executive summaries and technical appendices
- **Risk Scoring** — CVSS-based severity classification with weighted risk aggregation
- **Remediation Roadmap** — Prioritized fix recommendations with step-by-step guidance
- **Evidence Package** — Screenshots, raw tool outputs, and proof-of-concept code bundled together

### 🛡️ Enterprise Readiness
- **Role-Based Access Control** — Admin, analyst, viewer roles with fine-grained permissions
- **Audit Logging** — Complete operation trail with structured logging via Elasticsearch
- **Multi-Tenancy** — Isolated projects with independent scopes, credentials, and findings
- **Offline Deployment** — Air-gapped environment support with export/import tooling
- **Health Monitoring** — Built-in health checks for all 10+ microservices

---

## 🚀 Quick Start

### Prerequisites

- Docker Engine 20.10+ & Docker Compose V2
- At least 8 GB RAM (16 GB recommended)
- 20 GB available disk space

### One-Click Deployment

```bash
# Clone the repository
git clone https://github.com/gutddts/vulnflow.git
cd vulnflow

# One-command setup
make setup

# Or manually:
cp .env.example .env
# Edit .env to configure secrets and API keys
docker compose up -d --build
docker compose exec backend alembic upgrade head
docker compose exec backend python -m app.cli create-admin \
  --email admin@vulnflow.local \
  --password YourPassword123 \
  --name "Admin"
```

### Access Services

| Service | URL | Description |
|---------|-----|-------------|
| **Dashboard** | [http://localhost:3000](http://localhost:3000) | React management UI |
| **API Docs** | [http://localhost:8000/docs](http://localhost:8000/docs) | Swagger/OpenAPI |
| **API (ReDoc)** | [http://localhost:8000/redoc](http://localhost:8000/redoc) | ReDoc documentation |
| **MinIO Console** | [http://localhost:9001](http://localhost:9001) | Object storage management |
| **Qdrant Dashboard** | [http://localhost:6333/dashboard](http://localhost:6333/dashboard) | Vector DB management |
| **Elasticsearch** | [http://localhost:9200](http://localhost:9200) | Log search |

> Default admin credentials: `admin@vulnflow.local` / `admin@123` — **change immediately after first login.**

---

## 🛠 Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 19 · TypeScript 6.0 · Tailwind CSS 4 · Shadcn UI | Modern, responsive management interface |
| **Backend** | Python 3.12+ · FastAPI · SQLAlchemy 2.0 (async) · Pydantic 2 | High-performance async API with automatic validation |
| **AI/ML** | LangChain 0.2 · LangGraph · OpenAI · Claude · Ollama | Multi-agent orchestration with configurable LLM providers |
| **Task Queue** | Celery 5.4 + Redis 7 | Distributed asynchronous task execution |
| **Primary DB** | PostgreSQL 16 (with tuned config) | Relational data storage |
| **Cache** | Redis 7 | Session management & caching |
| **Search** | Elasticsearch 8.15 | Full-text search & structured logging |
| **Vector DB** | Qdrant | RAG knowledge base embeddings |
| **Storage** | MinIO (S3-compatible) | Screenshots, reports, evidence files |
| **Container** | Docker · Docker Compose · Multi-stage builds | Isolated deployment & skill sandboxing |
| **Sandbox** | Docker-in-Docker (socket bind) | Secure security tool execution |
| **Auth** | JWT · bcrypt · RBAC | Authentication & authorization |

---

## 📁 Project Structure

```
vulnflow/
├── backend/                          # Python FastAPI backend
│   ├── app/
│   │   ├── ai/                       # AI orchestration layer
│   │   │   ├── agents/               # Agent implementations (Planner, Executor, etc.)
│   │   │   ├── graph/                # LangGraph state graph & supervisor
│   │   │   ├── llm/                  # LLM provider factory & model configs
│   │   │   └── prompts/              # System prompts for each agent
│   │   ├── api/                      # REST & WebSocket API routes
│   │   ├── core/                     # Core infrastructure (DB, Redis, security, etc.)
│   │   ├── models/                   # SQLAlchemy ORM models
│   │   ├── schemas/                  # Pydantic request/response schemas
│   │   ├── services/                 # Business logic services
│   │   ├── tasks/                    # Celery background task definitions
│   │   └── utils/                    # Shared utilities
│   ├── alembic/                      # Database migration scripts
│   ├── tests/                        # Test suites (unit, integration, e2e)
│   └── Dockerfile
├── frontend/                         # React TypeScript frontend
│   ├── src/
│   │   ├── components/               # Reusable UI components
│   │   │   ├── chat/                 # AI chat interface components
│   │   │   ├── common/               # Shared UI primitives
│   │   │   ├── dashboard/            # Dashboard widgets & charts
│   │   │   ├── layout/               # App shell (sidebar, header, etc.)
│   │   │   ├── settings/             # Configuration panels
│   │   │   ├── skills/               # Skill management components
│   │   │   └── ui/                   # Shadcn UI primitives
│   │   ├── pages/                    # Route-level page components
│   │   ├── hooks/                    # Custom React hooks
│   │   ├── stores/                   # Zustand state management
│   │   ├── types/                    # TypeScript type definitions
│   │   └── lib/                      # Utility modules
│   └── Dockerfile
├── docker/                           # Infrastructure configurations
│   ├── nginx/                        # Nginx reverse proxy config
│   ├── postgres/                     # PostgreSQL init scripts
│   ├── redis/                        # Redis server config
│   └── elasticsearch/                # Elasticsearch config
├── scripts/                          # Operations & DevOps scripts
│   ├── setup.sh                      # One-click deployment
│   ├── backup.sh                     # Data backup utility
│   ├── healthcheck.sh                # Service health check
│   └── offline-export.sh             # Air-gapped deployment export
├── skills/                           # Custom security skill definitions
├── docker-compose.yml                # Multi-service orchestration
├── Makefile                          # Command shortcuts
└── .env.example                      # Environment variable template
```

---

## 📖 Usage Guide

### Creating a Security Assessment

1. **Create a Project** — Define scope, targets, and authorized testing parameters
2. **Configure AI Agents** — Select LLM provider, agent mode (auto/semi/review), and max iterations
3. **Run Assessment** — Launch automated pentest with real-time streaming output
4. **Review Findings** — Analyzer-correlated vulnerabilities with severity ratings and evidence
5. **Generate Report** — One-click professional report generation (PDF/HTML/MD)

### Agent Modes

| Mode | Description | Use Case |
|------|-------------|----------|
| **🚀 Auto** | Full autonomy — agents plan, execute, analyze, and iterate without human intervention | Known environments, CI/CD pipelines |
| **🔍 Semi** | Agents propose actions; human approves critical steps (exploitation, data exfiltration) | Production pentests |
| **📋 Review** | Agents execute and present findings for human validation at each stage | CTFs, educational, audit |

### Workflow Automation

Visual DAG workflow editor enables custom pentest pipelines:

```
[Reconnaissance] ──▶ [Vulnerability Scan] ──▶ [Exploitation] ──▶ [Post-Exploitation]
       │                       │                       │                    │
       ▼                       ▼                       ▼                    ▼
[Subdomain Enum.]       [Nuclei CVE Scan]        [Metasploit]          [Privilege
[Port Scanning]         [SQL Injection]          [Custom Exploit]      Escalation]
[Technology Detect.]    [Directory Fuzz]         [Password Attack]     [Lateral Movement]
```

---

## 🔧 Development

### Local Development Setup

```bash
# Start infrastructure services
docker compose up -d postgres redis elasticsearch minio qdrant

# Backend (in ./backend)
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend (in ./frontend)
npm install
npm run dev

# Celery Worker (in ./backend)
celery -A app.tasks.celery_app worker --loglevel=info --concurrency=4
```

### Testing

```bash
make test              # Run all tests
make test-coverage     # Tests with coverage report
make test-frontend     # Frontend tests only
```

### Linting & Formatting

```bash
cd backend && ruff check .    # Python linting
cd backend && mypy .          # Type checking
cd frontend && npm run lint   # Frontend linting (oxlint)
```

---

## 📦 Operations

### Backup & Restore

```bash
make backup                          # Full system backup
BACKUP_PATH=/mnt/backups make backup  # Custom backup path
BACKUP_RETENTION_DAYS=60 make backup  # Retention policy
```

Backups include: PostgreSQL dump (custom + SQL), data volumes (MinIO, Qdrant, Elasticsearch, Redis), and configuration files (`docker-compose.yml`, `.env`).

### Health Monitoring

```bash
make healthcheck
# Output: Total: 20  Healthy: 19  Warnings: 1  Errors: 0
```

### Offline / Air-Gapped Deployment

```bash
make offline-export                              # Generate offline package
scp offline-package/vulnflow-offline-*.tar.gz user@target:/opt/
tar xzf vulnflow-offline-*.tar.gz
cd vulnflow-offline-*/ && ./install-offline.sh
```

---

## 🌐 Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `SECRET_KEY` | Application encryption key | **Yes** | — |
| `JWT_SECRET_KEY` | JWT signing secret | **Yes** | — |
| `POSTGRES_PASSWORD` | Database password | **Yes** | `vulnflow_secret` |
| `MINIO_ACCESS_KEY` | MinIO access key | No | `minioadmin` |
| `MINIO_SECRET_KEY` | MinIO secret key | No | `minioadmin` |
| `OPENAI_API_KEY` | OpenAI API key | No* | — |
| `ANTHROPIC_API_KEY` | Anthropic API key | No* | — |
| `OLLAMA_BASE_URL` | Local LLM endpoint | No | `http://localhost:11434` |

*\* At least one LLM provider key is required.*

---

## 🔒 Security & Disclaimer

VulnFlow is designed for **authorized security testing and academic research only**. Users must:

- Obtain explicit written authorization before testing any system
- Comply with all applicable laws and regulations
- Use the platform responsibly and ethically

> **The authors assume no liability for any unauthorized or illegal use of this platform.**

---

## 🤝 Contributing

Contributions are welcome! Please read our [contributing guidelines](CONTRIBUTING.md) before submitting pull requests.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

<p align="center">
  Built with ❤️ for the security research community<br>
  <b>VulnFlow</b> — <i>Making penetration testing smarter, faster, and more collaborative</i>
</p>

<p align="center">
  <a href="https://github.com/gutddts/vulnflow">
    <img src="https://img.shields.io/github/stars/gutddts/vulnflow?style=social" alt="GitHub stars">
  </a>
  <a href="https://github.com/gutddts/vulnflow/issues">
    <img src="https://img.shields.io/github/issues/gutddts/vulnflow?style=social" alt="GitHub issues">
  </a>
</p>
