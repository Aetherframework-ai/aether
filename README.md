# Aether

**A progressive workflow engine for building resilient, observable, and scalable distributed systems.**

Aether provides a smooth upgrade path from single-file scripts to distributed orchestration. Start simple, scale seamlessly.

## What is Aether?

Aether is a workflow engine that helps you:
- **Build resilient workflows** — Automatic state persistence and recovery
- **Scale from dev to production** — Zero-code changes from single-node to distributed
- **Monitor everything** — Real-time visibility into workflow execution
- **Debug easily** — Complete audit trail of every step

**Key Features:**
- Progressive complexity (L0 → L1 → L2 persistence tiers)
- Type-safe SDKs with first-class TypeScript support
- Built-in metrics and monitoring dashboard
- gRPC-based architecture for polyglot environments

## Quick Start

### 1. Start the Server

```bash
# Start Aether server with default settings
aether serve

# Or with custom options
aether serve --grpc-port 7233 --http-port 7234 --persistence snapshot
```

### 2. Create Your First Workflow

```typescript
import { aether } from '@aetherframework.ai/sdk';

const client = aether({ serverUrl: 'http://localhost:7233' });

// Define a workflow
const helloWorld = client.workflow('hello-world', async (ctx, name: string) => {
  const greeting = await ctx.step('create-greeting', async () => {
    return `Hello, ${name}!`;
  });

  await ctx.step('log-greeting', async () => {
    console.log(greeting);
  });

  return { message: greeting };
});

// Run it
const result = await helloWorld.startAndWait('World');
console.log(result.message); // "Hello, World!"
```

### 3. View in Dashboard

Open http://localhost:7234 in your browser to see real-time workflow monitoring.

**That's it!** You've built and executed your first workflow.

