# @aetherframework.ai/trpc

tRPC SDK for Aether workflow engine. Provides seamless integration between tRPC procedures and Aether workflow steps.

## Installation

```bash
npm install @aetherframework.ai/trpc
```

**Peer Dependencies:**
- `@aetherframework.ai/sdk`
- `@trpc/server` (>=10.0.0)

## Quick Start

```typescript
import { createAetherTrpc } from '@aetherframework.ai/trpc';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import { z } from 'zod';

// Create enhanced tRPC instance
const { t, aether } = createAetherTrpc({
  serverUrl: 'localhost:7233',
  serviceName: 'order-service',
});

// Define router with step methods
const router = t.router({
  // Regular tRPC procedure (not registered as Aether step)
  health: t.procedure.query(() => ({ status: 'ok' })),

  // mutationStep - auto-inferred name from router key ('processOrder')
  processOrder: t.procedure
    .input(z.object({ orderId: z.string(), amount: z.number() }))
    .mutationStep(async ({ input }) => {
      return { success: true, orderId: input.orderId };
    }),

  // queryStep - explicit name ('get-order')
  getOrder: t.procedure
    .input(z.object({ orderId: z.string() }))
    .queryStep('get-order', async ({ input }) => {
      return { orderId: input.orderId, status: 'pending' };
    }),
});

export type AppRouter = typeof router;

// Start server
const server = createHTTPServer({ router, createContext: () => ({}) });

async function main() {
  aether.bindRouter(router);
  await aether.serve();
  server.listen(3000);
}

main();
```

## API

### `createAetherTrpc(config)`

Creates an enhanced tRPC instance with Aether integration.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `serverUrl` | `string` | Yes | Aether server URL |
| `serviceName` | `string` | Yes | Service name for worker registration |
| `group` | `string` | No | Worker group (default: `'default'`) |
| `workerId` | `string` | No | Custom worker ID (auto-generated if not provided) |

**Returns:** `{ t, aether }`

- `t` - Enhanced tRPC instance with `mutationStep` and `queryStep` methods
- `aether` - Aether instance for router binding and worker management

### `t.procedure.mutationStep(handler)` / `t.procedure.mutationStep(name, handler)`

Creates a tRPC mutation that is also registered as an Aether workflow step.

```typescript
// Auto-inferred name from router key
processOrder: t.procedure
  .input(z.object({ orderId: z.string() }))
  .mutationStep(async ({ input }) => {
    return { success: true };
  }),

// Explicit name
processOrder: t.procedure
  .input(z.object({ orderId: z.string() }))
  .mutationStep('custom-step-name', async ({ input }) => {
    return { success: true };
  }),
```

### `t.procedure.queryStep(handler)` / `t.procedure.queryStep(name, handler)`

Creates a tRPC query that is also registered as an Aether workflow step.

```typescript
// Auto-inferred name
getOrder: t.procedure
  .input(z.object({ orderId: z.string() }))
  .queryStep(async ({ input }) => {
    return { orderId: input.orderId };
  }),

// Explicit name
getOrder: t.procedure
  .input(z.object({ orderId: z.string() }))
  .queryStep('get-order', async ({ input }) => {
    return { orderId: input.orderId };
  }),
```

### `aether.bindRouter(router)`

Scans the router for procedures with `mutationStep`/`queryStep` and registers them as Aether steps.

```typescript
const router = t.router({ ... });
aether.bindRouter(router);
```

**Features:**
- Auto-infers step names from router keys
- Supports nested routers with path prefixes (e.g., `orders.create`)
- Throws error on duplicate step names
- Can be called multiple times to bind multiple routers

### `aether.serve()`

Starts the Aether worker. Registers with the server and begins polling for tasks.

```typescript
await aether.serve();
```

**Note:** Must call `bindRouter()` before `serve()`.

### `aether.stop()`

Stops the Aether worker polling.

```typescript
aether.stop();
```

### `aether.getSteps()`

Returns the registered step registry.

```typescript
const steps = aether.getSteps();
// Map<string, { name: string, handler: Function }>
```

### `aether.getWorkerId()`

Returns the worker ID.

```typescript
const workerId = aether.getWorkerId();
```

## Step Naming

### Auto-inferred Names

When using `mutationStep(handler)` or `queryStep(handler)` without an explicit name, the step name is inferred from the router key:

```typescript
const router = t.router({
  processOrder: t.procedure.mutationStep(...),  // Step name: 'processOrder'
  user: t.router({
    create: t.procedure.mutationStep(...),      // Step name: 'user.create'
  }),
});
```

### Explicit Names

Provide a name as the first argument to override auto-inference:

```typescript
const router = t.router({
  processOrder: t.procedure.mutationStep('custom-name', ...),  // Step name: 'custom-name'
});
```

### Duplicate Detection

If two procedures resolve to the same step name, `bindRouter()` throws an error:

```typescript
const router = t.router({
  order1: t.procedure.mutationStep('same-name', ...),
  order2: t.procedure.mutationStep('same-name', ...),  // Error!
});
```

## Type Safety

Input types are automatically inferred from Zod schemas:

```typescript
t.procedure
  .input(z.object({ orderId: z.string(), amount: z.number() }))
  .mutationStep(async ({ input }) => {
    // input is typed as { orderId: string; amount: number }
    input.orderId;  // string
    input.amount;   // number
  });
```

## License

Apache-2.0
