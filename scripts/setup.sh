#!/usr/bin/env bash
# ============================================================
# VulnFlow - 一键部署脚本
# ============================================================
set -euo pipefail

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# ============================================================
# 打印横幅
# ============================================================
print_banner() {
    echo ""
    echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║                                                              ║${NC}"
    echo -e "${CYAN}║${BOLD}   VulnFlow - AI 驱动的渗透测试智能体平台  ${NC}${CYAN}            ║${NC}"
    echo -e "${CYAN}║${NC}                                                              ${CYAN}║${NC}"
    echo -e "${CYAN}║${NC}   一键部署脚本                                               ${CYAN}║${NC}"
    echo -e "${CYAN}║                                                              ║${NC}"
    echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

# ============================================================
# 打印步骤
# ============================================================
print_step() {
    echo -e "${BLUE}[步骤 $1/$TOTAL_STEPS]${NC} ${BOLD}$2${NC}"
}

print_success() {
    echo -e "  ${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "  ${RED}✗${NC} $1"
}

print_warning() {
    echo -e "  ${YELLOW}⚠${NC} $1"
}

print_info() {
    echo -e "  ${CYAN}→${NC} $1"
}

# ============================================================
# 检查系统要求
# ============================================================
check_requirements() {
    print_step "1" "检查系统要求"

    # 检查 Docker
    if command -v docker &> /dev/null; then
        DOCKER_VERSION=$(docker --version 2>/dev/null | grep -oP '\d+\.\d+\.\d+' | head -1)
        print_success "Docker 版本: ${DOCKER_VERSION}"
    else
        print_error "Docker 未安装。请先安装 Docker: https://docs.docker.com/engine/install/"
        exit 1
    fi

    # 检查 Docker Compose
    if docker compose version &> /dev/null; then
        COMPOSE_VERSION=$(docker compose version --short 2>/dev/null)
        print_success "Docker Compose 版本: ${COMPOSE_VERSION}"
    elif docker-compose --version &> /dev/null; then
        COMPOSE_VERSION=$(docker-compose --version 2>/dev/null | grep -oP '\d+\.\d+\.\d+' | head -1)
        print_success "Docker Compose (legacy) 版本: ${COMPOSE_VERSION}"
        print_warning "建议升级到 Docker Compose V2"
    else
        print_error "Docker Compose 未安装。请先安装 Docker Compose"
        exit 1
    fi

    # 检查 Docker 是否运行
    if ! docker info &> /dev/null; then
        print_error "Docker 守护进程未运行。请启动 Docker 服务"
        exit 1
    fi
    print_success "Docker 守护进程运行正常"

    # 检查可用磁盘空间（至少 10GB）
    AVAILABLE_SPACE=$(df -BG . | tail -1 | awk '{print $4}' | sed 's/G//')
    if [ "${AVAILABLE_SPACE}" -lt 10 ]; then
        print_warning "可用磁盘空间不足 10GB (当前: ${AVAILABLE_SPACE}GB)，可能影响运行"
    else
        print_success "可用磁盘空间: ${AVAILABLE_SPACE}GB"
    fi

    # 检查内存（至少 4GB）
    TOTAL_MEM=$(free -g | awk '/^Mem:/{print $2}')
    if [ "${TOTAL_MEM}" -lt 4 ]; then
        print_warning "系统内存不足 4GB (当前: ${TOTAL_MEM}GB)，可能影响性能"
    else
        print_success "系统内存: ${TOTAL_MEM}GB"
    fi

    echo ""
}

# ============================================================
# 配置环境变量
# ============================================================
setup_env() {
    print_step "2" "配置环境变量"

    if [ -f .env ]; then
        print_info ".env 文件已存在，跳过创建"
    else
        if [ -f .env.example ]; then
            cp .env.example .env
            print_success "已从 .env.example 创建 .env 文件"
            print_warning "请编辑 .env 文件，修改默认密钥和密码"
        else
            print_error ".env.example 文件不存在"
            exit 1
        fi
    fi

    # 源环境变量
    set -a
    source .env 2>/dev/null || true
    set +a

    echo ""
}

# ============================================================
# 创建必要目录
# ============================================================
create_directories() {
    print_step "3" "创建必要目录"

    DIRS=(
        "backups"
        "data"
        "logs"
        "data/nuclei-templates"
        "data/reports"
        "data/screenshots"
        "data/wordlists"
    )

    for dir in "${DIRS[@]}"; do
        if [ ! -d "$dir" ]; then
            mkdir -p "$dir"
            print_success "创建目录: $dir"
        else
            print_info "目录已存在: $dir"
        fi
    done

    echo ""
}

# ============================================================
# 构建并启动服务
# ============================================================
start_services() {
    print_step "4" "构建并启动服务"

    print_info "拉取基础镜像..."
    docker compose pull postgres redis elasticsearch minio qdrant 2>/dev/null || true

    print_info "构建应用镜像..."
    docker compose build --parallel 2>&1 | while IFS= read -r line; do
        echo -e "  ${CYAN}│${NC} $line"
    done

    print_info "启动所有服务..."
    docker compose up -d 2>&1 | while IFS= read -r line; do
        echo -e "  ${CYAN}│${NC} $line"
    done

    print_success "所有服务已启动"
    echo ""
}

# ============================================================
# 等待健康检查
# ============================================================
wait_for_healthy() {
    print_step "5" "等待服务健康检查"

    SERVICES=("postgres" "redis" "elasticsearch" "minio" "qdrant" "backend" "frontend")
    MAX_WAIT=180
    INTERVAL=5
    ELAPSED=0

    for service in "${SERVICES[@]}"; do
        print_info "等待 ${service} 就绪..."
        local service_elapsed=0

        while [ $service_elapsed -lt 120 ]; do
            if docker compose ps "$service" 2>/dev/null | grep -q "healthy"; then
                print_success "${service} 已就绪 (${service_elapsed}s)"
                break
            elif docker compose ps "$service" 2>/dev/null | grep -q "Up"; then
                sleep "$INTERVAL"
                service_elapsed=$((service_elapsed + INTERVAL))
            elif docker compose ps "$service" 2>/dev/null | grep -q "unhealthy"; then
                print_warning "${service} 健康检查失败，继续等待..."
                sleep "$INTERVAL"
                service_elapsed=$((service_elapsed + INTERVAL))
            else
                print_warning "${service} 未运行，查看日志..."
                docker compose logs --tail=20 "$service" 2>/dev/null || true
                sleep "$INTERVAL"
                service_elapsed=$((service_elapsed + INTERVAL))
            fi
        done

        if [ $service_elapsed -ge 120 ]; then
            print_warning "${service} 可能尚未完全就绪，将继续后续步骤"
        fi

        ELAPSED=$((ELAPSED + service_elapsed))
    done

    # 额外等待确保服务稳定
    print_info "等待服务稳定 (10s)..."
    sleep 10

    echo ""
}

# ============================================================
# 运行数据库迁移
# ============================================================
run_migrations() {
    print_step "6" "运行数据库迁移"

    if docker compose ps backend 2>/dev/null | grep -q "Up"; then
        print_info "执行数据库迁移..."
        if docker compose exec -T backend alembic upgrade head 2>&1; then
            print_success "数据库迁移完成"
        else
            print_warning "数据库迁移可能失败，请稍后手动执行: make migrate"
        fi
    else
        print_warning "后端服务未运行，跳过数据库迁移"
    fi

    echo ""
}

# ============================================================
# 创建默认管理员
# ============================================================
create_admin_user() {
    print_step "7" "创建默认管理员用户"

    if docker compose ps backend 2>/dev/null | grep -q "Up"; then
        print_info "检查管理员用户..."
        if docker compose exec -T backend python -m app.cli create-admin --email admin@vulnflow.local --password admin@123 --name "管理员" 2>/dev/null; then
            print_success "管理员用户已创建"
            print_info "  邮箱: admin@vulnflow.local"
            print_info "  密码: admin@123"
            print_warning "请立即修改默认密码！"
        else
            print_info "管理员用户可能已存在，跳过创建"
        fi
    else
        print_warning "后端服务未运行，跳过管理员创建"
    fi

    echo ""
}

# ============================================================
# 初始化 MinIO 存储桶
# ============================================================
init_minio() {
    print_step "8" "初始化 MinIO 存储桶"

    if docker compose ps minio 2>/dev/null | grep -q "Up"; then
        BUCKET_NAME="${MINIO_BUCKET:-vulnflow}"
        print_info "创建存储桶: ${BUCKET_NAME}"

        docker compose exec -T minio mc alias set local http://localhost:9000 "${MINIO_ACCESS_KEY:-minioadmin}" "${MINIO_SECRET_KEY:-minioadmin}" 2>/dev/null || true

        if docker compose exec -T minio mc mb "local/${BUCKET_NAME}" --ignore-existing 2>/dev/null; then
            print_success "存储桶 ${BUCKET_NAME} 已就绪"
        else
            print_warning "MinIO 客户端不可用，请手动创建存储桶"
        fi
    else
        print_warning "MinIO 服务未运行，跳过存储桶初始化"
    fi

    echo ""
}

# ============================================================
# 打印完成信息
# ============================================================
print_completion() {
    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                                                              ║${NC}"
    echo -e "${GREEN}║  ${BOLD}部署完成！${NC}                                                ${GREEN}║${NC}"
    echo -e "${GREEN}║                                                              ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${BOLD}访问地址:${NC}"
    echo -e "  ${CYAN}前端界面:${NC}     http://localhost:3000"
    echo -e "  ${CYAN}后端 API 文档:${NC} http://localhost:8000/api/v1/docs"
    echo -e "  ${CYAN}健康检查:${NC}     http://localhost:8000/api/v1/health"
    echo -e "  ${CYAN}MinIO 控制台:${NC}  http://localhost:9001"
    echo -e "  ${CYAN}Qdrant 面板:${NC}   http://localhost:6333/dashboard"
    echo ""
    echo -e "${BOLD}管理账号:${NC}"
    echo -e "  ${CYAN}邮箱:${NC} admin@vulnflow.local"
    echo -e "  ${CYAN}密码:${NC} admin@123"
    echo ""
    echo -e "${BOLD}常用命令:${NC}"
    echo -e "  make help        - 查看所有可用命令"
    echo -e "  make logs        - 查看服务日志"
    echo -e "  make status      - 查看服务状态"
    echo -e "  make test        - 运行测试"
    echo -e "  make backup      - 备份数据"
    echo ""
    echo -e "${YELLOW}⚠ 请立即修改 .env 文件中的默认密钥和密码！${NC}"
    echo -e "${YELLOW}⚠ 请立即修改管理员默认密码！${NC}"
    echo ""
}

# ============================================================
# 主流程
# ============================================================
TOTAL_STEPS=8

main() {
    print_banner

    # 记录开始时间
    START_TIME=$(date +%s)

    check_requirements
    setup_env
    create_directories
    start_services
    wait_for_healthy
    run_migrations
    create_admin_user
    init_minio
    print_completion

    # 记录结束时间
    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))
    MINUTES=$((DURATION / 60))
    SECONDS=$((DURATION % 60))

    echo -e "${GREEN}总耗时: ${MINUTES}分${SECONDS}秒${NC}"
    echo ""
}

# 运行主函数
main "$@"
