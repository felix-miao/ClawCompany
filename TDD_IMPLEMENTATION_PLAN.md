# ClawCompany Multi-Agent 系统 - TDD 实施计划

**创建时间：** 2026-03-24 18:12
**开发方式：** TDD（测试驱动开发）
**验证方式：** 每个阶段测试通过后 commit

---

## 📋 实施原则

### TDD 流程
1. **Red** - 先写测试（测试会失败）
2. **Green** - 实现功能（让测试通过）
3. **Refactor** - 重构代码（保持测试通过）
4. **Commit** - 提交代码

### 验证要求
- ✅ 每个阶段必须有测试
- ✅ 测试必须通过
- ✅ 手动验证功能
- ✅ 验证通过后才能 commit

---

## 🎯 阶段划分

### Phase 1: 环境准备（15 分钟）
- [ ] 创建测试框架
- [ ] 配置 Jest
- [ ] 创建测试工具函数
- **测试：** 框架可以运行测试
- **验证：** 运行 `npm test` 成功
- **Commit：** `test: setup testing framework`

### Phase 2: Agent 创建（30 分钟）
- [ ] 测试 agent 创建
- [ ] 实现 agent 创建脚本
- [ ] 验证 agent 配置
- **测试：** 可以创建独立 agent
- **验证：** `openclaw agents list` 显示所有 agents
- **Commit：** `feat: create agents with openclaw CLI`

### Phase 3: 权限配置（20 分钟）
- [ ] 测试 openclaw.json 配置
- [ ] 实现 openclaw.json 配置
- [ ] 验证权限设置
- **测试：** 配置格式正确
- **验证：** `openclaw config validate` 通过
- **Commit：** `feat: configure agent permissions`

### Phase 4: 数据共享（20 分钟）
- [ ] 测试软链接创建
- [ ] 实现软链接脚本
- [ ] 验证数据共享
- **测试：** 软链接指向正确
- **验证：** 所有 agents 可以访问 tasks.json
- **Commit：** `feat: setup shared data directory`

### Phase 5: SOUL.md 编写（60 分钟）
- [ ] 测试 SOUL.md 格式
- [ ] 实现 SOUL.md 内容
- [ ] 验证 agent 行为
- **测试：** SOUL.md 包含必要内容
- **验证：** Agent 可以根据 SOUL.md 行为
- **Commit：** `feat: add SOUL.md for all agents`

### Phase 6: 集成测试（30 分钟）
- [ ] 测试 agent 间通信
- [ ] 实现完整工作流
- [ ] 验证端到端流程
- **测试：** 端到端测试通过
- **验证：** 完整流程可以运行
- **Commit：** `feat: complete multi-agent workflow`

---

## 🔧 Phase 1: 环境准备

### Step 1.1: 创建测试框架

**测试文件：** `tests/setup.test.ts`

```typescript
describe('Test Framework', () => {
  it('should be able to run tests', () => {
    expect(true).toBe(true);
  });
});
```

**实现步骤：**

```bash
# 1. 创建 tests 目录
mkdir -p tests

# 2. 创建测试文件
cat > tests/setup.test.ts << 'EOF'
describe('Test Framework', () => {
  it('should be able to run tests', () => {
    expect(true).toBe(true);
  });
});
EOF

# 3. 配置 Jest（如果还没有）
# package.json 中应该已经有 Jest 配置

# 4. 运行测试
npm test

# 预期：测试通过
```

**验证清单：**
- [ ] tests 目录已创建
- [ ] setup.test.ts 已创建
- [ ] `npm test` 运行成功
- [ ] 测试通过

**Commit:**
```bash
git add tests/setup.test.ts
git commit -m "test: setup testing framework"
```

---

## 🔧 Phase 2: Agent 创建

### Step 2.1: 测试 Agent 创建

**测试文件：** `tests/agents.test.ts`

