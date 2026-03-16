#!/bin/bash
# ClawCompany 项目状态检查脚本

echo "🔍 ClawCompany 项目状态检查"
echo "================================"
echo ""

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 1. 检查 Git 状态
echo -e "${BLUE}📦 Git 状态${NC}"
cd /Users/felixmiao/Projects/ClawCompany
LAST_COMMIT=$(git log -1 --format="%ai %s")
echo -e "  最后提交: ${GREEN}$LAST_COMMIT${NC}"
COMMIT_COUNT=$(git log --oneline | wc -l | tr -d ' ')
echo -e "  总提交数: ${GREEN}$COMMIT_COUNT${NC}"
echo ""

# 2. 检查测试状态
echo -e "${BLUE}🧪 测试状态${NC}"
cd /Users/felixmiao/Projects/ClawCompany/ai-team-demo
TEST_RESULT=$(npm test 2>&1 | grep "Test Suites:")
if echo "$TEST_RESULT" | grep -q "passed"; then
  echo -e "  测试状态: ${GREEN}✅ 全部通过${NC}"
  echo -e "  $TEST_RESULT"
else
  echo -e "  测试状态: ${RED}❌ 有失败${NC}"
fi
echo ""

# 3. 检查 Mock 模式
echo -e "${BLUE}⚡ Mock 模式${NC}"
if grep -q "USE_MOCK_LLM=true" .env.local 2>/dev/null; then
  echo -e "  当前状态: ${YELLOW}🔶 Mock 模式（用于 Demo 录制）${NC}"
  echo -e "  响应时间: ${GREEN}<1 秒${NC}"
else
  echo -e "  当前状态: ${GREEN}✅ 真实 API 模式${NC}"
  echo -e "  响应时间: ${YELLOW}~60 秒（取决于 GLM API）${NC}"
fi
echo ""

# 4. 检查服务器状态
echo -e "${BLUE}🌐 服务器状态${NC}"
if lsof -ti:3000 > /dev/null 2>&1; then
  echo -e "  端口 3000: ${GREEN}✅ 已启动${NC}"
  echo -e "  访问地址: ${BLUE}http://localhost:3000${NC}"
else
  echo -e "  端口 3000: ${YELLOW}⏹️ 未启动${NC}"
  echo -e "  启动命令: ${BLUE}./dev.sh${NC}"
fi
echo ""

# 5. 待办事项
echo -e "${BLUE}📋 待办事项${NC}"
echo -e "  ${YELLOW}[ ]${NC} 录制 Demo 视频（2-3 分钟）"
echo -e "  ${YELLOW}[ ]${NC} 填充项目说明书内容"
echo -e "  ${YELLOW}[ ]${NC} 制作项目海报"
echo ""

# 6. 快速命令
echo -e "${BLUE}⚡ 快速命令${NC}"
echo -e "  切换 Mock 模式: ${BLUE}./toggle-mock.sh${NC}"
echo -e "  启动开发服务器: ${BLUE}./dev.sh${NC}"
echo -e "  运行测试: ${BLUE}npm test${NC}"
echo ""

# 7. 文档路径
echo -e "${BLUE}📚 重要文档${NC}"
echo -e "  项目说明书: ${BLUE}docs/PROJECT-DESCRIPTION.md${NC}"
echo -e "  海报设计指南: ${BLUE}docs/POSTER-DESIGN.md${NC}"
echo -e "  Demo 录制清单: ${BLUE}docs/DEMO-RECORDING-CHECKLIST.md${NC}"
echo -e "  白天任务清单: ${BLUE}docs/MORNING-READY.md${NC}"
echo ""

echo "================================"
echo -e "${GREEN}✅ 状态检查完成！${NC}"
echo ""
