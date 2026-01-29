// examples/trpc/src/index.ts
import { createAetherTrpc } from '@aetherframework.ai/trpc';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import { z } from 'zod';

// 创建增强的 tRPC 实例
const { t, aether } = createAetherTrpc({
  serverUrl: 'localhost:7233',
  serviceName: 'order-service',
  group: 'default',
});

// 定义 router
const router = t.router({
  health: t.procedure.query(() => ({ status: 'ok' })),

  // 使用 mutationStep - 自动推断名称为 'processOrder'
  processOrder: t.procedure
    .input(z.object({ orderId: z.string(), amount: z.number() }))
    .mutationStep(async ({ input }) => {
      console.log(`Processing order: ${input.orderId}`);
      return {
        success: true,
        orderId: input.orderId,
        amount: input.amount,
        processedAt: new Date().toISOString(),
      };
    }),

  // 使用 queryStep - 显式指定名称
  getOrder: t.procedure
    .input(z.object({ orderId: z.string() }))
    .queryStep('get-order', async ({ input }) => {
      return {
        orderId: input.orderId,
        status: 'pending',
      };
    }),
});

export type AppRouter = typeof router;

// 绑定 router 并启动
const server = createHTTPServer({
  router,
  createContext: () => ({}),
});

async function main() {
  // 绑定 router
  aether.bindRouter(router);

  // 启动 Aether worker
  console.log('[Main] Starting Aether worker...');
  await aether.serve();
  console.log('[Main] Aether worker started');

  // 启动 tRPC HTTP 服务
  const PORT = 3000;
  server.listen(PORT);
  console.log(`[Main] tRPC server running on http://localhost:${PORT}`);
}

main().catch(console.error);
