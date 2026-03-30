#!/bin/bash
# 启动开发服务器前的清理脚本

echo "🧹 清理旧进程..."

# 清理所有 next dev 进程
pkill -9 -f "next dev" 2>/dev/null

# 清理 ai-team-demo 相关进程
ps aux | grep "ai-team-demo" | grep -v grep | awk '{print $2}' | xargs kill -9 2>/dev/null

# 等待进程完全退出
sleep 2

echo "✅ 清理完成"
echo ""
echo "🚀 启动开发服务器..."

# 启动 dev server
npm run dev
