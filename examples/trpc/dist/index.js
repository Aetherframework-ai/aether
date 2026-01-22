"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const server_1 = require("@trpc/server");
const standalone_1 = require("@trpc/server/adapters/standalone");
const trpc_1 = require("@aetherframework.ai/trpc");
const zod_1 = require("zod");
const t = server_1.initTRPC.create();
// 创建 Aether tRPC 实例
const aether = (0, trpc_1.createAetherTrpc)({
    serverUrl: 'localhost:7233',
    serviceName: 'order-service',
    group: 'default',
});
// 定义 tRPC router
const router = t.router({
    health: t.procedure.query(() => ({ status: 'ok' })),
    // 使用 aether.step() 注册为 Aether step
    processOrder: t.procedure
        .input(zod_1.z.object({ orderId: zod_1.z.string(), amount: zod_1.z.number() }))
        .mutation(aether.step('process-order', async ({ input }) => {
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
        .input(zod_1.z.object({ orderId: zod_1.z.string() }))
        .query(aether.step('get-order', async ({ input }) => {
        // 获取订单逻辑
        return {
            orderId: input.orderId,
            status: 'pending',
        };
    })),
});
// 启动 tRPC HTTP 服务
const server = (0, standalone_1.createHTTPServer)({
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
