# NEONITY.md

> AI Agent Harness 的项目指南，让模型能够全面理解 neonity 项目。

## 项目概述

**neonity** 是一个 mini Claude Code agent harness，用于在终端中与多个 LLM 提供商交互。它是一个 TypeScript 编写的命令行工具，让用户能够在 REPL 环境中与 AI 对话、执行代码操作、管理会话和记忆。

**关键词**：multi-provider, smart-router, REACT-agent, tool-calling, streaming-output

---

## 技术栈

| 类别 | 技术 |
|------|------|
| 运行时 | Node.js ≥ 20 |
| 语言 | TypeScript |
| 包管理 | pnpm |
| LLM SDK | @anthropic-ai/sdk, openai, @google/genai |

### 核心依赖

```json
{
  "@anthropic-ai/sdk": "^0.91.0",
  "@google/genai": "^1.50.0",
  "openai": "^6.34.0",
  "chalk": "^5.6.0",
  "dotenv": "^17.4.0"
}
```

---

## 目录结构

```
neonity/
├── src/
│   ├── index.ts              # 入口点：协调各核心组件
│   ├── config.ts             # 环境变量配置管理
│   ├── types.ts              # 核心数据结构定义
│   │
│   ├── agent/                # Agent 实现
│   │   ├── agent.ts          # REACT Agent 循环，工具编排
│   │   ├── system-prompt.ts  # 动态构建系统提示词
│   │   └── context-manager.ts # 上下文窗口管理（truncation/summarization）
│   │
│   ├── provider/              # LLM Provider 适配器
│   │   ├── provider.ts       # Provider 接口定义
│   │   ├── factory.ts        # Provider 实例化和 Router 构造
│   │   ├── router.ts         # Smart Router：分层、熔断、监控
│   │   ├── anthropic.ts      # Anthropic Messages API 适配器
│   │   ├── openai-provider.ts # OpenAI Chat Completions API 适配器
│   │   ├── deepseek-provider.ts # DeepSeek 原生 API 适配器
│   │   ├── gemini.ts          # Google Gemini API 适配器
│   │   └── minimax.ts         # Minimax API 适配器
│   │
│   ├── tool/                  # 内置工具
│   │   ├── tool.ts           # Tool 注册表和基类接口
│   │   ├── bash-tool.ts      # 执行 shell 命令（30秒超时）
│   │   ├── read-tool.ts      # 读取文件内容
│   │   ├── write-tool.ts     # 写入文件（自动创建目录）
│   │   └── edit-tool.ts      # 精确字符串替换
│   │
│   ├── memory/                # 记忆系统
│   │   ├── memory.ts         # 长期记忆持久化（markdown）
│   │   └── memory-tool.ts    # Agent 使用的 memory 工具
│   │
│   ├── skill/                 # Skill 模块
│   │   ├── skill.ts          # Skill 接口、注册表、提示词聚合
│   │   └── builtin/          # 内置 Skills
│   │       ├── code-reviewer.ts
│   │       ├── test-writer.ts
│   │       ├── git-committer.ts
│   │       ├── doc-writer.ts
│   │       └── hn-top.ts
│   │
│   └── cli/                   # 命令行界面
│       ├── repl.ts           # Readline REPL、斜杠命令、Tab 补全
│       ├── stream.ts         # 流式输出处理
│       ├── display.ts        # 终端内容块显示
│       ├── markdown.ts       # 行缓冲 Markdown 渲染器
│       └── session.ts        # 会话持久化
│
├── .env.example               # 配置模板
├── tsconfig.json
└── package.json
```

---

## 核心概念

### 1. Provider（提供者）

Provider 是 LLM API 的抽象层，统一了不同供应商的接口：

```typescript
interface Provider {
  readonly name: string;
  chat(
    messages: Message[],
    tools: ToolDefinition[],
    callbacks?: StreamCallbacks,
    systemPrompt?: string
  ): Promise<ProviderResponse>;
}
```

**支持的 Providers**：

| Provider | 模型默认值 | API Key 环境变量 |
|----------|-----------|------------------|
| anthropic | claude-sonnet-4-20250514 | ANTHROPIC_API_KEY |
| openai | gpt-4.1 | OPENAI_API_KEY |
| gemini | gemini-2.5-flash | GEMINI_API_KEY |
| deepseek | deepseek-v4-pro | DEEPSEEK_API_KEY |
| minimax | MiniMax-M2.7 | MINIMAX_API_KEY |

### 2. Smart Router（智能路由器）

当 `ROUTER_MODE=true` 时启用，将请求按复杂度分配到不同成本层级：

| 层级 | 用途 | 触发条件 |
|------|------|----------|
| `cheap` | 简单查询 | 短文本、无工具调用历史 |
| `standard` | 日常编码任务 | 默认层级 |
| `premium` | 复杂任务 | 包含 refactor/debug/security 等关键词，或多轮对话 |

**路由策略**：
- 关键词复杂度分析
- 会话轮次计数自动升级
- 熔断器：连续失败 3 次后禁用 30 秒
- 指数退避重试
- 跨层级降级 fallback

### 3. REACT Agent Loop

Agent 执行一个推理-行动-观察循环：

```
User Input → Reasoning → Tool Use → Observation → Reasoning → ...
```

- 最大迭代次数由 `MAX_ITERATIONS` 控制（默认 50）
- 每次迭代可能调用工具或生成最终响应

### 4. Tool（工具）

Agent 可调用的内置工具：

