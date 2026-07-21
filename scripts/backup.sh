#!/usr/bin/env bash
# ============================================================
# VulnFlow - 备份脚本
# 备份 PostgreSQL、数据卷和配置文件
# ============================================================
set -euo pipefail

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# 配置
BACKUP_DIR="${BACKUP_PATH:-${PROJECT_ROOT}/backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_NAME="vulnflow_backup_${TIMESTAMP}"
BACKUP_PATH_FULL="${BACKUP_DIR}/${BACKUP_NAME}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

# ============================================================
# 初始化
# ============================================================
init_backup() {
    echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║              VulnFlow - 数据备份                            ║${NC}"
    echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""

    # 创建备份目录
    mkdir -p "${BACKUP_PATH_FULL}"
    echo -e "${GREEN}备份目录: ${BACKUP_PATH_FULL}${NC}"
    echo ""
}

# ============================================================
# 备份 PostgreSQL
# ============================================================
backup_postgres() {
    echo -e "${CYAN}[1/4] 备份 PostgreSQL 数据库...${NC}"

    if docker compose ps postgres 2>/dev/null | grep -q "Up"; then
        # 加载环境变量
        set -a
        source .env 2>/dev/null || true
        set +a

        local PG_USER="${POSTGRES_USER:-vulnflow}"
        local PG_DB="${POSTGRES_DB:-vulnflow}"

        docker compose exec -T postgres pg_dump \
            -U "${PG_USER}" \
            -d "${PG_DB}" \
            --no-owner \
            --no-acl \
            --format=custom \
            --compress=9 \
            > "${BACKUP_PATH_FULL}/database.dump"

        # 同时导出一个 SQL 文本备份用于可读性
        docker compose exec -T postgres pg_dump \
            -U "${PG_USER}" \
            -d "${PG_DB}" \
            --no-owner \
            --no-acl \
            --format=plain \
            > "${BACKUP_PATH_FULL}/database.sql"

        echo -e "  ${GREEN}✓${NC} 数据库备份完成"
        echo -e "    二进制备份: ${BACKUP_PATH_FULL}/database.dump ($(du -h "${BACKUP_PATH_FULL}/database.dump" | cut -f1))"
        echo -e "    SQL 备份:   ${BACKUP_PATH_FULL}/database.sql ($(du -h "${BACKUP_PATH_FULL}/database.sql" | cut -f1))"
    else
        echo -e "  ${YELLOW}⚠${NC} PostgreSQL 未运行，跳过数据库备份"
    fi
    echo ""
}

# ============================================================
# 备份数据卷
# ============================================================
backup_volumes() {
    echo -e "${CYAN}[2/4] 备份数据卷...${NC}"

    local volumes=(
        "minio_data"
        "qdrant_data"
        "elasticsearch_data"
        "redis_data"
    )

    for volume in "${volumes[@]}"; do
        local volume_name="vulnflow_${volume}"

        if docker volume ls --format '{{.Name}}' | grep -q "^${volume_name}$"; then
            docker run --rm \
                -v "${volume_name}:/source:ro" \
                -v "${BACKUP_PATH_FULL}:/backup" \
                alpine tar czf "/backup/${volume}.tar.gz" -C /source . 2>/dev/null

            echo -e "  ${GREEN}✓${NC} ${volume} -> ${volume}.tar.gz ($(du -h "${BACKUP_PATH_FULL}/${volume}.tar.gz" | cut -f1))"
        else
            echo -e "  ${YELLOW}⚠${NC} 数据卷 ${volume_name} 不存在，跳过"
        fi
    done

    echo ""
}

