# ============================================================
# VulnFlow - Makefile
# ============================================================

.PHONY: help up down build logs migrate seed test clean shell-backend shell-frontend restart status ps backup restore lint format init

# 默认目标
.DEFAULT_GOAL := help

# 颜色定义
GREEN  := \033[0;32m
YELLOW := \033[0;33m
RED    := \033[0;31m
CYAN   := \033[0;36m
NC     := \033[0m

# Docker Compose 命令
COMPOSE := docker compose
ifeq ($(ENV),prod)
	COMPOSE := docker compose -f docker-compose.yml -f docker-compose.prod.yml
endif

# ============================================================
# 帮助
# ============================================================
help: ## 显示此帮助信息
	@echo "$(CYAN)VulnFlow - AI 驱动的渗透测试智能体平台$(NC)"
	@echo ""
	@echo "$(GREEN)可用命令:$(NC)"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  $(YELLOW)%-20s$(NC) %s\n", $$1, $$2}'

# ============================================================
# 环境初始化
# ============================================================
init: ## 初始化项目（首次运行）
	@echo "$(CYAN)初始化 VulnFlow 项目...$(NC)"
	@if [ ! -f .env ]; then \
		echo "$(YELLOW)创建 .env 文件...$(NC)"; \
		cp .env.example .env; \
	fi
	@mkdir -p backups data logs
	@$(COMPOSE) up -d --build
	@echo "$(GREEN)项目初始化完成！$(NC)"
	@$(MAKE) status

# ============================================================
# 服务管理
# ============================================================
up: ## 启动所有服务
	@echo "$(CYAN)启动所有服务...$(NC)"
	@$(COMPOSE) up -d
	@$(MAKE) status

down: ## 停止所有服务
	@echo "$(YELLOW)停止所有服务...$(NC)"
	@$(COMPOSE) down

build: ## 构建所有镜像
	@echo "$(CYAN)构建所有镜像...$(NC)"
	@$(COMPOSE) build --no-cache

restart: ## 重启所有服务
	@echo "$(YELLOW)重启所有服务...$(NC)"
	@$(COMPOSE) restart

ps: ## 查看服务状态（简要）
	@$(COMPOSE) ps

status: ## 查看所有服务状态（详细）
	@echo "$(CYAN)============================================================$(NC)"
	@echo "$(CYAN)  VulnFlow 服务状态$(NC)"
	@echo "$(CYAN)============================================================$(NC)"
	@$(COMPOSE) ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
	@echo ""
	@echo "$(GREEN)访问地址:$(NC)"
	@echo "  前端:     http://localhost:3000"
	@echo "  后端 API: http://localhost:8000/api/v1/docs"
	@echo "  MinIO:    http://localhost:9001"
	@echo "  Qdrant:   http://localhost:6333/dashboard"
	@echo ""

logs: ## 查看所有服务日志
	@$(COMPOSE) logs -f

logs-backend: ## 查看后端日志
	@$(COMPOSE) logs -f backend

logs-worker: ## 查看 Celery Worker 日志
	@$(COMPOSE) logs -f celery_worker

logs-frontend: ## 查看前端日志
	@$(COMPOSE) logs -f frontend

logs-nginx: ## 查看 Nginx 日志
	@$(COMPOSE) logs -f nginx

# ============================================================
# 数据库
# ============================================================
migrate: ## 运行数据库迁移
	@echo "$(CYAN)运行数据库迁移...$(NC)"
	@$(COMPOSE) exec backend alembic upgrade head
	@echo "$(GREEN)数据库迁移完成！$(NC)"

migrate-create: ## 创建新的迁移文件 (usage: make migrate-create MSG="描述")
	@$(COMPOSE) exec backend alembic revision --autogenerate -m "$(MSG)"

migrate-rollback: ## 回滚上一次迁移
	@$(COMPOSE) exec backend alembic downgrade -1

seed: ## 填充种子数据
	@echo "$(CYAN)填充种子数据...$(NC)"
	@$(COMPOSE) exec backend python -m app.seed
	@echo "$(GREEN)种子数据填充完成！$(NC)"

reset-db: ## 重置数据库（危险操作）
	@echo "$(RED)警告：此操作将删除所有数据库数据！$(NC)"
	@read -p "确认重置数据库？[y/N] " confirm; \
	if [ "$$confirm" = "y" ] || [ "$$confirm" = "Y" ]; then \
		$(COMPOSE) down -v postgres_data; \
		$(COMPOSE) up -d postgres; \
		echo "$(YELLOW)等待 PostgreSQL 启动...$(NC)"; \
		sleep 5; \
		$(MAKE) migrate; \
		$(MAKE) seed; \
		echo "$(GREEN)数据库已重置！$(NC)"; \
	else \
		echo "$(YELLOW)操作已取消。$(NC)"; \
	fi

# ============================================================
# 开发工具
# ============================================================
shell-backend: ## 进入后端容器 Shell
	@$(COMPOSE) exec backend /bin/bash

shell-frontend: ## 进入前端容器 Shell
	@$(COMPOSE) exec frontend /bin/sh

shell-postgres: ## 进入 PostgreSQL 容器
	@$(COMPOSE) exec postgres psql -U $(POSTGRES_USER) -d $(POSTGRES_DB)

shell-redis: ## 进入 Redis CLI
	@$(COMPOSE) exec redis redis-cli

# ============================================================
# 测试
# ============================================================
test: ## 运行后端测试
	@echo "$(CYAN)运行测试...$(NC)"
	@$(COMPOSE) exec backend pytest -v --cov=app --cov-report=term-missing
	@echo "$(GREEN)测试完成！$(NC)"

test-coverage: ## 运行测试并生成覆盖率报告
	@echo "$(CYAN)运行测试并生成覆盖率报告...$(NC)"
	@$(COMPOSE) exec backend pytest -v --cov=app --cov-report=html
	@echo "$(GREEN)覆盖率报告已生成: backend/htmlcov/index.html$(NC)"

test-frontend: ## 运行前端测试
	@$(COMPOSE) exec frontend npm test

# ============================================================
# 代码质量
# ============================================================
lint: ## 运行代码检查
	@echo "$(CYAN)运行代码检查...$(NC)"
	@$(COMPOSE) exec backend ruff check .
	@$(COMPOSE) exec backend mypy app/
	@echo "$(GREEN)代码检查完成！$(NC)"

format: ## 格式化代码
	@echo "$(CYAN)格式化代码...$(NC)"
	@$(COMPOSE) exec backend ruff format .
	@echo "$(GREEN)代码格式化完成！$(NC)"

# ============================================================
# 备份与恢复
# ============================================================
backup: ## 备份数据库和数据卷
	@echo "$(CYAN)开始备份...$(NC)"
	@bash scripts/backup.sh
	@echo "$(GREEN)备份完成！$(NC)"

restore: ## 从备份恢复 (usage: make restore BACKUP_FILE=backups/backup_20240101.tar.gz)
	@if [ -z "$(BACKUP_FILE)" ]; then \
		echo "$(RED)请指定备份文件: make restore BACKUP_FILE=backups/backup_xxx.tar.gz$(NC)"; \
		exit 1; \
	fi
	@echo "$(CYAN)从 $(BACKUP_FILE) 恢复...$(NC)"
	@bash scripts/restore.sh $(BACKUP_FILE)
	@echo "$(GREEN)恢复完成！$(NC)"

# ============================================================
# 健康检查
# ============================================================
healthcheck: ## 检查所有服务健康状态
	@bash scripts/healthcheck.sh

# ============================================================
# 清理
# ============================================================
clean: ## 清理临时文件
	@echo "$(YELLOW)清理临时文件...$(NC)"
	@find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	@find . -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true
	@find . -type d -name ".mypy_cache" -exec rm -rf {} + 2>/dev/null || true
	@find . -type d -name ".ruff_cache" -exec rm -rf {} + 2>/dev/null || true
	@find . -type f -name "*.pyc" -delete 2>/dev/null || true
	@find . -type f -name ".DS_Store" -delete 2>/dev/null || true
	@echo "$(GREEN)清理完成！$(NC)"

clean-all: down ## 停止服务并删除所有数据（危险操作）
	@echo "$(RED)警告：此操作将删除所有容器、镜像和数据卷！$(NC)"
	@read -p "确认清理所有数据？[y/N] " confirm; \
	if [ "$$confirm" = "y" ] || [ "$$confirm" = "Y" ]; then \
		$(COMPOSE) down -v --rmi all --remove-orphans; \
		rm -rf backups/* logs/* data/*; \
		echo "$(GREEN)所有数据已清理！$(NC)"; \
	else \
		echo "$(YELLOW)操作已取消。$(NC)"; \
	fi

# ============================================================
# 离线部署
# ============================================================
offline-export: ## 导出离线部署包
	@echo "$(CYAN)导出离线部署包...$(NC)"
	@bash scripts/offline-export.sh
	@echo "$(GREEN)离线部署包导出完成！$(NC)"

# ============================================================
# 一键设置
# ============================================================
setup: ## 一键设置（首次部署）
	@echo "$(CYAN)一键设置 VulnFlow...$(NC)"
	@bash scripts/setup.sh
