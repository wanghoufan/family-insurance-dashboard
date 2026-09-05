# 构建最小化静态站点镜像：整个产品是单个 HTML 文件，无构建步骤、无运行时依赖。
# 镜像内只含公开静态资源；不含任何密钥、不含 .env.local（由部署侧注入，仅 AUTH 之外的公开变量）。
FROM nginx:1.27-alpine

LABEL org.opencontainers.image.title="family-insurance-dashboard" \
      org.opencontainers.image.description="家庭保单数据看板（单文件静态站点）"

# 覆盖默认站点配置：关闭版本号暴露，仅为静态文件服务
RUN printf '%s\n' \
  'server {' \
  '    listen       80;' \
  '    server_name  _;' \
  '    server_tokens off;' \
  '    root   /usr/share/nginx/html;' \
  '    index  index.html;' \
  '    location / {' \
  '        try_files $uri $uri/ /index.html;' \
  '    }' \
  '}' > /etc/nginx/conf.d/default.conf

# 唯一发布物：源码目录中的单文件产品
COPY src/family-insurance-dashboard.html /usr/share/nginx/html/index.html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null 2>&1 || exit 1
