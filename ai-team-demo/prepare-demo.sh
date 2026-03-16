#!/bin/bash
# ClawCompany Demo 录制准备脚本
# 自动启用 Mock 模式并启动服务器

echo "🎬 ClawCompany Demo 录制准备"
echo "================================"
echo ""

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 1. 检查当前 Mock 模式
echo -e "${BLUE}1️⃣ 检查 Mock 模式${NC}"
if grep -q "USE_MOCK_LLM=true" .env.local 2>/dev/null; then
  echo -e "  当前状态: ${GREEN}✅ Mock 模式已启用${NC}"
else
  echo -e "  当前状态: ${YELLOW}⏹️ Mock 模式未启用${NC}"
  echo -e "  ${BLUE}正在启用 Mock 模式...${NC}"
  echo "USE_MOCK_LLM=true" >> .env.local
  echo -e "  ${GREEN}✅ Mock 模式已启用${NC}"
fi
echo ""

# 2. 检查端口
echo -e "${BLUE}2️⃣ 检查端口 3000${NC}"
if lsof -ti:3000 > /dev/null 2>&1; then
  echo -e "  当前状态: ${GREEN}✅ 服务器已启动${NC}"
  echo -e "  访问地址: ${BLUE}http://localhost:3000${NC}"
else
  echo -e "  当前状态: ${YELLOW}⏹️ 服务器未启动${NC}"
  echo -e "  ${BLUE}请运行以下命令启动服务器：${NC}"
  echo -e "  ${GREEN}./dev.sh${NC}"
fi
echo ""

# 3. 提醒录制步骤
echo -e "${BLUE}3️⃣ 录制步骤${NC}"
echo -e "  ${YELLOW}[1]${NC} 打开浏览器：http://localhost:3000"
echo -e "  ${YELLOW}[2]${NC} 点击 ${GREEN}'Start Chatting'${NC}"
echo -e "  ${YELLOW}[3]${NC} 输入：${GREEN}'创建一个登录页面'${NC}"
echo -e "  ${YELLOW}[4]${NC} 点击 ${GREEN}'Send'${NC}，观察快速响应（<1 秒）"
echo -e "  ${YELLOW}[5]${NC} 展示 PM Agent 的响应"
echo -e "  ${YELLOW}[6]${NC} 按照 ${BLUE}docs/DEMO-RECORDING-CHECKLIST.md${NC} 继续录制"
echo ""

# 4. 录制环境检查清单
echo -e "${BLUE}4️⃣ 录制环境检查清单${NC}"
echo -e "  ${YELLOW}[ ]${NC} 关闭所有通知（手机、电脑）"
echo -e "  ${YELLOW}[ ]${NC} 清理桌面"
echo -e "  ${YELLOW}[ ]${NC} 浏览器全屏（F11）"
echo -e "  ${YELLOW}[ ]${NC} 隐藏书签栏（Cmd+Shift+B）"
echo -e "  ${YELLOW}[ ]${NC} 关闭开发者工具"
echo -e "  ${YELLOW}[ ]${NC} 窗口大小：1920x1080 或 1280x720"
echo ""

# 5. 快速命令
echo -e "${BLUE}5️⃣ 快速命令${NC}"
echo -e "  启动服务器: ${GREEN}./dev.sh${NC}"
echo -e "  查看状态: ${GREEN}./check-status.sh${NC}"
echo -e "  切换 Mock: ${GREEN}./toggle-mock.sh${NC}"
echo ""

echo "================================"
echo -e "${GREEN}✅ Demo 录制准备完成！${NC}"
echo -e "${YELLOW}提示：录制完成后记得关闭 Mock 模式（运行 ./toggle-mock.sh）${NC}"
echo ""
