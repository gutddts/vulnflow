#!/usr/bin/env bash
# ============================================================
# VulnFlow - 健康检查脚本
# ============================================================
set -euo pipefail

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# 统计
TOTAL=0
PASSED=0
FAILED=0
WARNING=0

# ============================================================
# 打印标题
# ============================================================
print_header() {
    echo ""
    echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║              VulnFlow - 健康检查报告                        ║${NC}"
    echo -e "${CYAN}║              $(date "+%Y-%m-%d %H:%M:%S")                         ║${NC}"
    echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

# ============================================================
# 检查函数
# ============================================================
check_service() {
    local name="$1"
    local url="$2"
    local description="$3"

    TOTAL=$((TOTAL + 1))
    printf "  %-25s" "${name}"

    if curl -sf --max-time 5 "$url" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ 正常${NC}"
        PASSED=$((PASSED + 1))
        return 0
    else
        echo -e "${RED}✗ 异常${NC}  ${description}"
        FAILED=$((FAILED + 1))
        return 1
    fi
}

check_docker_service() {
    local service="$1"
    local description="$2"

    TOTAL=$((TOTAL + 1))
    printf "  %-25s" "${service}"

    local status
    status=$(docker compose ps "$service" 2>/dev/null | tail -1 | awk '{print $4}' || echo "not_found")

    case "$status" in
        "Up"|"running")
            # 检查健康状态
            if docker compose ps "$service" 2>/dev/null | grep -q "healthy"; then
                echo -e "${GREEN}✓ 健康${NC}"
                PASSED=$((PASSED + 1))
            elif docker compose ps "$service" 2>/dev/null | grep -q "unhealthy"; then
                echo -e "${RED}✗ 不健康${NC}  ${description}"
                FAILED=$((FAILED + 1))
            else
                echo -e "${YELLOW}⚠ 运行中(无健康检查)${NC}"
                WARNING=$((WARNING + 1))
            fi
            ;;
        "exited"|"stopped")
            echo -e "${RED}✗ 已停止${NC}  ${description}"
            FAILED=$((FAILED + 1))
            ;;
        *)
            echo -e "${RED}✗ 未运行${NC}  ${description}"
            FAILED=$((FAILED + 1))
            ;;
    esac
}

# ============================================================
# 检查 Docker 环境
# ============================================================
check_docker() {
    echo -e "${BOLD}Docker 环境检查${NC}"
    echo "────────────────────────────────────────────"

    TOTAL=$((TOTAL + 1))
    printf "  %-25s" "Docker 守护进程"
    if docker info > /dev/null 2>&1; then
        local version
        version=$(docker --version 2>/dev/null | head -1)
        echo -e "${GREEN}✓${NC} ${version}"
        PASSED=$((PASSED + 1))
    else
        echo -e "${RED}✗ Docker 未运行${NC}"
        FAILED=$((FAILED + 1))
    fi

    TOTAL=$((TOTAL + 1))
    printf "  %-25s" "Docker Compose"
    if docker compose version > /dev/null 2>&1; then
        local version
        version=$(docker compose version --short 2>/dev/null)
        echo -e "${GREEN}✓${NC} v${version}"
        PASSED=$((PASSED + 1))
    else
        echo -e "${RED}✗ Docker Compose 不可用${NC}"
        FAILED=$((FAILED + 1))
    fi

    echo ""
}

# ============================================================
# 检查服务容器
# ============================================================
check_containers() {
    echo -e "${BOLD}容器状态检查${NC}"
    echo "────────────────────────────────────────────"

    check_docker_service "postgres" "数据库服务异常"
    check_docker_service "redis" "缓存服务异常"
    check_docker_service "elasticsearch" "搜索引擎异常"
    check_docker_service "minio" "对象存储异常"
    check_docker_service "qdrant" "向量数据库异常"
    check_docker_service "backend" "后端 API 异常"
    check_docker_service "celery_worker" "任务队列异常"
    check_docker_service "celery_beat" "定时调度异常"
    check_docker_service "frontend" "前端服务异常"
    check_docker_service "nginx" "反向代理异常"

    echo ""
}

# ============================================================
# 检查端点
# ============================================================
check_endpoints() {
    echo -e "${BOLD}API 端点检查${NC}"
    echo "────────────────────────────────────────────"

    check_service "后端健康检查" \
        "http://localhost:8000/api/v1/health" \
        "后端 API 不可达"

    check_service "后端 API 文档" \
        "http://localhost:8000/api/v1/docs" \
        "API 文档不可达"

    check_service "Nginx 代理" \
        "http://localhost/health" \
        "Nginx 反向代理不可达"

    check_service "前端服务" \
        "http://localhost:3000" \
        "前端开发服务器不可达"

    check_service "Elasticsearch" \
        "http://localhost:9200/_cluster/health" \
        "Elasticsearch 不可达"

    check_service "MinIO 健康" \
        "http://localhost:9000/minio/health/live" \
        "MinIO 不可达"

    check_service "Qdrant 健康" \
        "http://localhost:6333/health" \
        "Qdrant 不可达"

    echo ""
}

