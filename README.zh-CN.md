# neonity

一个迷你 Claude Code 智能体框架 —— 运行在终端中的 AI 编程助手。

**v0.1.0** · Node.js ≥ 20 · TypeScript

## 快速开始

```bash
cp .env.example .env
# 编辑 .env — 至少配置一个 API 密钥并选择服务商
pnpm install
pnpm build
pnpm start

# 或直接从源码运行（无需构建）：
pnpm start:dev
```

## 特性

- **多服务商支持** — Anthropic Claude、OpenAI GPT、Google Gemini、DeepSeek。自动根据可用的 API 密钥检测启用的服务商。
- **智能路由** — 多服务商智能路由，包含成本分层、基于关键词的复杂度分析、熔断器、指数退避和 Token 用量追踪。
- **REACT 智能体循环** — 标准工具调用循环：LLM 推理、调用工具、观察结果、再次推理。
- **流式输出** — 终端内 Markdown 渲染，支持语法高亮代码块、粗体、斜体、删除线、列表、引用块、标题等。
- **技能系统** — 运行时可按需启用的能力模块，增强智能体的系统提示词。使用 `/skill <name>` 切换开关。状态在重启后保持。
- **会话管理** — 使用 `/save`、`/load`、`/sessions`、`/delsession` 保存、加载、列出和删除命名会话。
- **Tab 补全** — 斜杠命令（`/`）和文件路径补全（在输入中包含 `/` 或 `~` 时触发）。

## 支持的服务商

| 服务商    | 环境变量              | 默认模型                    |
|-----------|----------------------|----------------------------|
| Anthropic | `ANTHROPIC_API_KEY`  | `claude-sonnet-4-20250514` |
| OpenAI    | `OPENAI_API_KEY`     | `gpt-4.1`                  |
| Gemini    | `GEMINI_API_KEY`     | `gemini-2.5-flash`         |
| DeepSeek  | `DEEPSEEK_API_KEY`   | `deepseek-v4-pro`          |

DeepSeek 还支持推理 Token（`reasoning_content`），适用于其思考模型。

在 `.env` 中设置 `DEFAULT_PROVIDER` 选择首选服务商。如果该服务商没有可用密钥，neonity 会回退到第一个可用的服务商。

可通过 `ANTHROPIC_MODEL`、`OPENAI_MODEL`、`GEMINI_MODEL` 或 `DEEPSEEK_MODEL` 覆盖默认模型。

## 智能路由

在 `.env` 中设置 `ROUTER_MODE=true` 启用路由模式。路由器将查询按成本分层分发到多个服务商：

### 分层

| 层级       | 用途               | 典型场景                       |
|-----------|--------------------|-------------------------------|
| `cheap`    | 简单、低风险查询     | "git status 是做什么的？"、"列出文件" |
| `standard` | 日常编码任务        | 中等复杂度，大多数查询的默认层级       |
| `premium`  | 复杂、高风险任务     | 重构、调试、安全审计                |

### 复杂度分析

成本优化策略分析每个查询的复杂度信号：

- **关键词启发式** — 检测如 `refactor`（重构）、`debug`（调试）、`security`（安全）、`performance`（性能）、`architecture`（架构）、`migrate`（迁移）、`concurrency`（并发）、大段代码块等模式。
- **对话上下文** — 多轮对话和之前的工具使用会自动升级到 premium 层级。
- **长度阈值** — 非常短的单条消息查询路由到 cheap；非常长的查询路由到 premium。

### 弹性特性

- **熔断器** — 连续失败 3 次（可配置）后，服务商被暂时禁用 30 秒。冷却期满后自动以半开状态重试。
- **指数退避** — 同一层级内的重试使用指数退避（1s → 2s → 4s...）并添加随机抖动，避免惊群效应。
- **跨层回退** — 如果某个层级中的所有服务商都失败，路由器按顺序回退到下一层级（cheap → standard → premium）。
- **层内故障转移** — 每个层级支持多个服务商，通过轮询实现负载均衡。

### 监控

使用斜杠命令在运行时检查路由器状态：

```
> /router          # 显示路由策略、熔断器、延迟统计
> /router-reset    # 重置所有熔断器（或指定服务商标签）
> /cost            # 显示累计 Token 使用量和预估费用
```

