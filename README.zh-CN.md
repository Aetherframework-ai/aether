# Aether

**用于构建弹性、可观测和可扩展分布式系统的工作流引擎。**

Aether 提供了从单文件脚本到分布式编排的平滑升级路径。简单开始，无缝扩展。

## 什么是 Aether？

Aether 是一个工作流引擎，帮助您：
- **构建弹性工作流** — 自动状态持久化和恢复
- **从开发扩展到生产** — 单节点到分布式无需修改代码
- **监控一切** — 实时查看工作流执行情况
- **轻松调试** — 完整的每步审计追踪

**核心特性：**
- 渐进式复杂度（L0 → L1 → L2 持久化层级）
- 类型安全的 SDK，一流 TypeScript 支持
- 内置指标和监控仪表板
- 基于 gRPC 的架构，支持多语言环境

## 快速开始

### 1. 启动服务器

```bash
# 使用默认设置启动 Aether 服务器
aether serve

# 或使用自定义选项
aether serve --grpc-port 7233 --http-port 7234 --persistence snapshot
```

### 2. 创建你的第一个工作流

```typescript
import { aether } from '@aetherframework.ai/sdk';

const client = aether({ serverUrl: 'http://localhost:7233' });

// 定义工作流
const helloWorld = client.workflow('hello-world', async (ctx, name: string) => {
  const greeting = await ctx.step('create-greeting', async () => {
    return `Hello, ${name}!`;
  });

  await ctx.step('log-greeting', async () => {
    console.log(greeting);
  });

  return { message: greeting };
});

// 运行它
const result = await helloWorld.startAndWait('World');
console.log(result.message); // "Hello, World!"
```

### 3. 在仪表板中查看

在浏览器中打开 http://localhost:7234 查看实时工作流监控。

**就是这样！** 您已经构建并执行了第一个工作流。