```typescript
import { execSync } from 'child_process';

describe('Agent Creation', () => {
  const agents = ['pm', 'developer', 'tester', 'reviewer'];

  agents.forEach(agentId => {
    it(`should create ${agentId} agent`, () => {
      // 检查 agent 是否已存在
      const listOutput = execSync('openclaw agents list --json').toString();
      const agents = JSON.parse(listOutput);
      
      const exists = agents.some((a: any) => a.id === agentId);
      expect(exists).toBe(true);
    });
  });
});
```

### Step 2.2: 实现 Agent 创建

**脚本：** `scripts/create-agents.sh`

```bash
#!/bin/bash
set -e

AGENTS=("pm" "developer" "tester" "reviewer")

echo "🚀 Creating agents..."

for agent in "${AGENTS[@]}"; do
  echo "Creating agent: $agent"
  
  # 检查是否已存在
  if openclaw agents list --json | jq -e ".[] | select(.id == \"$agent\")" > /dev/null 2>&1; then
    echo "  ✅ Agent $agent already exists"
  else
    openclaw agents add "$agent" \
      --workspace ~/.openclaw/workspace-"$agent" \
      --model zai/glm-5
    echo "  ✅ Agent $agent created"
  fi
done

echo "✅ All agents created"
```

**执行步骤：**

```bash
# 1. 创建脚本
mkdir -p scripts
cat > scripts/create-agents.sh << 'EOF'
#!/bin/bash
set -e

AGENTS=("pm" "developer" "tester" "reviewer")

echo "🚀 Creating agents..."

for agent in "${AGENTS[@]}"; do
  echo "Creating agent: $agent"
  
  if openclaw agents list --json | jq -e ".[] | select(.id == \"$agent\")" > /dev/null 2>&1; then
    echo "  ✅ Agent $agent already exists"
  else
    openclaw agents add "$agent" \
      --workspace ~/.openclaw/workspace-"$agent" \
      --model zai/glm-5
    echo "  ✅ Agent $agent created"
  fi
done

echo "✅ All agents created"
EOF

chmod +x scripts/create-agents.sh

# 2. 运行脚本
./scripts/create-agents.sh

# 3. 验证
openclaw agents list

# 4. 运行测试
npm test

# 预期：所有测试通过
```

**验证清单：**
- [ ] 脚本已创建
- [ ] 脚本可执行
- [ ] 所有 agents 已创建
- [ ] `openclaw agents list` 显示所有 agents
- [ ] 测试通过

**Commit:**
```bash
git add scripts/create-agents.sh tests/agents.test.ts
git commit -m "feat: create agents with openclaw CLI"
```

---

## 🔧 Phase 3: 权限配置

### Step 3.1: 测试配置

**测试文件：** `tests/config.test.ts`

```typescript
import { readFileSync } from 'fs';
import { homedir } from 'os';

describe('OpenClaw Configuration', () => {
  it('should have valid openclaw.json', () => {
    const configPath = `${homedir()}/.openclaw/openclaw.json`;
    const config = JSON.parse(readFileSync(configPath, 'utf-8'));
    
    // 检查 agents 配置
    expect(config.agents).toBeDefined();
    expect(config.agents.list).toBeDefined();
    expect(config.agents.list.length).toBeGreaterThan(0);
  });

  it('should have agentToAgent enabled', () => {
    const configPath = `${homedir()}/.openclaw/openclaw.json`;
    const config = JSON.parse(readFileSync(configPath, 'utf-8'));
    
    expect(config.tools).toBeDefined();
    expect(config.tools.agentToAgent).toBeDefined();
    expect(config.tools.agentToAgent.enabled).toBe(true);
    expect(config.tools.agentToAgent.allow).toContain('main');
    expect(config.tools.agentToAgent.allow).toContain('pm');
  });

  it('should have sessions visibility set to all', () => {
    const configPath = `${homedir()}/.openclaw/openclaw.json`;
    const config = JSON.parse(readFileSync(configPath, 'utf-8'));
    
    expect(config.tools.sessions).toBeDefined();
    expect(config.tools.sessions.visibility).toBe('all');
  });
});
```

### Step 3.2: 实现配置

