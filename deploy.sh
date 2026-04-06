#!/bin/bash
# =============================================================================
# AgentHub 一键部署脚本
# =============================================================================

set -e

APP_DIR="/root/.openclaw/workspace/agenthub"
DEPLOY_DIR="/var/www/agenthub"
BACKEND_PORT=3000
NGINX_BIN="/usr/sbin/nginx"

echo "[deploy] 开始部署 AgentHub..."

# 杀掉旧后端
pkill -f "node.*dist/main" 2>/dev/null || true
sleep 1
echo "[deploy] 旧进程已清理"

# ─── 1. 构建后端 ───────────────────────────────────────────────────────────
echo "[deploy] 1/4 构建后端..."
cd "$APP_DIR/server"
npm run build 2>&1 | tail -5
echo "[deploy] 后端构建完成"

# ─── 2. 构建前端 ───────────────────────────────────────────────────────────
echo "[deploy] 2/4 构建前端..."
cd "$APP_DIR/web/agenthub-web"
npm run build 2>&1 | tail -5

# 部署到 nginx 目录
mkdir -p "$DEPLOY_DIR"
cp -rf dist/. "$DEPLOY_DIR/"
echo "[deploy] 前端部署到 $DEPLOY_DIR 完成"

# ─── 3. 配置 nginx ─────────────────────────────────────────────────────────
echo "[deploy] 3/4 配置 nginx..."

cat > /etc/nginx/sites-enabled/agenthub << 'NGINXCONF'
server {
    listen 80;
    server_name _;
    root /var/www/agenthub;
    index index.html;

    # 前端 SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API 代理（strip /api prefix）
    location /api/ {
        proxy_pass http://127.0.0.1:3000/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 10s;
        proxy_read_timeout 60s;
    }

    # Socket.IO WebSocket
    location /socket.io/ {
        proxy_pass http://127.0.0.1:3000/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location ~ /\. { deny all; }
}
NGINXCONF

# 语法检查
if ! $NGINX_BIN -t 2>&1 | grep -q "syntax is ok"; then
    echo "[ERROR] nginx 配置语法错误:"
    $NGINX_BIN -t 2>&1
    exit 1
fi
echo "[deploy] nginx 配置 OK"

# 重启 nginx
$NGINX_BIN -s reload 2>/dev/null || $NGINX_BIN
echo "[deploy] nginx 已重载"

# ─── 4. 启动后端 ────────────────────────────────────────────────────────────
echo "[deploy] 4/4 启动后端..."
cd "$APP_DIR/server"
nohup node dist/main.js > server.log 2>&1 &
echo $! > /tmp/agenthub-backend.pid
echo "[deploy] 后端 PID: $(cat /tmp/agenthub-backend.pid)"

# 等待启动
for i in $(seq 1 15); do
    sleep 1
    if curl -sf --max-time 2 http://127.0.0.1:${BACKEND_PORT}/api/agents/online > /dev/null 2>&1; then
        echo "[deploy] 后端启动成功"
        break
    fi
    if (( i == 15 )); then
        echo "[ERROR] 后端启动超时，日志:"
        tail -30 "$APP_DIR/server/server.log"
        exit 1
    fi
done

# ─── 5. 健康检查 ──────────────────────────────────────────────────────────
echo ""
echo "=========================================="
echo "健康检查..."
echo "=========================================="

API_RESP=$(curl -sf --max-time 3 http://127.0.0.1:${BACKEND_PORT}/api/agents/online 2>&1 || echo "FAIL")
if echo "$API_RESP" | grep -q '"ok"'; then
    echo "[OK] API:  http://127.0.0.1:${BACKEND_PORT}/api/agents/online"
else
    echo "[FAIL] API: $API_RESP"
fi

FRONTEND=$(curl -sf --max-time 3 http://127.0.0.1/ 2>&1 | grep -c "index.html" || echo "0")
if (( FRONTEND > 0 )); then
    echo "[OK] 前端: http://127.0.0.1/"
else
    echo "[FAIL] 前端: /var/www/agenthub/ 无内容"
fi

echo ""
echo "=========================================="
echo "部署完成！"
echo "=========================================="
IP=$(hostname -I 2>/dev/null | awk '{print $1}')
echo "前端: http://${IP}/"
echo "后端: http://127.0.0.1:${BACKEND_PORT}/api/"
echo "日志: $APP_DIR/server/server.log"