# ============================================================
# 备份配置文件
# ============================================================
backup_configs() {
    echo -e "${CYAN}[3/4] 备份配置文件...${NC}"

    local config_dir="${BACKUP_PATH_FULL}/configs"
    mkdir -p "${config_dir}"

    # 备份 docker-compose 和 Docker 配置
    if [ -f docker-compose.yml ]; then
        cp docker-compose.yml "${config_dir}/"
    fi

    if [ -f .env ]; then
        cp .env "${config_dir}/.env.backup"
        # 移除敏感信息
        sed 's/\(SECRET_KEY=\).*/\1[已移除]/' .env > "${config_dir}/.env.safe"
    fi

    if [ -d docker ]; then
        cp -r docker "${config_dir}/"
    fi

    if [ -d scripts ]; then
        cp -r scripts "${config_dir}/"
    fi

    echo -e "  ${GREEN}✓${NC} 配置文件备份完成"
    echo ""
}

# ============================================================
# 创建备份清单
# ============================================================
create_manifest() {
    echo -e "${CYAN}[4/4] 创建备份清单...${NC}"

    cat > "${BACKUP_PATH_FULL}/MANIFEST.txt" << EOF
============================================================
VulnFlow 备份清单
============================================================
备份时间: $(date +"%Y-%m-%d %H:%M:%S")
备份名称: ${BACKUP_NAME}
项目版本: $(git describe --tags --always 2>/dev/null || echo "未知")
Git 提交: $(git rev-parse HEAD 2>/dev/null || echo "未知")

包含内容:
  - database.dump (PostgreSQL 自定义格式备份)
  - database.sql (PostgreSQL 纯文本备份)
  - minio_data.tar.gz (对象存储数据)
  - qdrant_data.tar.gz (向量数据库数据)
  - elasticsearch_data.tar.gz (搜索引擎数据)
  - redis_data.tar.gz (缓存数据)
  - configs/ (Docker 配置、脚本)
  - MANIFEST.txt (本文件)

恢复方法:
  1. 解压备份包
  2. 将配置文件复制到项目目录
  3. 使用 docker compose 启动服务
  4. 执行: docker compose exec -T postgres pg_restore -U vulnflow -d vulnflow database.dump
  5. 恢复各数据卷到对应的 Docker volume
============================================================
EOF

    echo -e "  ${GREEN}✓${NC} 备份清单已创建"
    echo ""
}

# ============================================================
# 打包备份
# ============================================================
package_backup() {
    echo -e "${CYAN}打包备份文件...${NC}"

    local archive_name="${BACKUP_NAME}.tar.gz"

    cd "${BACKUP_DIR}"
    tar czf "${archive_name}" "${BACKUP_NAME}"
    cd "${PROJECT_ROOT}"

    # 删除临时目录
    rm -rf "${BACKUP_PATH_FULL}"

    echo -e "  ${GREEN}✓${NC} 备份包: ${BACKUP_DIR}/${archive_name}"
    echo -e "    大小: $(du -h "${BACKUP_DIR}/${archive_name}" | cut -f1)"
    echo ""
}

# ============================================================
# 清理旧备份
# ============================================================
cleanup_old_backups() {
    echo -e "${CYAN}清理旧备份 (保留 ${RETENTION_DAYS} 天)...${NC}"

    local deleted=0
    while IFS= read -r -d '' file; do
        rm -f "$file"
        deleted=$((deleted + 1))
    done < <(find "${BACKUP_DIR}" -name "vulnflow_backup_*.tar.gz" -mtime "+${RETENTION_DAYS}" -print0 2>/dev/null || true)

    if [ $deleted -gt 0 ]; then
        echo -e "  ${GREEN}✓${NC} 已清理 ${deleted} 个旧备份"
    else
        echo -e "  ${CYAN}→${NC} 没有需要清理的旧备份"
    fi
    echo ""
}

# ============================================================
# 主流程
# ============================================================
main() {
    init_backup
    backup_postgres
    backup_volumes
    backup_configs
    create_manifest
    package_backup
    cleanup_old_backups

    echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                    备份完成！                               ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "备份文件: ${BACKUP_DIR}/${BACKUP_NAME}.tar.gz"
    echo -e "备份时间: $(date +"%Y-%m-%d %H:%M:%S")"
    echo ""
}

main "$@"
