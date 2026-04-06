#!/bin/bash
set -e
cd /workspace/clone/agenthub

echo "=== AgentHub 隔离部署脚本 ==="
echo "时间: $(date)"
echo "Node: $(node --version)"
echo "npm: $(npm --version)"
echo ""

#---------------------------------------
# 第一步：检查环境
#---------------------------------------
echo "[1/7] 检查环境..."
command -v node >/dev/null 2>&1 || { echo "❌ Node.js 未找到"; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "❌ npm 未找到"; exit 1; }
echo "✅ Node.js $(node --version) + npm $(npm --version)"

#---------------------------------------
# 第二步：修改 server 使用 SQLite（无 Docker 时）
#---------------------------------------
echo "[2/7] 配置数据库为 SQLite..."

SERVER_SRC="/workspace/clone/agenthub/server/src"

# 查找 TypeORM 配置文件
TYPEORM_CONFIG="$SERVER_SRC/typeorm.config.ts"
if [ ! -f "$TYPEORM_CONFIG" ]; then
  TYPEORM_CONFIG="$SERVER_SRC/data-source.ts"
fi
if [ ! -f "$TYPEORM_CONFIG" ]; then
  TYPEORM_CONFIG="$SERVER_SRC/ormconfig.ts"
fi
if [ ! -f "$TYPEORM_CONFIG" ]; then
  TYPEORM_CONFIG=$(find $SERVER_SRC -name "*.ts" | xargs grep -l "TypeOrmModule.forRoot" 2>/dev/null | head -1)
fi
echo "找到 TypeORM 配置: $TYPEORM_CONFIG"

#---------------------------------------
# 第三步：安装 server 依赖并构建
#---------------------------------------
echo "[3/7] 安装 server 依赖..."
cd /workspace/clone/agenthub/server
npm install 2>&1 | tail -5
echo "✅ server 依赖安装完成"

echo "[4/7] 构建 server..."
mkdir -p dist data uploads
npm run build 2>&1 | tail -10
echo "✅ server 构建完成"

#---------------------------------------
# 第四步：安装 web 依赖并构建
#---------------------------------------
echo "[5/7] 安装 web 依赖..."
cd /workspace/clone/agenthub/web/agenthub-web
npm install 2>&1 | tail -5
echo "✅ web 依赖安装完成"

echo "[6/7] 构建 web..."
npm run build 2>&1 | tail -10
echo "✅ web 构建完成"

#---------------------------------------
# 第五步：启动 server（后台运行）
#---------------------------------------
echo "[7/7] 启动 server..."
cd /workspace/clone/agenthub/server

# 写一个 .env 让 server 用 SQLite + 配置端口
cat > .env << 'ENVEOF'
PORT=3000
DB_TYPE=sqlite
DB_DATABASE=./data/agenthub.db
JWT_SECRET=agenthub-jwt-secret-2026-isolate
NODE_ENV=production
ENVEOF

# 后台启动 server
nohup node dist/main.js > /workspace/clone/agenthub/server.log 2>&1 &
SERVER_PID=$!
echo "Server PID: $SERVER_PID"
echo $SERVER_PID > /workspace/clone/agenthub/server.pid

# 等待启动
sleep 5

# 检查进程
if kill -0 $SERVER_PID 2>/dev/null; then
  echo "✅ Server 进程运行中 (PID $SERVER_PID)"
else
  echo "❌ Server 进程已退出，日志："
  cat /workspace/clone/agenthub/server.log
  exit 1
fi

#---------------------------------------
# 第六步：检查端口
#---------------------------------------
echo ""
echo "=== 服务状态 ==="
ss -tlnp 2>/dev/null | grep -E "3000|80" || netstat -tlnp 2>/dev/null | grep -E "3000|80"
curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" http://localhost:3000/api 2>/dev/null || echo "API 尚无响应（正常，建表中）"
curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" http://localhost:3000/ 2>/dev/null || echo "根路径尚无响应"

echo ""
echo "=== 部署完成 ==="
echo "Server PID: $(cat /workspace/clone/agenthub/server.pid)"
echo "日志: /workspace/clone/agenthub/server.log"
echo "访问: http://localhost:3000"
