FROM nginx:alpine

LABEL maintainer="VulnFlow Team"
LABEL description="VulnFlow Nginx Reverse Proxy"

# 安装 curl 用于健康检查
RUN apk add --no-cache curl

# 复制自定义配置
COPY nginx.conf /etc/nginx/nginx.conf

# 创建日志目录
RUN mkdir -p /var/log/nginx && \
    chown -R nginx:nginx /var/log/nginx

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=10s \
    CMD curl -f http://localhost/health || exit 1

EXPOSE 80 443

STOPSIGNAL SIGQUIT

CMD ["nginx", "-g", "daemon off;"]
