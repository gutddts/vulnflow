FROM python:3.12-slim

LABEL org.vulnflow.skill="sqli"
LABEL org.vulnflow.version="1.0.0"
LABEL org.vulnflow.description="SQL注入检测技能"

# 安装系统依赖
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
    && rm -rf /var/lib/apt/lists/*

# 创建非 root 用户
RUN useradd --create-home --shell /bin/bash skill && \
    mkdir -p /app /input /output && \
    chown -R skill:skill /app /input /output

WORKDIR /app

# 安装 Python 依赖
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制技能代码
COPY main.py .

# 切换到非 root 用户
USER skill

# 健康检查
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD python -c "import sys; sys.exit(0)"

ENTRYPOINT ["python", "main.py"]
