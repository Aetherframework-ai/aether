import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import { createAetherTrpc } from '@aetherframework.ai/trpc';
import { z } from 'zod';

const t = initTRPC.create();

// 创建 Aether tRPC 实例
const aether = createAetherTrpc({
  serverUrl: 'localhost:7233',
  serviceName: 'order-service',
  group: 'default',
});

// 定义 tRPC router
const router = t.router({
  health: t.procedure.query(() => ({ status: 'ok' })),

  // 使用 aether.step() 注册为 Aether step
  processOrder: t.procedure
    .input(z.object({ orderId: z.string(), amount: z.number() }))
    .mutation(aether.step('process-order', async ({ input }: { input: { orderId: string; amount: number } }) => {
      console.log(`Processing order: ${input.orderId}`);

      // 业务逻辑
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
    .query(aether.step('get-order', async ({ input }: { input: { orderId: string } }) => {
      // 获取订单逻辑
      return {
        orderId: input.orderId,
        status: 'pending',
      };
    })),
});

export type AppRouter = typeof router;

// 启动 tRPC HTTP 服务
const server = createHTTPServer({
  router,
  createContext: () => ({}),
});

async function main() {
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
