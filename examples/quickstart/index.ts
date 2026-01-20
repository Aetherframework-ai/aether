import { aether } from '@aether/sdk';

const client = aether({
  serverUrl: 'http://localhost:7233',
});

const processOrder = client.workflow('process-order', async (ctx, orderId: string) => {
  console.log(`Processing order: ${orderId}`);
  
  const order = await ctx.step('fetch-order', async () => {
    await new Promise(resolve => setTimeout(resolve, 100));
    return { id: orderId, amount: 99.99, email: 'user@example.com' };
  });
  
  const paymentResult = await ctx.step('process-payment', async () => {
    console.log('Processing payment for order:', order.amount);
    await new Promise(resolve => setTimeout(resolve, 200));
    return { success: true, transactionId: `tx-${Date.now()}` };
  });
  
  await ctx.step('send-confirmation', async () => {
    console.log(`Sending confirmation email to ${order.email}`);
    await new Promise(resolve => setTimeout(resolve, 100));
    return 'email-sent';
  });
  
  return {
    orderId: order.id,
    paymentId: paymentResult.transactionId,
    status: 'completed',
  };
});

const batchProcess = client.workflow('batch-process', async (ctx, orders: string[]) => {
  const results = await ctx.parallel(
    orders.map(orderId => () => processOrder.startAndWait(orderId))
  );
  
  return {
    processed: results.length,
    results: results,
  };
});

async function main() {
  console.log('Starting Aether server...');
  
  await client.serve([
    processOrder,
    batchProcess,
  ]);
  
  console.log('Server started successfully!');
  
  console.log('Starting test workflow...');
  const workflowId = await processOrder.start('order-123');
  console.log(`Workflow started with ID: ${workflowId}`);
  
  const result = await processOrder.startAndWait('order-456');
  console.log('Workflow result:', result);
}

main().catch(console.error);