| 工具 | 功能 | 关键参数 |
|------|------|----------|
| `bash` | 执行 shell 命令 | `command`（30秒超时） |
| `read` | 读取文件 | `file_path` |
| `write` | 写入文件 | `file_path`, `content` |
| `edit` | 字符串替换 | `file_path`, `old_string`, `new_string` |
| `memory` | 长期记忆 | `action`, `content`, `category` |

### 5. Skill（技能）

运行时可切换的能力模块，通过 `/skill <name>` 激活：

| Skill | 功能 |
|-------|------|
| `code-reviewer` | 系统性代码审查 |
| `test-writer` | 生成单元/集成测试 |
| `git-committer` | 语义化提交信息 |
| `doc-writer` | 技术文档生成 |

Skills 的状态持久化到 `~/.neonity/skills.json`。

### 6. Context Management（上下文管理）

当对话超过 LLM 上下文窗口时：

| 策略 | 行为 |
|------|------|
| `truncation`（默认） | 丢弃最旧的消息组 |
| `summarization` | 将旧消息压缩为摘要 |

---

## 数据结构

### Message

```typescript
interface Message {
  role: "user" | "assistant";
  content: ContentBlock[];
}

type ContentBlock = 
  | TextContent      // { type: "text", text: string }
  | ToolUseContent    // { type: "tool_use", id, name, input }
  | ToolResultContent // { type: "tool_result", tool_use_id, content, is_error? }
  | ReasoningContent // { type: "reasoning", text: string }
```

### ProviderResponse

```typescript
interface ProviderResponse {
  stopReason: "end_turn" | "tool_use" | "max_tokens" | "error";
  content: ContentBlock[];
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}
```

---

## 配置参考

详见 `.env.example`，关键配置项：

### 模式选择
```bash
ROUTER_MODE=false          # true 启用 Smart Router
DEFAULT_PROVIDER=deepseek   # 单 Provider 模式下的默认提供商
```

### API Keys
```bash
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
GEMINI_API_KEY=
DEEPSEEK_API_KEY=
MINIMAX_API_KEY=
```

### Router 调优
```bash
ROUTER_VERBOSE=true         # 打印路由决策日志
ROUTER_TRACK_LATENCY=true   # 记录响应时间
ROUTER_TRACK_BUDGET=true    # 追踪 token 消耗
ROUTER_CIRCUIT_THRESHOLD=3  # 熔断阈值
ROUTER_CIRCUIT_COOLDOWN=30000 # 熔断冷却时间（ms）
```

### 上下文管理
```bash
CONTEXT_STRATEGY=truncation       # truncation 或 summarization
CONTEXT_RESERVE_RATIO=0.25        # 保留给输出的窗口比例
CONTEXT_PRESERVE_GROUPS=4         # 始终保留的最近消息组数
```

---

## 开发命令

```bash
# 安装依赖
pnpm install

# 构建
pnpm build          # TypeScript 编译到 dist/
pnpm dev            # 监视模式编译

# 运行
pnpm start          # 运行编译后的代码
pnpm start:dev      # 直接运行源码（tsx）

# 测试
pnpm test           # 运行所有测试
```

---

## 斜杠命令

在 REPL 中使用：

| 命令 | 功能 |
|------|------|
| `/help` | 显示帮助 |
| `/exit`, `/quit` | 退出程序 |
| `/clear` | 清空对话历史 |
| `/save <name>` | 保存当前会话 |
| `/load <name>` | 加载会话 |
| `/sessions` | 列出已保存的会话 |
| `/delsession <name>` | 删除会话 |
| `/skills` | 列出所有 Skills 及状态 |
| `/skill <name>` | 切换 Skill 激活状态 |
| `/router` | 显示 Router 状态 |
| `/router-reset [provider]` | 重置熔断器 |
| `/cost` | 显示 Token 消耗和预估费用 |

---

## 约定俗成

### 1. 文件命名
- TypeScript 源文件：`*.ts`
- 测试文件：`*.test.ts`（位于 `__tests__` 目录或同目录）
- 配置文件：小写 + 连字符（如 `tsconfig.json`）

### 2. 模块导出
- 使用命名导出（named exports）
- 入口文件（`index.ts`）统一导出子模块
- Provider 适配器实现统一的 `Provider` 接口

### 3. 错误处理
- 工具执行错误返回格式化的错误信息字符串
- Provider 错误由 Router 处理（重试、降级、熔断）

### 4. 类型定义
- 核心类型定义在 `src/types.ts`
- Provider 接口在 `src/provider/provider.ts`
- Tool 接口在 `src/tool/tool.ts`

### 5. 日志与调试
- Router 详细日志通过 `ROUTER_VERBOSE=true` 启用
- 编译产物在 `dist/` 目录
- 会话数据在 `.neonity/` 目录

---

## 快速参考

### 创建新的 Provider 适配器

1. 创建 `src/provider/<name>.ts`
2. 实现 `Provider` 接口
3. 在 `factory.ts` 中注册
4. 添加对应的 API Key 环境变量支持

### 创建新的 Tool

1. 创建 `src/tool/<name>-tool.ts`
2. 实现 `Tool` 接口
3. 在 `src/index.ts` 中注册到 ToolRegistry

### 创建新的 Skill

1. 创建 `src/skill/builtin/<name>.ts`
2. 实现 Skill 接口（提供 `systemPrompt`）
3. 在 `skill.ts` 中注册

---

## 相关文件

- [README.md](./README.md) - 项目主页和详细文档
- [README.zh-CN.md](./README.zh-CN.md) - 中文文档
- [src/index.ts](./src/index.ts) - 入口点源码
- [src/types.ts](./src/types.ts) - 核心类型定义