**配置更新脚本：** `scripts/update-config.sh`

```bash
#!/bin/bash
set -e

CONFIG_FILE=~/.openclaw/openclaw.json

echo "🔧 Updating OpenClaw configuration..."

# 备份原配置
cp "$CONFIG_FILE" "${CONFIG_FILE}.backup.$(date +%Y%m%d%H%M%S)"

# 使用 jq 更新配置
jq '.tools.agentToAgent = {
  "enabled": true,
  "allow": ["main", "pm", "developer", "tester", "reviewer"]
} | .tools.sessions.visibility = "all"' "$CONFIG_FILE" > "${CONFIG_FILE}.tmp"

mv "${CONFIG_FILE}.tmp" "$CONFIG_FILE"

echo "✅ Configuration updated"

# 验证配置
echo "🔍 Verifying configuration..."
openclaw config validate || echo "⚠️  Validation command not available, checking manually..."

# 检查配置格式
if jq empty "$CONFIG_FILE" 2>/dev/null; then
  echo "✅ Configuration is valid JSON"
else
  echo "❌ Configuration is invalid JSON"
  exit 1
fi
```

**执行步骤：**

```bash
# 1. 创建测试
cat > tests/config.test.ts << 'EOF'
import { readFileSync } from 'fs';
import { homedir } from 'os';

describe('OpenClaw Configuration', () => {
  it('should have valid openclaw.json', () => {
    const configPath = `${homedir()}/.openclaw/openclaw.json`;
    const config = JSON.parse(readFileSync(configPath, 'utf-8'));
    
    expect(config.agents).toBeDefined();
    expect(config.agents.list).toBeDefined();
    expect(config.agents.list.length).toBeGreaterThan(0);
  });

  it('should have agentToAgent enabled', () => {
    const configPath = `${homedir()}/.openclaw/openclaw.json`;
    const config = JSON.parse(readFileSync(configPath, 'utf-8'));
    
    expect(config.tools).toBeDefined();
    expect(config.tools.agentToAgent).toBeDefined();
    expect(config.tools.agentToAgent.enabled).toBe(true);
    expect(config.tools.agentToAgent.allow).toContain('main');
    expect(config.tools.agentToAgent.allow).toContain('pm');
  });

  it('should have sessions visibility set to all', () => {
    const configPath = `${homedir()}/.openclaw/openclaw.json`;
    const config = JSON.parse(readFileSync(configPath, 'utf-8'));
    
    expect(config.tools.sessions).toBeDefined();
    expect(config.tools.sessions.visibility).toBe('all');
  });
});
EOF

# 2. 运行测试（应该失败，因为配置还没有更新）
npm test || echo "Expected to fail - configuration not yet updated"

# 3. 创建配置更新脚本
mkdir -p scripts
cat > scripts/update-config.sh << 'EOF'
#!/bin/bash
set -e

CONFIG_FILE=~/.openclaw/openclaw.json

echo "🔧 Updating OpenClaw configuration..."

cp "$CONFIG_FILE" "${CONFIG_FILE}.backup.$(date +%Y%m%d%H%M%S)"

jq '.tools.agentToAgent = {
  "enabled": true,
  "allow": ["main", "pm", "developer", "tester", "reviewer"]
} | .tools.sessions.visibility = "all"' "$CONFIG_FILE" > "${CONFIG_FILE}.tmp"

mv "${CONFIG_FILE}.tmp" "$CONFIG_FILE"

echo "✅ Configuration updated"

echo "🔍 Verifying configuration..."
if jq empty "$CONFIG_FILE" 2>/dev/null; then
  echo "✅ Configuration is valid JSON"
else
  echo "❌ Configuration is invalid JSON"
  exit 1
fi
EOF

chmod +x scripts/update-config.sh

# 4. 运行配置更新脚本
./scripts/update-config.sh

# 5. 再次运行测试（应该通过）
npm test

# 预期：所有测试通过
```

