#!/bin/bash
cd /workspace/agenthub/server
# 找到并杀死占用 3000 端口的进程
PID=$(lsof -ti:3000 2>/dev/null)
if [ -n "$PID" ]; then
  kill -9 $PID 2>/dev/null
  echo "Killed PID: $PID"
fi
sleep 1
# 重新启动
nohup node dist/main > /tmp/agenthub.log 2>&1 &
echo "Started PID: $!"
sleep 2
curl -s http://localhost:3000/api/admin/stats
