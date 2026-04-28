# neonity

[English](README.md)

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

- **多服务商支持** — Anthropic Claude、OpenAI GPT、Google Gemini、DeepSeek、MiniMax、GLM（智谱）。自动根据可用的 API 密钥检测启用的服务商。
- **运行时模型切换** — 通过 `/model`（交互式箭头菜单）或 `/model <id>`（直接切换）即时切换服务商和模型，无需重启。
- **智能路由** — 多服务商智能路由，包含成本分层、关键词复杂度分析、熔断器、指数退避和 Token 用量追踪。
- **REACT 智能体循环** — 标准工具调用循环：LLM 推理、调用工具、观察结果、再次推理。
- **流式输出** — 终端内 Markdown 渲染，支持语法高亮代码块、粗体、斜体、删除线、列表、引用块、标题等。
- **技能系统** — 运行时可按需启用的能力模块，增强智能体的系统提示词。使用 `/skill <name>` 切换开关。状态跨会话保持。
- **会话管理** — 使用 `/save`、`/load`、`/sessions`、`/delsession` 保存、加载、列出和删除命名会话。
- **长期记忆** — 跨会话持久化项目知识、用户偏好和技术方案。
- **Tab 补全** — 斜杠命令（`/`）和文件路径补全（在输入中包含 `/` 或 `~` 时触发）。
- **上下文窗口管理** — 自动处理超长对话，支持截断和摘要两种策略。
- **Web 搜索** — 可选的网络搜索工具，支持 SerpAPI、Tavily、Exa、DuckDuckGo 等多个搜索服务商。

## 支持的服务商

| 服务商      | 环境变量              | 默认模型                    |
|-----------|----------------------|----------------------------|
| Anthropic | `ANTHROPIC_API_KEY`  | `claude-sonnet-4-20250514` |
| OpenAI    | `OPENAI_API_KEY`     | `gpt-4.1`                  |
| Gemini    | `GEMINI_API_KEY`     | `gemini-2.5-flash`         |
| DeepSeek  | `DEEPSEEK_API_KEY`   | `deepseek-v4-pro`          |
| MiniMax   | `MINIMAX_API_KEY`    | `MiniMax-M2.7`             |
| GLM（智谱）| `GLM_API_KEY`        | `GLM-5.1`                  |

**配置提示：**

- 在 `.env` 中设置 `DEFAULT_PROVIDER` 选择首选服务商。如果该服务商没有可用密钥，neonity 会回退到下一个可用的服务商。
- 通过 `ANTHROPIC_MODEL`、`OPENAI_MODEL`、`GEMINI_MODEL`、`DEEPSEEK_MODEL`、`MINIMAX_MODEL` 或 `GLM_MODEL` 覆盖默认模型。
- 运行时使用 `/model`（交互式）或 `/provider <name> [model]`（直接）切换服务商和模型。

## 智能路由

在 `.env` 中设置 `ROUTER_MODE=true` 启用路由模式。路由器将查询按成本分层分发到多个服务商：

### 分层

| 层级       | 用途               | 典型场景                       |
|-----------|--------------------|-------------------------------|
| `cheap`    | 简单、低风险查询     | 快速查询、单文件读取、简短问题   |
| `standard` | 日常编码任务        | 中等复杂度，大多数查询的默认层级  |
| `premium`  | 复杂、高风险任务     | 重构、深度调试、安全审计、架构设计 |

### 弹性特性

- **熔断器** — 连续失败后暂时禁用故障服务商，支持半开状态自动恢复。
- **指数退避** — 重试延迟递增（1s 起步，30s 上限）并添加随机抖动。
- **跨层回退** — 某层级耗尽时自动降级到下一层级（cheap → standard → premium）。
- **实时监控** — 使用 `/router`、`/router-reset` 和 `/cost` 查看状态和费用。

### 路由配置

| 变量                            | 描述                              | 默认值   |
|---------------------------------|-----------------------------------|---------|
| `CHEAP_PROVIDER` / `CHEAP_MODEL` | cheap 层级的服务商和模型            | —       |
| `STANDARD_PROVIDER` / `STANDARD_MODEL` | standard 层级的服务商和模型   | —       |
| `PREMIUM_PROVIDER` / `PREMIUM_MODEL` | premium 层级的服务商和模型   | —       |
| `ROUTER_COMPLEXITY_THRESHOLD`   | 触发 premium 的关键词复杂度评分（0–1） | `0.5`   |
| `ROUTER_CIRCUIT_THRESHOLD`      | 熔断器断开前的连续失败次数            | `3`     |
| `ROUTER_CIRCUIT_COOLDOWN`       | 熔断器冷却时间（毫秒）               | `30000` |
| `ROUTER_TRACK_LATENCY`          | 记录每个服务商的响应时间              | `false` |
| `ROUTER_TRACK_BUDGET`           | 追踪累计 Token 使用量和费用          | `false` |

## 上下文窗口管理

随着对话增长，可能超出 LLM 的上下文窗口限制。neonity 自动检测并应用可配置的策略：