**验证清单：**
- [ ] 测试文件已创建
- [ ] 初始测试失败（配置未更新）
- [ ] 配置脚本已创建
- [ ] 配置已更新
- [ ] 测试通过
- [ ] 配置格式正确

**Commit:**
```bash
git add tests/config.test.ts scripts/update-config.sh
git commit -m "feat: configure agent permissions"
```

---

## 🔧 Phase 4: 数据共享

### Step 4.1: 测试软链接

**测试文件：** `tests/data-sharing.test.ts`

```typescript
import { existsSync, lstatSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { resolve } from 'path';

describe('Data Sharing', () => {
  const agents = ['pm', 'developer', 'tester', 'reviewer'];
  
  agents.forEach(agentId => {
    it(`should have data symlink for ${agentId}`, () => {
      const dataPath = `${homedir()}/.openclaw/workspace-${agentId}/data`;
      
      // 检查是否存在
      expect(existsSync(dataPath)).toBe(true);
      
      // 检查是否是软链接
      const stats = lstatSync(dataPath);
      expect(stats.isSymbolicLink()).toBe(true);
      
      // 检查指向正确的目标
      const target = resolve(dataPath);
      expect(target).toBe(`${homedir()}/.openclaw/shared-data`);
    });
  });

  it('should have shared-data directory', () => {
    const sharedDataPath = `${homedir()}/.openclaw/shared-data`;
    expect(existsSync(sharedDataPath)).toBe(true);
  });

  it('should have tasks.json in shared-data', () => {
    const tasksPath = `${homedir()}/.openclaw/shared-data/tasks.json`;
    expect(existsSync(tasksPath)).toBe(true);
    
    // 检查格式
    const tasks = JSON.parse(readFileSync(tasksPath, 'utf-8'));
    expect(tasks.tasks).toBeDefined();
    expect(Array.isArray(tasks.tasks)).toBe(true);
  });
});
```

### Step 4.2: 实现软链接

**脚本：** `scripts/setup-shared-data.sh`

```bash
#!/bin/bash
set -e

SHARED_DATA=~/.openclaw/shared-data

echo "🔧 Setting up shared data directory..."

# 1. 创建共享数据目录
mkdir -p "$SHARED_DATA"

# 2. 初始化 tasks.json
if [ ! -f "$SHARED_DATA/tasks.json" ]; then
  echo '{ "tasks": [] }' > "$SHARED_DATA/tasks.json"
  echo "✅ Created tasks.json"
else
  echo "✅ tasks.json already exists"
fi

# 3. 为每个 agent 创建软链接
AGENTS=("pm" "developer" "tester" "reviewer")

for agent in "${AGENTS[@]}"; do
  WORKSPACE=~/.openclaw/workspace-"$agent"
  DATA_LINK="$WORKSPACE/data"
  
  mkdir -p "$WORKSPACE"
  
  if [ -L "$DATA_LINK" ]; then
    echo "  ✅ $agent data symlink already exists"
  elif [ -d "$DATA_LINK" ]; then
    echo "  ⚠️  $agent data is a directory, replacing with symlink"
    rm -rf "$DATA_LINK"
    ln -s "$SHARED_DATA" "$DATA_LINK"
    echo "  ✅ $agent data symlink created"
  else
    ln -s "$SHARED_DATA" "$DATA_LINK"
    echo "  ✅ $agent data symlink created"
  fi
done

echo "✅ Shared data setup complete"

# 验证
echo "🔍 Verifying..."
for agent in "${AGENTS[@]}"; do
  DATA_LINK=~/.openclaw/workspace-"$agent"/data
  if [ -L "$DATA_LINK" ]; then
    TARGET=$(readlink "$DATA_LINK")
    echo "  $agent: $TARGET"
  else
    echo "  ❌ $agent: not a symlink"
    exit 1
  fi
done

echo "✅ All symlinks verified"
```

**执行步骤：**