# ============================================================
# 检查资源使用
# ============================================================
check_resources() {
    echo -e "${BOLD}资源使用情况${NC}"
    echo "────────────────────────────────────────────"

    # 磁盘使用
    TOTAL=$((TOTAL + 1))
    printf "  %-25s" "磁盘使用"
    local disk_usage
    disk_usage=$(df -h . | tail -1 | awk '{print $5 " (" $3 "/" $2 ")"}')
    local disk_pct
    disk_pct=$(df -h . | tail -1 | awk '{print $5}' | sed 's/%//')
    if [ "$disk_pct" -gt 90 ]; then
        echo -e "${RED}⚠${NC} ${disk_usage} - 磁盘空间不足"
        FAILED=$((FAILED + 1))
    elif [ "$disk_pct" -gt 75 ]; then
        echo -e "${YELLOW}⚠${NC} ${disk_usage} - 磁盘使用率较高"
        WARNING=$((WARNING + 1))
    else
        echo -e "${GREEN}✓${NC} ${disk_usage}"
        PASSED=$((PASSED + 1))
    fi

    # 内存使用
    TOTAL=$((TOTAL + 1))
    printf "  %-25s" "内存使用"
    local mem_usage
    mem_usage=$(free -h | awk '/^Mem:/ {print $3 "/" $2 " (" int($3/$2*100) "%)"}')
    local mem_pct
    mem_pct=$(free | awk '/^Mem:/ {print int($3/$2*100)}')
    if [ "$mem_pct" -gt 90 ]; then
        echo -e "${RED}⚠${NC} ${mem_usage} - 内存不足"
        FAILED=$((FAILED + 1))
    elif [ "$mem_pct" -gt 75 ]; then
        echo -e "${YELLOW}⚠${NC} ${mem_usage} - 内存使用率较高"
        WARNING=$((WARNING + 1))
    else
        echo -e "${GREEN}✓${NC} ${mem_usage}"
        PASSED=$((PASSED + 1))
    fi

    # Docker 数据卷
    TOTAL=$((TOTAL + 1))
    printf "  %-25s" "Docker 数据卷"
    local volume_count
    volume_count=$(docker volume ls -q --filter "name=vulnflow" | wc -l)
    echo -e "${CYAN}→${NC} ${volume_count} 个数据卷"

    echo ""
}

# ============================================================
# 检查数据库连接
# ============================================================
check_database() {
    echo -e "${BOLD}数据库检查${NC}"
    echo "────────────────────────────────────────────"

    # PostgreSQL 连接数
    TOTAL=$((TOTAL + 1))
    printf "  %-25s" "PostgreSQL 连接"
    if docker compose ps postgres 2>/dev/null | grep -q "Up"; then
        local conn_count
        conn_count=$(docker compose exec -T postgres psql -U vulnflow -d vulnflow -t -c "SELECT count(*) FROM pg_stat_activity;" 2>/dev/null | tr -d ' ' || echo "N/A")
        echo -e "${GREEN}✓${NC} 活动连接: ${conn_count}"
        PASSED=$((PASSED + 1))
    else
        echo -e "${RED}✗ PostgreSQL 未运行${NC}"
        FAILED=$((FAILED + 1))
    fi

    # Redis 连接
    TOTAL=$((TOTAL + 1))
    printf "  %-25s" "Redis 连接"
    if docker compose ps redis 2>/dev/null | grep -q "Up"; then
        if docker compose exec -T redis redis-cli ping 2>/dev/null | grep -q "PONG"; then
            echo -e "${GREEN}✓${NC} 连接正常"
            PASSED=$((PASSED + 1))
        else
            echo -e "${RED}✗ 连接失败${NC}"
            FAILED=$((FAILED + 1))
        fi
    else
        echo -e "${RED}✗ Redis 未运行${NC}"
        FAILED=$((FAILED + 1))
    fi

    echo ""
}

# ============================================================
# 打印报告
# ============================================================
print_report() {
    echo ""
    echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║                    健康检查报告                             ║${NC}"
    echo -e "${CYAN}╠══════════════════════════════════════════════════════════════╣${NC}"

    printf "${CYAN}║${NC}  总计: %-3d  ${GREEN}正常: %-3d${NC}  ${RED}异常: %-3d${NC}  ${YELLOW}警告: %-3d${NC}  ${CYAN}║${NC}\n" "$TOTAL" "$PASSED" "$FAILED" "$WARNING"

    echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""

    if [ "$FAILED" -eq 0 ] && [ "$WARNING" -eq 0 ]; then
        echo -e "${GREEN}✓ 所有服务运行正常！${NC}"
        return 0
    elif [ "$FAILED" -eq 0 ]; then
        echo -e "${YELLOW}⚠ 所有关键服务正常，但存在一些警告${NC}"
        return 0
    else
        echo -e "${RED}✗ 存在 ${FAILED} 个异常服务，请检查日志${NC}"
        echo -e "  运行 'make logs' 查看详细日志"
        return 1
    fi
}

# ============================================================
# 主流程
# ============================================================
main() {
    print_header
    check_docker
    check_containers
    check_endpoints
    check_resources
    check_database
    print_report
}

main "$@"
