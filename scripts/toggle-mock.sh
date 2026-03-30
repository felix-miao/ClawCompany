#!/bin/bash
# Mock 模式切换脚本
# 用于 Demo 录制时快速切换

ENV_FILE=".env.local"
MOCK_VAR="USE_MOCK_LLM=true"

# 检查当前状态
if grep -q "^USE_MOCK_LLM=true" "$ENV_FILE" 2>/dev/null; then
    echo "📊 当前状态: Mock 模式已启用"
    echo ""
    echo "切换到真实 API 模式？ (y/n)"
    read -r answer
    if [ "$answer" = "y" ]; then
        # 注释掉 Mock 模式
        sed -i '' 's/^USE_MOCK_LLM=true/# USE_MOCK_LLM=true/' "$ENV_FILE"
        echo "✅ 已切换到真实 API 模式"
        echo "⚠️  请重启开发服务器: ./dev.sh"
    fi
else
    echo "📊 当前状态: 真实 API 模式"
    echo ""
    echo "切换到 Mock 模式？ (y/n)"
    read -r answer
    if [ "$answer" = "y" ]; then
        # 添加 Mock 模式
        echo "" >> "$ENV_FILE"
        echo "# ===================" >> "$ENV_FILE"
        echo "# Mock 模式（Demo 录制用）" >> "$ENV_FILE"
        echo "# ===================" >> "$ENV_FILE"
        echo "USE_MOCK_LLM=true" >> "$ENV_FILE"
        echo "✅ 已切换到 Mock 模式"
        echo "⚠️  请重启开发服务器: ./dev.sh"
    fi
fi