```bash
# 1. 创建测试
cat > tests/data-sharing.test.ts << 'EOF'
import { existsSync, lstatSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { resolve } from 'path';

describe('Data Sharing', () => {
  const agents = ['pm', 'developer', 'tester', 'reviewer'];
  
  agents.forEach(agentId => {
    it(`should have data symlink for ${agentId}`, () => {
      const dataPath = `${homedir()}/.openclaw/workspace-${agentId}/data`;
      expect(existsSync(dataPath)).toBe(true);
      
      const stats = lstatSync(dataPath);
      expect(stats.isSymbolicLink()).toBe(true);
      
      const target = resolve(dataPath);
      expect(target).toBe(`${homedir()}/.openclaw/shared-data`);
    });
  });

  it('should have shared-data directory', () => {
    const sharedDataPath = `${homedir()}/.openclaw/shared-data`;
    expect(existsSync(sharedDataPath)).toBe(true);
  });

  it('should have tasks.json in shared-data', () => {
    const tasksPath = `${homedir()}/.openclaw/shared-data/tasks.json`;
    expect(existsSync(tasksPath)).toBe(true);
    
    const tasks = JSON.parse(readFileSync(tasksPath, 'utf-8'));
    expect(tasks.tasks).toBeDefined();
    expect(Array.isArray(tasks.tasks)).toBe(true);
  });
});
EOF

# 2. 运行测试（应该失败）
npm test || echo "Expected to fail - shared data not setup"

# 3. 创建脚本
mkdir -p scripts
cat > scripts/setup-shared-data.sh << 'EOF'
#!/bin/bash
set -e

SHARED_DATA=~/.openclaw/shared-data

echo "🔧 Setting up shared data directory..."

mkdir -p "$SHARED_DATA"

if [ ! -f "$SHARED_DATA/tasks.json" ]; then
  echo '{ "tasks": [] }' > "$SHARED_DATA/tasks.json"
  echo "✅ Created tasks.json"
else
  echo "✅ tasks.json already exists"
fi

AGENTS=("pm" "developer" "tester" "reviewer")

for agent in "${AGENTS[@]}"; do
  WORKSPACE=~/.openclaw/workspace-"$agent"
  DATA_LINK="$WORKSPACE/data"
  
  mkdir -p "$WORKSPACE"
  
  if [ -L "$DATA_LINK" ]; then
    echo "  ✅ $agent data symlink already exists"
  elif [ -d "$DATA_LINK" ]; then
    echo "  ⚠️  $agent data is a directory, replacing with symlink"
    rm -rf "$DATA_LINK"
    ln -s "$SHARED_DATA" "$DATA_LINK"
    echo "  ✅ $agent data symlink created"
  else
    ln -s "$SHARED_DATA" "$DATA_LINK"
    echo "  ✅ $agent data symlink created"
  fi
done

echo "✅ Shared data setup complete"

echo "🔍 Verifying..."
for agent in "${AGENTS[@]}"; do
  DATA_LINK=~/.openclaw/workspace-"$agent"/data
  if [ -L "$DATA_LINK" ]; then
    TARGET=$(readlink "$DATA_LINK")
    echo "  $agent: $TARGET"
  else
    echo "  ❌ $agent: not a symlink"
    exit 1
  fi
done

echo "✅ All symlinks verified"
EOF

chmod +x scripts/setup-shared-data.sh

# 4. 运行脚本
./scripts/setup-shared-data.sh

# 5. 运行测试（应该通过）
npm test

# 预期：所有测试通过
```

**验证清单：**
- [ ] 测试文件已创建
- [ ] 初始测试失败
- [ ] 脚本已创建
- [ ] 脚本执行成功
- [ ] 所有软链接已创建
- [ ] 测试通过

**Commit:**
```bash
git add tests/data-sharing.test.ts scripts/setup-shared-data.sh
git commit -m "feat: setup shared data directory"
```

---

## 🎯 继续执行

**我已经准备好前 4 个阶段的详细步骤。**

**需要我：**
1. 继续详细设计 Phase 5（SOUL.md 编写）？
2. 还是立即开始执行 Phase 1？

**告诉我你的选择，我立即开始！** 🚀
