# Multilang Workflow Example

Demonstrates Aether's cross-language workflow orchestration between NestJS+tRPC and Python services.

## Structure

```
multilang-workflow/
├── nestjs-service/     # NestJS + tRPC service (sync/async steps)
├── python-service/     # Python service (sync/async steps)
├── workflow.ts         # Main workflow orchestrator
└── README.md
```

## Workflow Flow

```
NestJS sync → Python sync → NestJS async (500ms) → Python async (500ms)
```

## Quick Start

### 1. Start Aether Core

```bash
cd /path/to/aether
cargo run --bin aether
```

### 2. Start NestJS Service

```bash
cd nestjs-service
bun install
bun run start:dev
```

### 3. Start Python Service

```bash
cd python-service
python main.py
```

### 4. Run Workflow

```bash
bun install
bun run workflow
```

## Expected Output

```
==================================================
Multilang Workflow Demo
==================================================

→ Calling NestJS sync step...
[NestJS] Sync step: Hello Aether!
→ Calling Python sync step...
[Python] Sync step: Hello Aether!
→ Calling NestJS async step...
[NestJS] Async step: Hello Aether!
→ Calling Python async step...
[Python] Async step: Hello Aether!

==================================================
Workflow Result:
{
  "workflow": "multilang-demo",
  "steps": [...],
  "totalSteps": 4
}
```

## Key Concepts

- **Sync vs Async**: Sync steps execute immediately; async steps have deliberate delays (500ms)
- **Cross-language**: Aether routes step calls to the appropriate service based on registration
- **Sequential execution**: Steps run in order; each `await ctx.step()` waits for completion
