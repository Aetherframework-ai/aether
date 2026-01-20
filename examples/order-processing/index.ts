import { aether } from '@aether/sdk';

const client = aether({
  serverUrl: 'http://localhost:7233',
});

const orderProcessing = client.workflow('order-processing', async (ctx, orderId: string) => {
  const inventory = await ctx.step('check-inventory', async () => {
    return { available: true, items: 10 };
  });
  
  if (!inventory.available) {
    throw new Error('Inventory not available');
  }
  
  await ctx.step('reserve-inventory', async () => {
    return { reserved: true };
  });
  
  const payment = await ctx.step('process-payment', async () => {
    return { transactionId: `tx-${Date.now()}`, status: 'completed' };
  });
  
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

export { orderProcessing };