**Next Steps:**
- Explore more examples in `examples/`
- Learn about [Core Concepts](#core-concepts)
- Read the [API Reference](#api-reference)

## Installation

### Prerequisites

- **Rust** 1.70+ (for building the core engine and CLI)
- **Node.js** 18+ (for TypeScript SDK and dashboard)
- **Protocol Buffers** compiler (optional, for regenerating .proto files)

### Install CLI and Server

```bash
# Clone the repository
git clone https://github.com/your-org/aether.git
cd aether

# Build and install
cargo install --path cli --locked

# Verify installation
aether --help
```

### Install TypeScript SDK

```bash
npm install @aetherframework.ai/sdk
# or
yarn add @aetherframework.ai/sdk
# or
pnpm add @aetherframework.ai/sdk
```

### Build from Source

```bash
# Build all components
./scripts/build.sh

# Or build individually
cargo build --release -p aether       # Server
cargo build --release -p aether-cli   # CLI
cd sdks/typescript && npm run build   # SDK
cd dashboard && npm run build         # Dashboard
```

**Build Outputs:**
- Server: `target/release/aether`
- CLI: `target/release/aether-cli`
- SDK: `sdks/typescript/dist/`
- Dashboard: `dashboard/dist/`

## Core Concepts

### Workflow

A **workflow** is a recoverable process that executes a series of steps. Think of it as a function that can pause, resume, and recover from failures.

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

### Step

A **step** is a single unit of work within a workflow. Each step:
- Executes atomically
- Can return a result used by subsequent steps
- Is automatically persisted for recovery

```typescript
const result = await ctx.step('my-step', async () => {
  // Your business logic here
  return { data: 'result' };
});
```

### Activity (Optional)

An **activity** is a step with built-in resilience features:
- Automatic retries with exponential backoff
- Configurable timeouts
- Heartbeat support for long-running tasks

### Persistence Tiers

Aether supports three persistence levels for different scenarios:

| Tier | Mode | Use Case |
|------|------|----------|
| **L0** | Memory-only | Development, debugging, short-lived tasks |
| **L1** | Snapshot | Short-lived workflows with periodic state saves |
| **L2** | State + Action Log | Long-running workflows with full audit trail |

```bash
# Choose persistence mode
aether serve --persistence memory         # L0: Fast, no persistence
aether serve --persistence snapshot       # L1: Balanced
aether serve --persistence state-action-log  # L2: Full durability
```

### State Machine

Every workflow follows this state machine:

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

**State Descriptions:**
- `PENDING`: Workflow created, waiting to start
- `RUNNING`: Actively executing steps
- `COMPLETED`: All steps finished successfully
- `FAILED`: Error occurred, no more steps will execute
- `CANCELLED`: Manually stopped before completion

## API Reference

### TypeScript SDK

#### AetherClient

```typescript
import { aether } from '@aetherframework.ai/sdk';

const client = aether({
  serverUrl: 'http://localhost:7233',
  workerId?: string,  // Optional: worker identifier
});
```

**Methods:**

| Method | Description |
|--------|-------------|
| `client.workflow(name, fn)` | Define a new workflow |
| `client.serve(workflows)` | Register workflows and start server |

#### WorkflowDefinition

```typescript
const myWorkflow = client.workflow('my-workflow', async (ctx, input: InputType) => {
  // Workflow implementation
  return output;
});
```

**Methods:**

| Method | Description |
|--------|-------------|
| `workflow.start(...args)` | Start workflow, returns `workflowId` (non-blocking) |
| `workflow.startAndWait(...args)` | Start and wait for completion, returns result (blocking) |

#### WorkflowContext

```typescript
interface WorkflowContext {
  // Execute a single step
  step: <T>(name: string, fn: () => Promise<T>) => Promise<T>;

  // Execute steps in parallel
  parallel: <T>(steps: (() => Promise<T>)[]) => Promise<T[]>;

  // Pause execution
  sleep: (duration: { minutes?: number; hours?: number; seconds?: number }) => Promise<void>;

  // Execute a child workflow
  child: <T>(workflow: Workflow<T>, args: any[]) => Promise<T>;
}
```

### gRPC API

#### ClientService

| Method | Request | Response | Description |
|--------|---------|----------|-------------|
| `StartWorkflow` | `StartWorkflowRequest` | `StartWorkflowResponse` | Start a new workflow |
| `GetWorkflowStatus` | `GetStatusRequest` | `WorkflowStatus` | Get workflow status |
| `AwaitResult` | `AwaitResultRequest` | `WorkflowResult` | Wait for workflow completion |
| `CancelWorkflow` | `CancelRequest` | `CancelResponse` | Cancel a running workflow |

#### WorkerService

| Method | Request | Response | Description |
|--------|---------|----------|-------------|
| `Register` | `RegisterRequest` | `RegisterResponse` | Register a worker |
| `PollTasks` | `PollRequest` | `stream Task` | Poll for pending tasks |
| `CompleteStep` | `CompleteStepRequest` | `CompleteStepResponse` | Complete a step |
| `Heartbeat` | `HeartbeatRequest` | `HeartbeatResponse` | Send heartbeat |

#### AdminService

| Method | Request | Response | Description |
|--------|---------|----------|-------------|
| `ListWorkflows` | `ListRequest` | `stream WorkflowInfo` | List all workflows |
| `GetMetrics` | `GetMetricsRequest` | `Metrics` | Get system metrics |

### CLI Commands

```bash
# Start the Aether server
aether serve [OPTIONS]

Options:
  --db <PATH>           Database path (default: ./data/aether.db)
  --grpc-port <PORT>    gRPC port (default: 7233)
  --http-port <PORT>    HTTP port (default: 7234)
  --persistence <MODE>  Persistence mode: memory, snapshot, state-action-log

# Initialize a new project
aether init <NAME> [OPTIONS]

Options:
  --output <PATH>       Output directory

# Manage workflows
aether workflow list [--type <TYPE>] [--state <STATE>]

# Check workflow status
aether status <WORKFLOW_ID>

# Cancel a workflow
aether cancel <WORKFLOW_ID>
```

### Configuration File

Create `aether.toml` to configure the server:

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

## Architecture

### System Overview

```
+-----------------------------------------------------------------+
|                        Aether Architecture                        |
+-----------------------------------------------------------------+
|                                                                   |
|  +-------------+    +-------------+    +-------------+          |
|  |   Client    |    |   Client    |    |   Client    |          |
|  |  (TypeScript)   |  (TypeScript)   |  (TypeScript)   |          |
|  +------+------+    +------+------+    +------+------+          |
|         |                   |                   |                 |
|         +-------------------+-------------------+                 |
|                             |                                     |
|                    +--------+--------+                           |
|                    |   gRPC Server   |                           |
|                    |  (Tonic/Rust)   |                           |
|                    +--------+--------+                           |
|                             |                                     |
|         +-------------------+-------------------+                |
|         |                   |                   |                 |
|  +------+------+    +-------+------+    +-------+------+          |
|  |   Client    |    |   Worker    |    |   Worker    |          |
|  |   Service   |    |   Service   |    |   Service   |          |
|  +------+------+    +------+------+    +------+------+          |
|         |                   |                   |                 |
|  +------+------+    +-------+------+                   |          |
|  |  Scheduler  |    |    Task     |                   |          |
|  |             |    |   Queue     |                   |          |
|  +------+------+    +-------------+                   |          |
|         |                                         |             |
|  +------v------+                                   |             |
|  | Persistence |                                   |             |
|  |   Layer     |                                   |             |
|  | L0/L1/L2    |                                   |             |
|  +-------------+                                   |             |
|                             |                      |             |
|         +-------------------+----------------------+             |
|         |                                              |          |
|  +------v------+         +-------+------+         +---v------+    |
|  |   SQLite    |         |  PostgreSQL |         |   Custom |    |
|  |  (Default)  |         | (Production)|         |   Storage|    |
|  +-------------+         +-------------+         +----------+    |
|                                                                   |
+-----------------------------------------------------------------+
```

### Components

#### Core Kernel (Rust)

The heart of Aether, written in Rust for performance and safety.

- **State Machine** — Manages workflow lifecycle (Pending → Running → Completed/Failed/Cancelled)
- **Scheduler** — Distributes tasks to workers based on capacity and affinity
- **Persistence Layer** — Three-tier storage system (L0/L1/L2)

#### gRPC Services

- **ClientService** — For workflow management (start, status, await, cancel)
- **WorkerService** — For task execution (register, poll, complete, heartbeat)
- **AdminService** — For monitoring and administration (list, metrics)

#### SDK Layer

Type-safe SDKs that abstract gRPC complexity:

- **Workflow Definition** — Type-safe workflow builder
- **Execution Context** — Step, parallel, sleep, child workflows
- **Server Mode** — Built-in gRPC server for local development

#### Dashboard

React-based web interface for real-time monitoring:

- **Workflow List** — View all workflows with filtering
- **Workflow Detail** — Deep dive into execution history
- **Metrics** — System health and performance metrics

### Data Flow

```
1. Client defines workflow
   ↓
2. Client starts workflow via gRPC
   ↓
3. Aether persists workflow to storage
   ↓
4. Scheduler assigns tasks to workers
   ↓
5. Worker executes step, reports completion
   ↓
6. Aether persists step result
   ↓
7. Repeat steps 4-6 until completion
   ↓
8. Client receives final result
```

### Persistence Tiers Detail

| Tier | Mode | Durability | Performance | Use Case |
|------|------|------------|-------------|----------|
| **L0** | Memory-only | None | Fastest | Development, debugging |
| **L1** | Snapshot | Medium | Fast | Short-lived workflows |
| **L2** | State + Action | High | Moderate | Production, audit-required |

**L2 Features:**
- Every step result is logged
- Complete audit trail
- Recovery from any point
- Time-travel debugging (future)

### Scaling

Aether scales horizontally:

1. **Stateless Workers** — Add more workers for throughput
2. **Shared Storage** — All nodes share the same persistence layer
3. **Load Balancer** — Distribute gRPC requests across nodes

```
                    +-----------------+
                    |  Load Balancer  |
                    |   (nginx/envoy) |
                    +--------+--------+
                             |
        +--------------------+--------------------+
        |                    |                    |
   +----v----+         +----v----+         +----v----+
   | Aether  |         | Aether  |         | Aether  |
   | Node 1  |         | Node 2  |         | Node 3  |
   +----+----+         +----+----+         +----+----+
        |                   |                   |
        +-------------------+-------------------+
                            |
                    +-------v-------+
                    |   Shared      |
                    |   Storage     |
                    | (PostgreSQL)  |
                    +---------------+
```

## Examples

### Quick Start

A minimal example demonstrating workflow basics.

**Location:** `examples/quickstart/`

```typescript
import { aether } from '@aetherframework.ai/sdk';

const client = aether({ serverUrl: 'http://localhost:7233' });

// Define a simple workflow
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
  // Register and serve
  await client.serve([greet]);

  // Run workflow
  const result = await greet.startAndWait('World');
  console.log(result.message); // "Hello, World!"
}

main();
```

**Run:**
```bash
cd examples/quickstart
npm install
npm run dev
```

### Order Processing

A realistic e-commerce workflow with inventory, payment, and shipping.

**Location:** `examples/order-processing/`

```typescript
import { aether } from '@aetherframework.ai/sdk';

const client = aether({ serverUrl: 'http://localhost:7233' });

const orderProcessing = client.workflow('order-processing', async (ctx, orderId: string) => {
  // Step 1: Check inventory
  const inventory = await ctx.step('check-inventory', async () => {
    return { available: true, items: 10 };
  });

  if (!inventory.available) {
    throw new Error('Inventory not available');
  }

  // Step 2: Reserve inventory
  await ctx.step('reserve-inventory', async () => {
    return { reserved: true };
  });

  // Step 3: Process payment
  const payment = await ctx.step('process-payment', async () => {
    return { transactionId: `tx-${Date.now()}`, status: 'completed' };
  });

  // Step 4: Ship order
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

// Run with automatic server start
async function main() {
  await client.serve([orderProcessing]);

  const result = await orderProcessing.startAndWait('order-123');
  console.log('Order processed:', result);
}

main();
```

**Run:**
```bash
cd examples/order-processing
npm install
npm run dev
```

### Parallel Execution

Demonstrates concurrent step execution.

```typescript
const batchProcess = client.workflow('batch-process', async (ctx, orders: string[]) => {
  // Execute multiple tasks in parallel
  const results = await ctx.parallel(
    orders.map(orderId => () => processOrder.startAndWait(orderId))
  );

  return {
    processed: results.length,
    results,
  };
});
```

### More Examples

Looking for more patterns? Check out:

- **Error Handling** — Retry policies and failure recovery
- **Long-Running Tasks** — Activities with heartbeats
- **Child Workflows** — Composing workflows together
- **Conditional Logic** — Branching based on step results

**Location:** `examples/`

## Contributing

We welcome contributions! Please read our contributing guidelines before submitting PRs.

### Getting Started

1. **Fork the repository**
   ```bash
   git fork https://github.com/your-org/aether.git
   ```

2. **Clone your fork**
   ```bash
   git clone https://github.com/YOUR-USERNAME/aether.git
   cd aether
   ```

3. **Set up development environment**
   ```bash
   # Install Rust tools
   rustup component add rustfmt clippy

   # Install Node.js tools
   cd sdks/typescript && npm install
   cd dashboard && npm install
   ```

4. **Run tests**
   ```bash
   # Rust tests
   cargo test

   # TypeScript tests
   cd sdks/typescript && npm test
   ```

5. **Build everything**
   ```bash
   ./scripts/build.sh
   ```

### Development Workflow

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Make changes following our coding standards
3. Add tests for your changes
4. Run linters and formatters:
   ```bash
   cargo fmt      # Rust
   cargo clippy   # Rust linting
   npm run format # TypeScript
   npm run lint   # TypeScript linting
   ```
5. Submit a pull request

### Coding Standards

**Rust:**
- Follow `rustfmt` formatting
- Pass `clippy` without warnings
- Write documentation for public APIs
- Add unit tests for new functionality

**TypeScript:**
- Follow ESLint configuration
- Use TypeScript strict mode
- Write JSDoc comments for public APIs
- Add tests for new functionality

**Commit Messages:**
- Use conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`
- Keep commits atomic and focused
- Include issue number if applicable

### Reporting Issues

When reporting issues, please include:
- A clear description of the problem
- Steps to reproduce
- Expected behavior vs actual behavior
- Environment details (OS, Rust version, Node version)
- Error messages and stack traces

### Documentation

Improvements to documentation are highly appreciated:
- Fix typos and grammar
- Add examples and tutorials
- Improve explanations and clarifications
- Translate to other languages

**Build docs:**
```bash
cargo doc --no-deps --open
```