| 策略            | 描述                                                         |
|----------------|-------------------------------------------------------------|
| `truncation`   | **（默认）** 丢弃最早的消息组，保留最近的上下文。                    |
| `summarization` | 将较早的对话段摘要为紧凑形式。失败时回退到截断策略。                |

| 变量                       | 描述                                | 默认值       |
|----------------------------|-------------------------------------|-------------|
| `CONTEXT_STRATEGY`         | 管理策略：`truncation` 或 `summarization` | `truncation` |
| `CONTEXT_RESERVE_RATIO`    | 为输出 Token 预留的上下文窗口比例       | `0.25`      |
| `CONTEXT_PRESERVE_GROUPS`  | 截断时始终保留的最近消息组数量          | `4`         |
| `CONTEXT_WINDOW_SIZE`      | 覆盖自动检测的上下文窗口大小（Token 数） | 自动        |

## 内置工具

| 工具          | 描述                                              |
|--------------|--------------------------------------------------|
| `bash`       | 执行 Shell 命令，30 秒超时                          |
| `read`       | 读取文件内容                                        |
| `write`      | 创建或覆盖文件（自动创建父目录）                      |
| `edit`       | 在文件中进行精确字符串替换                            |
| `memory`     | 存储和检索跨会话的长期记忆                            |
| `web-search` | 通过可配置的搜索服务商（SerpAPI、Tavily、Exa、DuckDuckGo）搜索网络 |

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
| `git-pusher`      | 自动化 git push 工作流                        |
| `doc-writer`      | 生成 API 文档、README 文件和内联注释           |
| `hn-top`          | 获取并展示 Hacker News 热门文章               |

## 斜杠命令

| 命令                     | 操作                                     |
|-------------------------|-----------------------------------------|
| `/help`                 | 显示帮助                                 |
| `/exit`、`/quit`        | 退出 neonity                             |
| `/clear`                | 清除对话历史                              |
| `/model`                | 交互式选择服务商和模型（方向键 + 回车）        |
| `/model list`           | 列出当前服务商的可用模型                    |
| `/model <id>`           | 直接切换到指定模型                         |
| `/provider`             | 交互式选择服务商（同 `/model`）             |
| `/provider <name> [模型]`| 直接切换服务商（如 `/provider glm GLM-4.7`） |
| `/skills`               | 列出所有技能及其状态                       |
| `/skill <name>`         | 切换一个技能的开关状态                      |
| `/memory`               | 列出、搜索和管理持久化记忆                   |
| `/router`               | 显示路由器状态、熔断器和延迟统计              |
| `/router-reset [服务商]` | 重置熔断器                                |
| `/cost`                 | 显示累计 Token 使用量和预估费用              |
| `/context`              | 显示上下文窗口使用情况                      |
| `/save <name>`          | 保存当前会话                              |
| `/load <name>`          | 加载已保存的会话                           |
| `/sessions`             | 列出已保存的会话                           |
| `/delsession <name>`    | 删除一个会话                              |

## 架构

```
src/
├── index.ts              入口
├── config.ts             环境变量驱动的配置（单服务商 + 路由模式）
├── types.ts              核心类型（ContentBlock、Provider、Tool 等）
├── agent/
│   ├── agent.ts          REACT 智能体循环 + 工具调度
│   ├── system-prompt.ts  动态系统提示词构建
│   └── context-manager.ts 上下文窗口管理
├── memory/
│   ├── memory.ts         长期记忆系统
│   └── memory-tool.ts   智能体使用的记忆工具
├── provider/
│   ├── factory.ts        服务商工厂 + 路由器构建
│   ├── router.ts         智能路由：分层、熔断器、监控
│   ├── anthropic.ts      Anthropic Messages API 适配器
│   ├── openai-provider.ts OpenAI Chat Completions 适配器
│   ├── gemini.ts         Google Gemini 适配器
│   ├── deepseek-provider.ts DeepSeek 原生 API 适配器（含 reasoning_content）
│   ├── minimax.ts        MiniMax API 适配器
│   └── glm-provider.ts   GLM（智谱）API 适配器
├── tool/
│   ├── tool.ts           工具注册表
│   ├── bash-tool.ts      Shell 命令执行
│   ├── read-tool.ts      文件读取
│   ├── write-tool.ts     文件写入
│   ├── edit-tool.ts      精确字符串编辑
│   ├── web-search-tool.ts 网络搜索（SerpAPI、Tavily、Exa、DuckDuckGo）
│   └── hn-tool.ts        Hacker News 工具
├── skill/
│   ├── skill.ts          技能接口 + 注册表
│   └── builtin/          内置技能
└── cli/
    ├── repl.ts           Readline REPL、斜杠命令、交互式菜单
    ├── stream.ts         流式输出回调
    ├── markdown.ts       终端 Markdown 渲染器
    └── session.ts        会话持久化
```

### 数据流

1. **用户输入** → REPL → Agent.run()
2. **ContextManager** 估算 Token 数，超限时应用截断或摘要
3. **Router**（若启用）选择最优层级 → Provider.chat()
4. **Provider** 与 LLM API 通信 → 返回响应
5. 如果响应包含 `tool_use` → Tool.execute() → 结果反馈给智能体
6. 循环继续直到 `end_turn` 或达到最大迭代次数

## 许可证

MIT
