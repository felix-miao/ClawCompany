# Discovered Multi-Agent Projects

> 由 main agent 维护，避免重复推荐

## 已发现的项目

### 2026-03-30 初始列表

| 项目 | 链接 | 特点 | 相似度 |
|------|------|------|--------|
| **edict** | https://github.com/cft0808/edict | 多agent协作 | - |
| **danghuangshang** | https://github.com/wanikua/danghuangshang | 多agent协作 | - |

### 2026-03-31 新发现项目

| 项目 | 链接 | 特点 | 相似度 | 优先级 |
|------|------|------|--------|--------|
| **Squad** | https://github.com/bradygaster/squad | AI开发团队，团队持久化 | 🔶🔶🔶🔶 | 高 |
| **Agency Swarm** | https://github.com/VRSEN/agency-swarm | 生产级多agent编排框架 | 🔶🔶🔶🔶🔶 | 高 |
| **Swarms** | https://github.com/kyegomez/swarms | 企业级多agent基础设施 | 🔶🔶🔶🔶🔶 | 高 |
| **MotleyCrew** | https://github.com/MotleyAI/motleycrew | 混合框架多agent系统 | 🔶🔶🔶 | 中 |
| **OpenAI Swarm** | https://github.com/openai/swarm | 教育极简多agent框架 | 🔶🔶 | 低 |
| **L3AGI** | https://github.com/l3vels/team-of-ai-agents | 人级团队协作框架 | 🔶🔶🔶 | 中 |

### 2026-04-01 深度分析项目

| 项目 | 核心特点 | 与 ClawCompany 对比 | 关键启发 |
|------|----------|-------------------|----------|
| **Agency Swarm** | - 双模式通信（SendMessage/Handoff）<br>- 声明式通信拓扑（communication_flows）<br>- OpenAI Agents SDK 构建<br>- 集成OpenClaw作为worker | **架构定位**：多agent编排框架 vs 单agent运行时<br>**通信机制**：工具委托 vs 内置消息<br>**工具边界**：Python工具 vs 原生插件<br>**编排权**：集中式编排 vs 分布式 | 1. **通信拓扑声明**：`ceo > dev` 的方向性通信<br>2. **OpenClaw集成模式**：作为worker而非核心<br>3. **Stream事件合并**：多agent事件的流式合并机制<br>4. **工具注入机制**：动态注册subagent工具 |
| **Edict 三省六部** | - 三层制度化协作（中书→门下→尚书）<br>- 强制审核机制（门下省封驳）<br>- 9状态有限状态机<br>- 权限矩阵零信任设计<br>- 4阶段自动恢复 | **核心差异**：制度约束 vs 自由协作<br>**审核机制**：内置强制审核 vs 无审核<br>**可观测性**：59条/任务完整审计 vs 黑盒<br>**可干预性**：实时看板干预 vs 执行后难干预 | 1. **制度化审核**：关键流程的强制审核agent<br>2. **权限矩阵**：零信任的agent调用权限<br>3. **状态机驱动**：严格的任务状态转换<br>4. **多层可观测性**：flow_log + progress_log + session融合<br>5. **朝堂议政**：多角色agent讨论模式 |
| **Swarms** | - 16+种编排模式<br>- 企业级基础设施<br>- AgentRearrange DSL + 10+ Swarm架构<br>- 工具箱式编排优先 | **编排模式**：16+种架构 vs 基础session管理<br>**设计哲学**：编排优先 vs Agent自主<br>**复杂度**：高学习曲线 vs 低门槛 | 1. **AgentRearrange DSL**：`"a -> b,c -> d"` 灵活编排<br>2. **BaseSwarm继承**：创建新的拓扑模式<br>3. **企业级特性**：autosave、遥测、MCP、marketplace<br>4. **LiteLLM统一封装**：100+模型支持 |

## 核心发现总结

### 1. 三大架构范式对比

| 范式 | 代表项目 | 核心思想 | 适用场景 |
|------|----------|----------|----------|
| **结构化通信流** | Agency Swarm | 组织架构映射为通信拓扑 | 企业级组织建模 |
| **制度约束** | Edict 三省六部 | 制度约束Agent行为 | 严苛质量要求的协作 |
| **工具箱式编排** | Swarms | 16+种预设拓扑 + DSL编排 | 确定性的企业工作流 |

### 2. 对 ClawCompany 的关键改进建议

#### 短期改进（可立即实施）
1. **引入通信拓扑声明**：借鉴Agency Swarm的`communication_flows`，允许声明agent间调用关系
2. **多层活动追踪**：借鉴Edict的三层可观测性，提供从宏观到微观的agent活动视图
3. **流式事件合并**：实现多agent事件的流式合并，提升实时协作体验

#### 中期改进（架构重构）
1. **审核agent模式**：在关键流程（代码提交、方案设计）引入强制审核agent
2. **权限矩阵系统**：实现零信任的agent调用权限控制
3. **状态机驱动**：用有限状态机约束任务生命周期，防止非法状态转换

#### 长期改进（战略级）
1. **角色化agent设计**：为不同场景（安全审计、性能优化、文档生成）设计专门的角色agent
2. **朝堂议政模式**：多agent围绕技术方案展开多视角讨论
3. **技能生态市场**：构建agent技能的按需扩展机制
4. **多模式编排支持**：借鉴Swarms的16+种架构，为不同任务类型提供最优编排模式
5. **DSL流编排**：实现类似AgentRearrange的`"a -> b,c -> d"`灵活工作流定义

### 3. 技术债务识别

#### Agency Swarm 的债务
- **强依赖OpenAI SDK**：生态绑定，灵活性受限
- **复杂通信拓扑**：声明式配置学习成本高
- **缺少审核机制**：质量保障依赖agent智能

#### Edict 的债务  
- **过度依赖隐喻**：三省六部增加认知负担
- **SOUL.md脆弱性**：prompt质量决定agent行为质量
- **subprocess派发延迟**：进程创建开销大

#### Swarms 的债务
- **过度设计**：16+种模式增加复杂度，学习成本高
- **Agent过重**：单个Agent~6175行，违反单一职责原则
- **缺少制度化保障**：完全依赖agent协作智能
- **LiteLLM抽象**：模型统一封装但增加额外层

### 4. 最佳实践建议

1. **混合架构**：Agency Swarm的结构化通信 + Edict的审核机制
2. **渐进式增强**：从简单的session管理逐步引入复杂的协作模式
3. **可观测性优先**：每个agent活动必须可追踪、可审计
4. **权限最小化**：零信任模型，agent默认无权限调用其他agent

---
*最后更新: 2026-04-01 08:12*