启用 `ROUTER_TRACK_LATENCY=true` 以记录每个服务商的响应时间（平均、P95、错误率）。启用 `ROUTER_TRACK_BUDGET=true` 以追踪累计 Token 用量和近似费用估算。

### 配置

所有路由器配置选项（包括复杂度阈值、熔断器调优和延迟/用量追踪开关）请参见 `.env.example`。

## 内置工具

| 工具    | 描述                           |
|---------|-------------------------------|
| `bash`  | 执行 Shell 命令，30 秒超时      |
| `read`  | 读取文件内容                   |
| `write` | 创建或覆盖文件（自动创建父目录） |
| `edit`  | 在文件中进行精确字符串替换      |

## 内置技能

技能默认关闭。在运行时切换 — 状态会被持久化到 `~/.neonity/skills.json`。

```
> /skills                      # 列出所有技能
> /skill code-reviewer         # 开启代码审查技能
> /skill code-reviewer         # 再次执行则关闭
```

| 技能              | 描述                                   |
|-------------------|---------------------------------------|
| `code-reviewer`   | 系统性审查代码中的 Bug、安全隐患、性能问题和风格问题 |
| `test-writer`     | 生成单元/集成测试，包含适当的 Mock 和覆盖率考量    |
| `git-committer`   | 创建语义化的 Conventional Commits 提交信息    |
| `doc-writer`      | 生成 API 文档、README 文件和内联 JSDoc/TSDoc   |

## 架构

```
src/
├── index.ts              入口 — 组装所有模块
├── config.ts             环境变量驱动的配置加载（单服务商 + 路由模式）
├── types.ts              核心类型定义（ContentBlock、Provider、Tool 等）
├── agent/
│   ├── agent.ts          REACT 循环智能体，协调工具调用
│   └── system-prompt.ts  构建智能体的系统提示词
├── provider/
│   ├── provider.ts       统一导出
│   ├── factory.ts        服务商工厂 + 路由器构建器
│   ├── router.ts         智能路由：分层、熔断器、延迟追踪、用量追踪
│   ├── anthropic.ts      Anthropic Messages API 适配器
│   ├── openai-provider.ts OpenAI Chat Completions + DeepSeek 推理
│   ├── deepseek-provider.ts DeepSeek 原生 API 适配器
│   └── gemini.ts         Google Gemini 适配器
├── tool/
│   ├── tool.ts           工具注册表
│   ├── bash-tool.ts      Shell 命令执行
│   ├── read-tool.ts      文件读取
│   ├── write-tool.ts     文件写入
│   └── edit-tool.ts      精确字符串文件编辑
├── skill/
│   ├── skill.ts          技能接口 + 注册表（切换、列出、提示词聚合）
│   └── builtin/
│       ├── code-reviewer.ts
│       ├── test-writer.ts
│       ├── git-committer.ts
│       └── doc-writer.ts
└── cli/
    ├── repl.ts           Readline REPL，含斜杠命令和 Tab 补全
    ├── stream.ts         流式输出回调
    ├── display.ts        内容块显示辅助
    ├── markdown.ts       行缓冲终端 Markdown 渲染器
    └── session.ts        会话持久化（~/.neonity/sessions/）
```

### 数据流

```
用户输入 → REPL → Agent.run() → Router.selectTier() → Provider.chat() → LLM API
                         ↑              ↑                        ↓
                         |     Tool.execute() ←── tool_use 响应
                         |         ↓
                         +─── tool_result ←──────────────┘
```

### 路由器内部机制

```
chat(messages) → Strategy.selectTier(messages) → 选择最佳层级
                   ↓
           熔断器检查 → 跳过已开路的服务商
                   ↓
           层内轮询选择
                   ↓
           Provider.chat() → 成功？→ 记录延迟+用量 → 返回结果
                   ↓ 失败
           指数退避 → 尝试层内下一个服务商
                   ↓ 全部失败
           跨层回退 → 降级到下一层级
                   ↓ 所有层级耗尽
           抛出错误，包含所有失败详情
```

### 服务商抽象

所有服务商实现统一的 `Provider` 接口，接受标准化的 `Message[]` 数组和可选的流式回调。每个适配器将内部的 `ContentBlock` 格式与各服务商的原生 API 格式相互转换。

`ProviderRouter` 也实现了 `Provider` 接口，使其可以作为单一服务商的直接替代 — 智能体无需知道它是在与一个模型通信，还是与一个路由池通信。

### 技能架构

