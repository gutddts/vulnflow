#!/usr/bin/env bash
# ============================================================
# VulnFlow - 离线部署导出脚本
# 导出所有 Docker 镜像和配置文件，用于无网络环境部署
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

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
EXPORT_DIR="${PROJECT_ROOT}/offline-package/vulnflow-offline-${TIMESTAMP}"

# ============================================================
# 镜像列表
# ============================================================
IMAGES=(
    "nginx:alpine"
    "postgres:16-alpine"
    "redis:7-alpine"
    "docker.elastic.co/elasticsearch/elasticsearch:8.15.0"
    "minio/minio:latest"
    "qdrant/qdrant:latest"
    "python:3.12-slim"
    "node:20-alpine"
    "alpine:latest"
)

# ============================================================
# 初始化
# ============================================================
init_export() {
    echo ""
    echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║           VulnFlow - 离线部署包导出                         ║${NC}"
    echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""

    mkdir -p "${EXPORT_DIR}/images"
    mkdir -p "${EXPORT_DIR}/configs"
    mkdir -p "${EXPORT_DIR}/scripts"

    echo -e "${GREEN}导出目录: ${EXPORT_DIR}${NC}"
    echo ""
}

# ============================================================
# 导出 Docker 镜像
# ============================================================
export_images() {
    echo -e "${CYAN}[1/4] 导出 Docker 镜像...${NC}"

    local count=0
    local total=${#IMAGES[@]}

    for image in "${IMAGES[@]}"; do
        count=$((count + 1))
        local filename
        filename=$(echo "${image}" | tr '/:' '_')
        local output="${EXPORT_DIR}/images/${filename}.tar"

        echo -e "  [${count}/${total}] 导出 ${image}..."

        if docker image inspect "${image}" > /dev/null 2>&1; then
            docker save -o "${output}" "${image}"
            local size
            size=$(du -h "${output}" | cut -f1)
            echo -e "    ${GREEN}✓${NC} 已导出 (${size})"
        else
            echo -e "    ${YELLOW}⚠${NC} 镜像不存在，先拉取..."
            if docker pull "${image}" > /dev/null 2>&1; then
                docker save -o "${output}" "${image}"
                local size
                size=$(du -h "${output}" | cut -f1)
                echo -e "    ${GREEN}✓${NC} 已拉取并导出 (${size})"
            else
                echo -e "    ${RED}✗${NC} 拉取失败"
            fi
        fi
    done

    echo ""
}

# ============================================================
# 导出配置文件
# ============================================================
export_configs() {
    echo -e "${CYAN}[2/4] 导出配置文件...${NC}"

    # docker-compose.yml
    if [ -f docker-compose.yml ]; then
        cp docker-compose.yml "${EXPORT_DIR}/configs/"
        echo -e "  ${GREEN}✓${NC} docker-compose.yml"
    fi

    # .env.example
    if [ -f .env.example ]; then
        cp .env.example "${EXPORT_DIR}/configs/"
        echo -e "  ${GREEN}✓${NC} .env.example"
    fi

    # .env (去除敏感信息版本)
    if [ -f .env ]; then
        sed 's/\(SECRET_KEY=\).*/\1[请替换]/' .env > "${EXPORT_DIR}/configs/.env.template"
        sed -i 's/\(JWT_SECRET_KEY=\).*/\1[请替换]/' "${EXPORT_DIR}/configs/.env.template"
        sed -i 's/\(POSTGRES_PASSWORD=\).*/\1[请修改]/' "${EXPORT_DIR}/configs/.env.template"
        echo -e "  ${GREEN}✓${NC} .env.template (敏感信息已移除)"
    fi

    # Docker 配置
    if [ -d docker ]; then
        cp -r docker "${EXPORT_DIR}/configs/"
        echo -e "  ${GREEN}✓${NC} docker/ 配置目录"
    fi

    # Makefile
    if [ -f Makefile ]; then
        cp Makefile "${EXPORT_DIR}/configs/"
        echo -e "  ${GREEN}✓${NC} Makefile"
    fi

    echo ""
}

# ============================================================
# 导出部署脚本
# ============================================================
export_scripts() {
    echo -e "${CYAN}[3/4] 导出部署脚本...${NC}"

    # 复制所有脚本
    if [ -d scripts ]; then
        cp -r scripts "${EXPORT_DIR}/"
        echo -e "  ${GREEN}✓${NC} 脚本目录"
    fi

    # 创建离线安装脚本
    cat > "${EXPORT_DIR}/install-offline.sh" << 'OFFLINE_INSTALL_SCRIPT'
#!/usr/bin/env bash
# ============================================================
# VulnFlow - 离线安装脚本
# 在没有网络的环境中部署 VulnFlow
# ============================================================
set -euo pipefail

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

INSTALL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${CYAN}============================================================${NC}"
echo -e "${CYAN}  VulnFlow - 离线部署${NC}"
echo -e "${CYAN}============================================================${NC}"
echo ""

# 1. 导入 Docker 镜像
echo -e "${CYAN}[1/3] 导入 Docker 镜像...${NC}"
for image_file in "${INSTALL_DIR}/images/"*.tar; do
    if [ -f "$image_file" ]; then
        echo -e "  导入: $(basename "$image_file")"
        docker load -i "$image_file"
    fi
done
echo -e "  ${GREEN}✓${NC} 镜像导入完成"
echo ""

# 2. 复制配置文件
echo -e "${CYAN}[2/3] 配置环境...${NC}"
if [ ! -f .env ]; then
    if [ -f configs/.env.template ]; then
        cp configs/.env.template .env
        echo -e "  ${YELLOW}⚠${NC} 已创建 .env 文件，请修改密钥和密码"
    elif [ -f configs/.env.example ]; then
        cp configs/.env.example .env
        echo -e "  ${YELLOW}⚠${NC} 已从 .env.example 创建 .env，请修改配置"
    fi
fi

if [ -f configs/docker-compose.yml ]; then
    cp configs/docker-compose.yml .
fi

if [ -d configs/docker ]; then
    cp -r configs/docker .
fi

if [ -f configs/Makefile ]; then
    cp configs/Makefile .
fi

# 创建必要目录
mkdir -p backups data logs
echo -e "  ${GREEN}✓${NC} 配置完成"
echo ""

# 3. 启动服务
echo -e "${CYAN}[3/3] 启动服务...${NC}"
docker compose up -d
echo -e "  ${GREEN}✓${NC} 服务已启动"
echo ""

echo -e "${GREEN}============================================================${NC}"
echo -e "${GREEN}  VulnFlow 离线部署完成！${NC}"
echo -e "${GREEN}============================================================${NC}"
echo ""
echo -e "访问地址:"
echo -e "  前端: http://localhost:3000"
echo -e "  API:  http://localhost:8000/api/v1/docs"
echo ""
echo -e "${YELLOW}⚠ 请修改 .env 文件中的默认密钥和密码！${NC}"
echo ""
OFFLINE_INSTALL_SCRIPT

    chmod +x "${EXPORT_DIR}/install-offline.sh"
    echo -e "  ${GREEN}✓${NC} install-offline.sh"

    echo ""
}

# ============================================================
# 创建说明文件
# ============================================================
create_readme() {
    echo -e "${CYAN}[4/4] 创建说明文件...${NC}"

    cat > "${EXPORT_DIR}/README.md" << EOF
# VulnFlow 离线部署包

## 版本信息
- 导出时间: $(date +"%Y-%m-%d %H:%M:%S")
- 导出主机: $(hostname)
- Docker 版本: $(docker --version 2>/dev/null || echo "未知")

## 包含内容

\`\`\`
vulnflow-offline-${TIMESTAMP}/
├── images/                  # Docker 镜像文件 (*.tar)
├── configs/                 # 配置文件
│   ├── docker-compose.yml
│   ├── .env.template
│   ├── .env.example
│   ├── Makefile
│   └── docker/
├── scripts/                 # 工具脚本
├── install-offline.sh       # 离线安装脚本
└── README.md               # 本文件
\`\`\`

## 部署步骤

### 1. 传输到目标服务器
\`\`\`bash
scp -r vulnflow-offline-${TIMESTAMP}.tar.gz user@target-server:/opt/
\`\`\`

### 2. 解压
\`\`\`bash
tar xzf vulnflow-offline-${TIMESTAMP}.tar.gz
cd vulnflow-offline-${TIMESTAMP}
\`\`\`

### 3. 运行离线安装脚本
\`\`\`bash
chmod +x install-offline.sh
./install-offline.sh
\`\`\`

### 4. 修改配置
\`\`\`bash
vim .env  # 修改密钥、密码等
\`\`\`

### 5. 重启服务
\`\`\`bash
docker compose down && docker compose up -d
\`\`\`

## 系统要求
- Docker Engine 20.10+
- Docker Compose V2
- 至少 8GB 内存
- 至少 20GB 磁盘空间
- Linux 内核 4.x+

## 注意事项
1. 首次部署后请立即修改所有默认密码
2. 确保目标服务器防火墙开放相关端口 (80, 443, 5432, 6379, 9200, 9000, 9001, 6333)
3. 建议在生产环境使用 HTTPS
EOF

    echo -e "  ${GREEN}✓${NC} README.md"
    echo ""
}

# ============================================================
# 打包
# ============================================================
package_export() {
    echo -e "${CYAN}打包离线部署包...${NC}"

    local archive_name="vulnflow-offline-${TIMESTAMP}.tar.gz"

    cd "${PROJECT_ROOT}/offline-package"
    tar czf "${archive_name}" "vulnflow-offline-${TIMESTAMP}"
    cd "${PROJECT_ROOT}"

    # 删除临时目录
    rm -rf "${EXPORT_DIR}"

    local final_path="${PROJECT_ROOT}/offline-package/${archive_name}"
    local size
    size=$(du -h "${final_path}" | cut -f1)

    echo -e "  ${GREEN}✓${NC} 导出包: ${final_path}"
    echo -e "    大小: ${size}"
    echo ""
}

# ============================================================
# 主流程
# ============================================================
main() {
    init_export
    export_images
    export_configs
    export_scripts
    create_readme
    package_export

    echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                 离线部署包导出完成！                        ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "文件位置: ${PROJECT_ROOT}/offline-package/vulnflow-offline-${TIMESTAMP}.tar.gz"
    echo -e "导出时间: $(date +"%Y-%m-%d %H:%M:%S")"
    echo ""
    echo -e "部署方法:"
    echo -e "  1. 将文件传输到目标服务器"
    echo -e "  2. tar xzf vulnflow-offline-${TIMESTAMP}.tar.gz"
    echo -e "  3. cd vulnflow-offline-${TIMESTAMP} && ./install-offline.sh"
    echo ""
}

main "$@"
