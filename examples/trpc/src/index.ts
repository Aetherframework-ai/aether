import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import { createAetherTrpc } from '@aetherframework.ai/trpc';
import { z } from 'zod';

const t = initTRPC.create();

const aether = createAetherTrpc({
  serverUrl: 'localhost:7233',
  serviceName: 'order-service',
  group: 'default',
});

const router = t.router({
  health: t.procedure.query(() => ({ status: 'ok' })),

  processOrder: t.procedure
    .input(z.object({ orderId: z.string(), amount: z.number() }))
    .mutation(aether.step('process-order', async ({ input }) => {
      console.log(`Processing order: ${input.orderId}`);

      const result = {
        success: true,
        orderId: input.orderId,
        amount: input.amount,
        processedAt: new Date().toISOString(),
      };

      return result;
    })),

  getOrder: t.procedure
    .input(z.object({ orderId: z.string() }))
    .query(aether.step('get-order', async ({ input }) => {
      return {
        orderId: input.orderId,
        status: 'pending',
      };
    })),
});

export type AppRouter = typeof router;

const server = createHTTPServer({
  router,
  createContext: () => ({}),
});

async function main() {
  console.log('[Main] Starting Aether worker...');
  await aether.serve();
  console.log('[Main] Aether worker started');

  const PORT = 3000;
  server.listen(PORT);
  console.log(`[Main] tRPC server running on http://localhost:${PORT}`);
}

main().catch(console.error);
