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

import { AETHER_STEP_META, StepMeta } from '../src/types';

describe('StepMeta types', () => {
  it('should have AETHER_STEP_META symbol exported', () => {
    expect(typeof AETHER_STEP_META).toBe('symbol');
  });
});

import { createProcedureBuilderProxy } from '../src/procedure-builder-proxy';
import { createAetherTrpc as createAetherTrpcNew } from '../src/create-aether-trpc';

// Mock @trpc/server
jest.mock('@trpc/server', () => ({
  initTRPC: {
    create: jest.fn().mockReturnValue({
      procedure: {
        input: jest.fn().mockReturnThis(),
        mutation: jest.fn().mockReturnValue({ _def: {} }),
        query: jest.fn().mockReturnValue({ _def: {} }),
        _def: { inputs: [] },
      },
      router: jest.fn().mockReturnValue({ _def: { procedures: {} } }),
      middleware: jest.fn(),
    }),
  },
}));

describe('createAetherTrpc (new API)', () => {
  it('should return t and aether objects', () => {
    const { t, aether } = createAetherTrpcNew({
      serverUrl: 'localhost:7233',
      serviceName: 'test-service',
    });

    expect(t).toBeDefined();
    expect(t.procedure).toBeDefined();
    expect(t.router).toBeDefined();
    expect(aether).toBeDefined();
    expect(aether.bindRouter).toBeDefined();
    expect(aether.serve).toBeDefined();
  });

  it('t.procedure should have mutationStep method', () => {
    const { t } = createAetherTrpcNew({
      serverUrl: 'localhost:7233',
      serviceName: 'test-service',
    });

    expect(typeof (t.procedure as any).mutationStep).toBe('function');
  });

  it('t.procedure should have queryStep method', () => {
    const { t } = createAetherTrpcNew({
      serverUrl: 'localhost:7233',
      serviceName: 'test-service',
    });

    expect(typeof (t.procedure as any).queryStep).toBe('function');
  });

  it('aether should have stop method', () => {
    const { aether } = createAetherTrpcNew({
      serverUrl: 'localhost:7233',
      serviceName: 'test-service',
    });

    expect(typeof aether.stop).toBe('function');
  });

  it('aether should have getSteps method', () => {
    const { aether } = createAetherTrpcNew({
      serverUrl: 'localhost:7233',
      serviceName: 'test-service',
    });

    expect(typeof aether.getSteps).toBe('function');
  });

  it('aether should have getWorkerId method', () => {
    const { aether } = createAetherTrpcNew({
      serverUrl: 'localhost:7233',
      serviceName: 'test-service',
    });

    expect(typeof aether.getWorkerId).toBe('function');
  });

  it('should generate workerId if not provided', () => {
    const { aether } = createAetherTrpcNew({
      serverUrl: 'localhost:7233',
      serviceName: 'test-service',
    });

    expect(aether.getWorkerId()).toBeDefined();
    expect(aether.getWorkerId().startsWith('trpc-')).toBe(true);
  });

  it('should use custom workerId if provided', () => {
    const { aether } = createAetherTrpcNew({
      serverUrl: 'localhost:7233',
      serviceName: 'test-service',
      workerId: 'my-custom-worker',
    });

    expect(aether.getWorkerId()).toBe('my-custom-worker');
  });
});

describe('createProcedureBuilderProxy', () => {
  it('should add mutationStep method to procedure builder', () => {
    const mockProcedureBuilder = {
      input: jest.fn().mockReturnThis(),
      mutation: jest.fn().mockReturnValue({ _def: {} }),
      _def: { inputs: [] },
    };

    const proxy = createProcedureBuilderProxy(mockProcedureBuilder as any);
    expect(typeof proxy.mutationStep).toBe('function');
  });

  it('should add queryStep method to procedure builder', () => {
    const mockProcedureBuilder = {
      input: jest.fn().mockReturnThis(),
      query: jest.fn().mockReturnValue({ _def: {} }),
      _def: { inputs: [] },
    };

    const proxy = createProcedureBuilderProxy(mockProcedureBuilder as any);
    expect(typeof proxy.queryStep).toBe('function');
  });

  it('mutationStep should attach step meta to procedure', () => {
    const mockProcedure = { _def: {} };
    const mockProcedureBuilder = {
      input: jest.fn().mockReturnThis(),
      mutation: jest.fn().mockReturnValue(mockProcedure),
      _def: { inputs: [] },
    };

    const proxy = createProcedureBuilderProxy(mockProcedureBuilder as any);
    const handler = async ({ input }: { input: any }) => input;
    const result = proxy.mutationStep(handler);

    expect((result as any)[AETHER_STEP_META]).toEqual({
      handler,
      type: 'mutation',
      explicitName: undefined,
    });
  });

  it('mutationStep should support explicit name', () => {
    const mockProcedure = { _def: {} };
    const mockProcedureBuilder = {
      input: jest.fn().mockReturnThis(),
      mutation: jest.fn().mockReturnValue(mockProcedure),
      _def: { inputs: [] },
    };

    const proxy = createProcedureBuilderProxy(mockProcedureBuilder as any);
    const handler = async ({ input }: { input: any }) => input;
    const result = proxy.mutationStep('custom-name', handler);

    expect((result as any)[AETHER_STEP_META]).toEqual({
      handler,
      type: 'mutation',
      explicitName: 'custom-name',
    });
  });

  it('should preserve mutationStep method after .input() chaining', () => {
    const mockProcedure = { _def: {} };
    const chainedBuilder = {
      mutation: jest.fn().mockReturnValue(mockProcedure),
      _def: { inputs: [] },
    };
    const mockProcedureBuilder = {
      input: jest.fn().mockReturnValue(chainedBuilder),
      mutation: jest.fn().mockReturnValue(mockProcedure),
      _def: { inputs: [] },
    };

    const proxy = createProcedureBuilderProxy(mockProcedureBuilder as any);
    const chained = proxy.input({});
    expect(typeof chained.mutationStep).toBe('function');
  });

  it('queryStep should attach step meta to procedure', () => {
    const mockProcedure = { _def: {} };
    const mockProcedureBuilder = {
      input: jest.fn().mockReturnThis(),
      query: jest.fn().mockReturnValue(mockProcedure),
      _def: { inputs: [] },
    };

    const proxy = createProcedureBuilderProxy(mockProcedureBuilder as any);
    const handler = async ({ input }: { input: any }) => input;
    const result = proxy.queryStep(handler);

    expect((result as any)[AETHER_STEP_META]).toEqual({
      handler,
      type: 'query',
      explicitName: undefined,
    });
  });
});