**下一步：**
- 在 `examples/` 中探索更多示例
- 了解[核心概念](#核心概念)
- 阅读 [API 参考](#api-参考)

## 安装

### 前置条件

- **Rust** 1.70+（用于构建核心引擎和 CLI）
- **Node.js** 18+（用于 TypeScript SDK 和仪表板）
- **Protocol Buffers** 编译器（可选，用于重新生成 .proto 文件）

### 安装 CLI 和服务器

```bash
# 克隆仓库
git clone https://github.com/your-org/aether.git
cd aether

# 构建并安装
cargo install --path cli --locked

# 验证安装
aether --help
```

### 安装 TypeScript SDK

```bash
npm install @aetherframework.ai/sdk
# 或
yarn add @aetherframework.ai/sdk
# 或
pnpm add @aetherframework.ai/sdk
```

### 从源码构建

```bash
# 构建所有组件
./scripts/build.sh

# 或单独构建
cargo build --release -p aether       # 服务器
cargo build --release -p aether-cli   # CLI
cd sdks/typescript && npm run build   # SDK
cd dashboard && npm run build         # 仪表板
```

**构建输出：**
- 服务器: `target/release/aether`
- CLI: `target/release/aether-cli`
- SDK: `sdks/typescript/dist/`
- 仪表板: `dashboard/dist/`

## 核心概念

### 工作流

**工作流**是一个可恢复的过程，执行一系列步骤。将其视为可以暂停、恢复和从故障中恢复的函数。

```typescript
const orderProcessing = client.workflow('order-processing', async (ctx, orderId: string) => {
  const order = await ctx.step('fetch-order', async () => {
    return db.orders.find(orderId);
  });

  const payment = await ctx.step('process-payment', async () => {
    return paymentGateway.charge(order);
  });

  await ctx.step('ship-order', async () => {
    return shipping.ship(payment.confirmation);
  });

  return { orderId, status: 'completed' };
});
```

### 步骤

**步骤**是工作流中的单个工作单元。每个步骤：
- 原子性执行
- 可以返回供后续步骤使用的结果
- 自动持久化以便恢复

```typescript
const result = await ctx.step('my-step', async () => {
  // 您的业务逻辑
  return { data: 'result' };
});
```

### 活动（可选）

**活动**是具有内置弹性功能的步骤：
- 自动重试，指数退避
- 可配置超时
- 支持长时间运行任务的心跳

### 持久化层级

Aether 支持三种持久化级别以适应不同场景：

| 层级 | 模式 | 使用场景 |
|------|------|----------|
| **L0** | 仅内存 | 开发、调试、短时任务 |
| **L1** | 快照 | 定期状态保存的短时工作流 |
| **L2** | 状态+操作日志 | 完整审计追踪的长时工作流 |

```bash
# 选择持久化模式
aether serve --persistence memory         # L0: 快速，无持久化
aether serve --persistence snapshot       # L1: 平衡
aether serve --persistence state-action-log  # L2: 完全持久化
```

### 状态机

每个工作流都遵循此状态机：

```
     +---------+     +---------+     +-----------+
     | PENDING | --> | RUNNING | --> | COMPLETED |
     +---------+     +---------+     +-----------+
                           |
                           |--> +---------+
                           |    | FAILED  |
                           |    +---------+
                           |
                           |--> +-----------+
                           |    | CANCELLED |
                           |    +-----------+
```

**状态说明：**
- `PENDING`: 工作流已创建，等待启动
- `RUNNING`: 正在积极执行步骤
- `COMPLETED`: 所有步骤成功完成
- `FAILED`: 发生错误，不会再执行更多步骤
- `CANCELLED`: 在完成前被手动停止

## API 参考

### TypeScript SDK

#### AetherClient

```typescript
import { aether } from '@aetherframework.ai/sdk';

const client = aether({
  serverUrl: 'http://localhost:7233',
  workerId?: string,  // 可选：工作节点标识符
});
```

**方法：**

| 方法 | 说明 |
|------|------|
| `client.workflow(name, fn)` | 定义新工作流 |
| `client.serve(workflows)` | 注册工作流并启动服务器 |

#### WorkflowDefinition

```typescript
const myWorkflow = client.workflow('my-workflow', async (ctx, input: InputType) => {
  // 工作流实现
  return output;
});
```

**方法：**

| 方法 | 说明 |
|------|------|
| `workflow.start(...args)` | 启动工作流，返回 `workflowId`（非阻塞） |
| `workflow.startAndWait(...args)` | 启动并等待完成，返回结果（阻塞） |

#### WorkflowContext

```typescript
interface WorkflowContext {
  // 执行单个步骤
  step: <T>(name: string, fn: () => Promise<T>) => Promise<T>;

  // 并行执行步骤
  parallel: <T>(steps: (() => Promise<T>)[]) => Promise<T[]>;

  // 暂停执行
  sleep: (duration: { minutes?: number; hours?: number; seconds?: number }) => Promise<void>;

  // 执行子工作流
  child: <T>(workflow: Workflow<T>, args: any[]) => Promise<T>;
}
```

### gRPC API

#### ClientService

| 方法 | 请求 | 响应 | 说明 |
|------|------|------|------|
| `StartWorkflow` | `StartWorkflowRequest` | `StartWorkflowResponse` | 启动新工作流 |
| `GetWorkflowStatus` | `GetStatusRequest` | `WorkflowStatus` | 获取工作流状态 |
| `AwaitResult` | `AwaitResultRequest` | `WorkflowResult` | 等待工作流完成 |
| `CancelWorkflow` | `CancelRequest` | `CancelResponse` | 取消运行中的工作流 |

#### WorkerService

| 方法 | 请求 | 响应 | 说明 |
|------|------|------|------|
| `Register` | `RegisterRequest` | `RegisterResponse` | 注册工作节点 |
| `PollTasks` | `PollRequest` | `stream Task` | 轮询待处理任务 |
| `CompleteStep` | `CompleteStepRequest` | `CompleteStepResponse` | 完成步骤 |
| `Heartbeat` | `HeartbeatRequest` | `HeartbeatResponse` | 发送心跳 |

#### AdminService

| 方法 | 请求 | 响应 | 说明 |
|------|------|------|------|
| `ListWorkflows` | `ListRequest` | `stream WorkflowInfo` | 列出所有工作流 |
| `GetMetrics` | `GetMetricsRequest` | `Metrics` | 获取系统指标 |

### CLI 命令

```bash
# 启动 Aether 服务器
aether serve [OPTIONS]

选项：
  --db <PATH>           数据库路径（默认：./data/aether.db）
  --grpc-port <PORT>    gRPC 端口（默认：7233）
  --http-port <PORT>    HTTP 端口（默认：7234）
  --persistence <MODE>  持久化模式：memory, snapshot, state-action-log

# 初始化新项目
aether init <NAME> [OPTIONS]

选项：
  --output <PATH>       输出目录

# 管理工作流
aether workflow list [--type <TYPE>] [--state <STATE>]

# 检查工作流状态
aether status <WORKFLOW_ID>

# 取消工作流
aether cancel <WORKFLOW_ID>
```

### 配置文件

创建 `aether.toml` 来配置服务器：

```toml
[server]
grpc_port = 7233
http_port = 7234
db_path = "./data/aether.db"

[persistence]
mode = "state-action-log"

[metrics]
enabled = true
port = 9090
```

## 架构

### 系统概览

```
+-----------------------------------------------------------------+
|                        Aether 架构                                |
+-----------------------------------------------------------------+
|                                                                   |
|  +-------------+    +-------------+    +-------------+          |
|  |   客户端    |    |   客户端    |    |   客户端    |          |
|  | (TypeScript)|   | (TypeScript)|   | (TypeScript)|          |
|  +------+------+    +------+------+    +------+------+          |
|         |                   |                   |                 |
|         +-------------------+-------------------+                 |
|                             |                                     |
|                    +--------+--------+                           |
|                    |   gRPC 服务器   |                           |
|                    |  (Tonic/Rust)   |                           |
|                    +--------+--------+                           |
|                             |                                     |
|         +-------------------+-------------------+                |
|         |                   |                   |                 |
|  +------+------+    +-------+------+    +-------+------+          |
|  |   客户端    |    |   工作节点   |    |   工作节点   |          |
|  |   服务     |    |   服务     |    |   服务     |          |
|  +------+------+    +------+------+    +------+------+          |
|         |                   |                   |                 |
|  +------+------+    +-------+------+                   |          |
|  |   调度器    |    |    任务     |                   |          |
|  |            |    |   队列      |                   |          |
|  +------+------+    +-------------+                   |          |
|         |                                         |             |
|  +------v------+                                   |             |
|  |   持久化    |                                   |             |
|  |   层级     |                                   |             |
|  | L0/L1/L2   |                                   |             |
|  +-------------+                                   |             |
|                             |                      |             |
|         +-------------------+----------------------+             |
|         |                                              |          |
|  +------v------+         +-------+------+         +---v------+    |
|  |   SQLite    |         | PostgreSQL |         |   自定义  |    |
|  |  （默认）   |         |（生产环境）|         |   存储   |    |
|  +-------------+         +-------------+         +----------+    |
|                                                                   |
+-----------------------------------------------------------------+
```

### 组件

#### 核心内核 (Rust)

Aether 的核心，使用 Rust 编写以获得性能和安全性。

- **状态机** —管理工作流生命周期（Pending → Running → Completed/Failed/Cancelled）
- **调度器** —根据容量和亲和性将任务分配给工作节点
- **持久化层级** —三层存储系统（L0/L1/L2）

#### gRPC 服务

- **ClientService** — 工作流管理（启动、状态、等待、取消）
- **WorkerService** — 任务执行（注册、轮询、完成、心跳）
- **AdminService** — 监控和管理（列表、指标）

#### SDK 层

抽象 gRPC 复杂性的类型安全 SDK：

- **工作流定义** — 类型安全的工作流构建器
- **执行上下文** — 步骤、并行、睡眠、子工作流
- **服务器模式** — 用于本地开发的内置 gRPC 服务器

#### 仪表板

基于 React 的 Web 界面，用于实时监控：

- **工作流列表** — 查看所有工作流并过滤
- **工作流详情** — 深入了解执行历史
- **指标** — 系统健康和性能指标

### 数据流

```
1. 客户端定义工作流
   ↓
2. 客户端通过 gRPC 启动工作流
   ↓
3. Aether 将工作流持久化到存储
   ↓
4. 调度器将任务分配给工作节点
   ↓
5. 工作节点执行步骤，报告完成
   ↓
6. Aether 持久化步骤结果
   ↓
7. 重复步骤 4-6 直到完成
   ↓
8. 客户端收到最终结果
```

### 持久化层级详情

| 层级 | 模式 | 持久性 | 性能 | 使用场景 |
|------|------|--------|------|----------|
| **L0** | 仅内存 | 无 | 最快 | 开发、调试 |
| **L1** | 快照 | 中等 | 快 | 短时工作流 |
| **L2** | 状态+操作 | 高 | 中等 | 生产环境、需要审计 |

**L2 特性：**
- 每个步骤结果都被记录
- 完整的审计追踪
- 从任意点恢复
- 时间旅行调试（未来）

### 扩展

Aether 支持水平扩展：

1. **无状态工作节点** — 增加更多工作节点以提高吞吐量
2. **共享存储** — 所有节点共享相同的持久化层
3. **负载均衡器** — 跨节点分配 gRPC 请求

```
                    +-----------------+
                    |   负载均衡器     |
                    | (nginx/envoy)   |
                    +--------+--------+
                             |
        +--------------------+--------------------+
        |                    |                    |
   +----v----+         +----v----+         +----v----+
   | Aether  |         | Aether  |         | Aether  |
   |  节点 1  |         |  节点 2  |         |  节点 3  |
   +----+----+         +----+----+         +----+----+
        |                   |                   |
        +-------------------+-------------------+
                            |
                    +-------v-------+
                    |    共享存储     |
                    | (PostgreSQL)   |
                    +---------------+
```

## 示例

### 快速开始

演示工作流基础的最简示例。

**位置：** `examples/quickstart/`

```typescript
import { aether } from '@aetherframework.ai/sdk';

const client = aether({ serverUrl: 'http://localhost:7233' });

// 定义简单工作流
const greet = client.workflow('greet', async (ctx, name: string) => {
  const greeting = await ctx.step('create-message', async () => {
    return `Hello, ${name}!`;
  });

  await ctx.step('log', async () => {
    console.log(greeting);
  });

  return { message: greeting };
});

async function main() {
  // 注册并启动服务
  await client.serve([greet]);

  // 运行工作流
  const result = await greet.startAndWait('World');
  console.log(result.message); // "Hello, World!"
}

main();
```

**运行：**
```bash
cd examples/quickstart
npm install
npm run dev
```

### 订单处理

包含库存、支付和物流的真实电子商务工作流。

**位置：** `examples/order-processing/`

```typescript
import { aether } from '@aetherframework.ai/sdk';

const client = aether({ serverUrl: 'http://localhost:7233' });

const orderProcessing = client.workflow('order-processing', async (ctx, orderId: string) => {
  // 步骤 1：检查库存
  const inventory = await ctx.step('check-inventory', async () => {
    return { available: true, items: 10 };
  });

  if (!inventory.available) {
    throw new Error('Inventory not available');
  }

  // 步骤 2：预留库存
  await ctx.step('reserve-inventory', async () => {
    return { reserved: true };
  });

  // 步骤 3：处理支付
  const payment = await ctx.step('process-payment', async () => {
    return { transactionId: `tx-${Date.now()}`, status: 'completed' };
  });

  // 步骤 4：发货
  const shipping = await ctx.step('ship-order', async () => {
    return { trackingNumber: `TRK-${Date.now()}`, status: 'shipped' };
  });

  return {
    orderId,
    payment: payment.transactionId,
    tracking: shipping.trackingNumber,
    status: 'completed',
  };
});

// 自动启动服务器运行
async function main() {
  await client.serve([orderProcessing]);

  const result = await orderProcessing.startAndWait('order-123');
  console.log('Order processed:', result);
}

main();
```

**运行：**
```bash
cd examples/order-processing
npm install
npm run dev
```

### 并行执行

演示并发步骤执行。

```typescript
const batchProcess = client.workflow('batch-process', async (ctx, orders: string[]) => {
  // 并行执行多个任务
  const results = await ctx.parallel(
    orders.map(orderId => () => processOrder.startAndWait(orderId))
  );

  return {
    processed: results.length,
    results,
  };
});
```

### 更多示例

寻找更多模式？查看：

- **错误处理** — 重试策略和故障恢复
- **长时间运行任务** — 带心跳的活动
- **子工作流** — 组合工作流
- **条件逻辑** — 基于步骤结果分支

**位置：** `examples/`

## 贡献

我们欢迎贡献！在提交 PR 之前请阅读我们的贡献指南。

### 开始

1. **Fork 仓库**
   ```bash
   git fork https://github.com/your-org/aether.git
   ```

2. **克隆你的 fork**
   ```bash
   git clone https://github.com/YOUR-USERNAME/aether.git
   cd aether
   ```

3. **设置开发环境**
   ```bash
   # 安装 Rust 工具
   rustup component add rustfmt clippy

   # 安装 Node.js 工具
   cd sdks/typescript && npm install
   cd dashboard && npm install
   ```

4. **运行测试**
   ```bash
   # Rust 测试
   cargo test

   # TypeScript 测试
   cd sdks/typescript && npm test
   ```

5. **构建所有内容**
   ```bash
   ./scripts/build.sh
   ```

### 开发工作流程

1. 创建功能分支：`git checkout -b feature/your-feature`
2. 按照编码标准进行更改
3. 为您的更改添加测试
4. 运行代码检查器和格式化工具：
   ```bash
   cargo fmt      # Rust 格式化
   cargo clippy   # Rust 代码检查
   npm run format # TypeScript 格式化
   npm run lint   # TypeScript 代码检查
   ```
5. 提交 pull request

### 编码标准

**Rust：**
- 遵循 `rustfmt` 格式化
- 通过 `clippy` 且无警告
- 为公共 API 编写文档
- 为新功能添加单元测试

**TypeScript：**
- 遵循 ESLint 配置
- 使用 TypeScript 严格模式
- 为公共 API 编写 JSDoc 注释
- 为新功能添加测试

**提交信息：**
- 使用约定式提交：`feat:`、`fix:`、`docs:`、`refactor:`
- 保持提交原子化和聚焦
- 如果适用，包含 issue 编号

### 报告问题

报告问题时，请包括：
- 问题的清晰描述
- 重现步骤
- 预期行为与实际行为
- 环境详情（操作系统、Rust 版本、Node 版本）
- 错误消息和堆栈跟踪

### 文档

非常欢迎对文档的改进：
- 修复拼写和语法错误
- 添加示例和教程
- 改进解释和说明
- 翻译成其他语言

**构建文档：**
```bash
cargo doc --no-deps --open
```