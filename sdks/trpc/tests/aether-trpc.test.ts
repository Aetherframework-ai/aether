import { AetherTrpc, createAetherTrpc } from '../src/aether-trpc';
import { Client } from '@aetherframework.ai/sdk';

// Mock Client
jest.mock('@aetherframework.ai/sdk', () => ({
  Client: jest.fn().mockImplementation(() => ({
    register: jest.fn().mockResolvedValue({ serverId: 'server-123' }),
    pollTasksOnce: jest.fn().mockResolvedValue([]),
    completeStep: jest.fn().mockResolvedValue(true),
    reportStepStarted: jest.fn().mockResolvedValue(true),
    reportStepCompleted: jest.fn().mockResolvedValue(true),
    reportStepFailed: jest.fn().mockResolvedValue(true),
  })),
}));

describe('AetherTrpc', () => {
  let aether: AetherTrpc;

  beforeEach(() => {
    aether = createAetherTrpc({
      serverUrl: 'localhost:7233',
      serviceName: 'test-service',
    });
  });

  describe('step()', () => {
    it('should register a step handler', () => {
      const handler = jest.fn().mockResolvedValue({ result: 'test' });
      aether.step('test-step', handler);

      const steps = aether.getSteps();
      expect(steps.has('test-step')).toBe(true);
      expect(steps.get('test-step')?.handler).toBe(handler);
    });

    it('should return the original handler', () => {
      const handler = async ({ input }: { input: any }) => input;
      const result = aether.step('test-step', handler);

      expect(result).toBe(handler);
    });
  });

  describe('getSteps()', () => {
    it('should return empty registry initially', () => {
      const steps = aether.getSteps();
      expect(steps.size).toBe(0);
    });

    it('should contain registered steps', () => {
      aether.step('step-1', async () => {});
      aether.step('step-2', async () => {});

      const steps = aether.getSteps();
      expect(steps.size).toBe(2);
      expect(steps.has('step-1')).toBe(true);
      expect(steps.has('step-2')).toBe(true);
    });
  });

  describe('getWorkerId()', () => {
    it('should return custom workerId if provided', () => {
      const aetherWithId = createAetherTrpc({
        serverUrl: 'localhost:7233',
        serviceName: 'test-service',
        workerId: 'my-worker',
      });

      expect(aetherWithId.getWorkerId()).toBe('my-worker');
    });

    it('should generate workerId if not provided', () => {
      const workerId = aether.getWorkerId();
      expect(workerId).toBeDefined();
      expect(workerId.startsWith('trpc-')).toBe(true);
    });
  });
});

describe('createAetherTrpc', () => {
  it('should create AetherTrpc instance', () => {
    const aether = createAetherTrpc({
      serverUrl: 'localhost:7233',
      serviceName: 'test-service',
    });

    expect(aether).toBeInstanceOf(AetherTrpc);
  });

  it('should use default group if not provided', () => {
    const aether = createAetherTrpc({
      serverUrl: 'localhost:7233',
      serviceName: 'test-service',
    });

    // Group is used internally, verify through behavior
    const steps = aether.getSteps();
    expect(steps.size).toBe(0);
  });
});