技能是纯粹的系统提示词扩展。当技能被激活时，其 `systemPrompt` 会被以 `## Active Skill` 标题追加到智能体的主提示词之后。技能可以选择性地通过注册表提供额外的 `Tool` 实例。活跃技能状态被持久化到 `~/.neonity/skills.json`。

## 斜杠命令

| 命令                 | 操作                               |
|---------------------|-----------------------------------|
| `/help`             | 显示帮助                           |
| `/exit`、`/quit`    | 退出 neonity                      |
| `/clear`            | 清除对话历史                        |
| `/save <name>`      | 保存当前会话                        |
| `/load <name>`      | 加载已保存的会话                    |
| `/sessions`         | 列出已保存的会话                    |
| `/delsession <n>`   | 删除一个会话                        |
| `/skills`           | 列出所有技能及其状态                 |
| `/skill <name>`     | 切换一个技能的开关状态               |
| `/router`           | 显示路由器状态（策略、熔断器、延迟、用量） |
| `/router-reset [n]` | 重置熔断器（全部或指定服务商标签）     |
| `/cost`             | 显示累计 Token 使用量和预估费用      |

## 配置（`.env`）

### 单服务商模式

| 变量                   | 描述                   | 默认值                  |
|------------------------|------------------------|------------------------|
| `DEFAULT_PROVIDER`     | 首选服务商              | `deepseek`             |
| `ANTHROPIC_API_KEY`    | Anthropic API 密钥      | —                      |
| `OPENAI_API_KEY`       | OpenAI API 密钥         | —                      |
| `GEMINI_API_KEY`       | Google Gemini API 密钥   | —                      |
| `DEEPSEEK_API_KEY`     | DeepSeek API 密钥       | —                      |
| `DEEPSEEK_BASE_URL`    | DeepSeek 基础 URL 覆盖   | `https://api.deepseek.com` |

### 路由模式（`ROUTER_MODE=true`）

| 变量                         | 描述                       | 默认值   |
|------------------------------|----------------------------|---------|
| `ROUTER_MODE`                | 启用智能路由                 | `false` |
| `ROUTER_VERBOSE`             | 将路由决策输出到 stderr       | `false` |
| `ROUTER_TRACK_LATENCY`       | 记录每个服务商的响应时间       | `false` |
| `ROUTER_TRACK_BUDGET`        | 追踪累计 Token 使用量和费用   | `false` |
| `CHEAP_PROVIDER`             | cheap 层级的服务商           | —       |
| `CHEAP_MODEL`                | cheap 层级的模型             | 自动    |
| `CHEAP_LABEL`                | cheap 服务商的自定义标签      | 自动    |
| `STANDARD_PROVIDER`          | standard 层级的服务商        | —       |
| `STANDARD_MODEL`             | standard 层级的模型          | 自动    |
| `PREMIUM_PROVIDER`           | premium 层级的服务商         | —       |
| `PREMIUM_MODEL`              | premium 层级的模型           | 自动    |

### 策略调优（全部可选，路由模式）

| 变量                            | 描述                              | 默认值   |
|---------------------------------|-----------------------------------|---------|
| `ROUTER_COMPLEXITY_THRESHOLD`   | 触发 premium 的关键词复杂度评分（0–1） | `0.5`   |
| `ROUTER_COMPLEX_THRESHOLD`      | 触发 premium 的总字符数阈值          | `3000`  |
| `ROUTER_TURN_THRESHOLD`         | 触发 premium 的消息数量阈值          | `5`     |
| `ROUTER_CHEAP_CHAR_LIMIT`       | 触发 cheap 快捷路由的最大字符数       | `500`   |
| `ROUTER_CIRCUIT_THRESHOLD`      | 熔断器断开前的连续失败次数            | `3`     |
| `ROUTER_CIRCUIT_COOLDOWN`       | 熔断器冷却时间（毫秒）               | `30000` |

### 全局设置

| 变量                 | 描述                       | 默认值               |
|----------------------|----------------------------|----------------------|
| `MAX_TOKENS`         | 每次对话最大输出 Token 数    | `4096`              |
| `MAX_ITERATIONS`     | REACT 循环最大迭代次数       | `50`                |
| `TEMPERATURE`        | LLM 温度参数                | （服务商默认）         |
| `WORKING_DIRECTORY`  | 工作目录覆盖                 | `process.cwd()`     |

## 许可证

MIT
