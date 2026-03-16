#!/bin/bash

# E2E 测试快速启动脚本

echo "🎭 ClawCompany E2E 测试"
echo "========================"
echo ""

# 检查 dev server 是否运行
if curl -s http://localhost:3000 > /dev/null 2>&1; then
  echo "✅ Dev server is running at http://localhost:3000"
else
  echo "⚠️  Dev server is not running"
  echo "   Starting dev server..."
  npm run dev &
  DEV_PID=$!
  echo "   Waiting for server to start..."
  sleep 10
fi

echo ""
echo "📊 Running E2E tests..."
echo ""

# 运行测试
npx playwright test --reporter=list

# 检查测试结果
if [ $? -eq 0 ]; then
  echo ""
  echo "✅ All tests passed!"
else
  echo ""
  echo "❌ Some tests failed"
  echo "   Run 'npm run test:e2e:ui' to debug"
fi

# 清理
if [ ! -z "$DEV_PID" ]; then
  echo ""
  echo "🧹 Cleaning up..."
  kill $DEV_PID 2>/dev/null
fi
