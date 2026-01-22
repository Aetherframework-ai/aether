import { createAetherTrpc, AetherTrpc } from '../src/aether-trpc';

describe('AetherTrpc', () => {
  describe('createAetherTrpc', () => {
    it('should create an instance with config', () => {
      const trpc = createAetherTrpc({
        serverUrl: 'http://localhost:7233',
        serviceName: 'test-service',
      });

      expect(trpc).toBeInstanceOf(AetherTrpc);
    });

    it('should create an instance with custom workerId', () => {
      const trpc = createAetherTrpc({
        serverUrl: 'http://localhost:7233',
        serviceName: 'test-service',
        workerId: 'custom-worker-id',
      });

      expect(trpc.getWorkerId()).toBe('custom-worker-id');
    });

    it('should create an instance with custom pollingInterval', () => {
      const trpc = createAetherTrpc({
        serverUrl: 'http://localhost:7233',
        serviceName: 'test-service',
        pollingInterval: 500,
      });

      expect(trpc).toBeInstanceOf(AetherTrpc);
    });
  });

  describe('getWorkerId', () => {
    it('should return custom workerId when provided', () => {
      const trpc = createAetherTrpc({
        serverUrl: 'http://localhost:7233',
        serviceName: 'test-service',
        workerId: 'my-custom-worker',
      });

      expect(trpc.getWorkerId()).toBe('my-custom-worker');
    });

    it('should generate workerId when not provided', () => {
      const trpc = createAetherTrpc({
        serverUrl: 'http://localhost:7233',
        serviceName: 'test-service',
      });

      const workerId = trpc.getWorkerId();

      expect(workerId).toMatch(/^trpc-worker-\d+-[a-z0-9]+$/);
    });

    it('should generate unique workerIds for multiple instances', () => {
      const trpc1 = createAetherTrpc({
        serverUrl: 'http://localhost:7233',
        serviceName: 'test-service',
      });

      const trpc2 = createAetherTrpc({
        serverUrl: 'http://localhost:7233',
        serviceName: 'test-service',
      });

      expect(trpc1.getWorkerId()).not.toBe(trpc2.getWorkerId());
    });
  });

  describe('step', () => {
    it('should register a handler for a step', () => {
      const trpc = createAetherTrpc({
        serverUrl: 'http://localhost:7233',
        serviceName: 'test-service',
      });

      const handler = jest.fn().mockResolvedValue({ result: 'test' });

      trpc.step('test-step', handler);

      const steps = trpc.getSteps();
      expect(steps.has('test-step')).toBe(true);
      expect(steps.get('test-step')?.name).toBe('test-step');
      expect(steps.get('test-step')?.handler).toBe(handler);
    });

    it('should register multiple handlers for different steps', () => {
      const trpc = createAetherTrpc({
        serverUrl: 'http://localhost:7233',
        serviceName: 'test-service',
      });

      const handler1 = jest.fn().mockResolvedValue({ value: 1 });
      const handler2 = jest.fn().mockResolvedValue({ value: 2 });
      const handler3 = jest.fn().mockResolvedValue({ value: 3 });

      trpc.step('step-1', handler1);
      trpc.step('step-2', handler2);
      trpc.step('step-3', handler3);

      const steps = trpc.getSteps();

      expect(steps.has('step-1')).toBe(true);
      expect(steps.has('step-2')).toBe(true);
      expect(steps.has('step-3')).toBe(true);
      expect(steps.size).toBe(3);
    });

    it('should allow overriding an existing step handler', () => {
      const trpc = createAetherTrpc({
        serverUrl: 'http://localhost:7233',
        serviceName: 'test-service',
      });

      const originalHandler = jest.fn().mockResolvedValue({ version: 1 });
      const newHandler = jest.fn().mockResolvedValue({ version: 2 });

      trpc.step('override-step', originalHandler);
      trpc.step('override-step', newHandler);

      const steps = trpc.getSteps();
      expect(steps.get('override-step')?.handler).toBe(newHandler);
    });

    it('should register steps with typed input and output', () => {
      const trpc = createAetherTrpc({
        serverUrl: 'http://localhost:7233',
        serviceName: 'test-service',
      });

      trpc.step<{ name: string }, { greeting: string }>('greet', async ({ input }) => {
        return { greeting: `Hello, ${input.name}!` };
      });

      trpc.step<number, { doubled: number }>('double', async ({ input }) => {
        return { doubled: input * 2 };
      });

      const steps = trpc.getSteps();

      expect(steps.has('greet')).toBe(true);
      expect(steps.has('double')).toBe(true);
    });
  });

  describe('getSteps', () => {
    it('should return empty registry initially', () => {
      const trpc = createAetherTrpc({
        serverUrl: 'http://localhost:7233',
        serviceName: 'test-service',
      });

      const steps = trpc.getSteps();

      expect(steps.size).toBe(0);
    });

    it('should return the same registry instance', () => {
      const trpc = createAetherTrpc({
        serverUrl: 'http://localhost:7233',
        serviceName: 'test-service',
      });

      const steps1 = trpc.getSteps();
      const steps2 = trpc.getSteps();

      expect(steps1).toBe(steps2);
    });

    it('should reflect registered steps', () => {
      const trpc = createAetherTrpc({
        serverUrl: 'http://localhost:7233',
        serviceName: 'test-service',
      });

      trpc.step('step-1', async () => ({}));
      trpc.step('step-2', async () => ({}));

      const steps = trpc.getSteps();

      expect(steps.has('step-1')).toBe(true);
      expect(steps.has('step-2')).toBe(true);
    });
  });

  describe('instance configuration', () => {
    it('should store config correctly', () => {
      const config = {
        serverUrl: 'http://localhost:7233',
        serviceName: 'my-service',
        group: 'production',
        workerId: 'worker-1',
        pollingInterval: 300,
      };

      const trpc = createAetherTrpc(config);

      expect(trpc.getWorkerId()).toBe('worker-1');
    });

    it('should use default group when not provided', () => {
      const trpc = createAetherTrpc({
        serverUrl: 'http://localhost:7233',
        serviceName: 'test-service',
      });

      const steps = trpc.getSteps();
      expect(steps.size).toBe(0);
    });
  });
});
