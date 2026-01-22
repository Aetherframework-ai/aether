import { createAetherTrpc } from '../src/create-aether-trpc';
import { createProcedureBuilderProxy } from '../src/procedure-builder-proxy';
import { AETHER_STEP_META } from '../src/types';

// Mock @aetherframework.ai/sdk
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

// Module exports tests
describe('module exports', () => {
  it('should export createAetherTrpc from index', async () => {
    const module = await import('../src/index');
    expect(module.createAetherTrpc).toBeDefined();
  });

  it('should export AETHER_STEP_META from index', async () => {
    const module = await import('../src/index');
    expect(module.AETHER_STEP_META).toBeDefined();
  });

  it('should NOT export old AetherTrpc class', async () => {
    const module = await import('../src/index');
    expect((module as any).AetherTrpc).toBeUndefined();
  });
});

describe('createAetherTrpc (new API)', () => {
  it('should return t and aether objects', () => {
    const { t, aether } = createAetherTrpc({
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
    const { t } = createAetherTrpc({
      serverUrl: 'localhost:7233',
      serviceName: 'test-service',
    });

    expect(typeof (t.procedure as any).mutationStep).toBe('function');
  });

  it('t.procedure should have queryStep method', () => {
    const { t } = createAetherTrpc({
      serverUrl: 'localhost:7233',
      serviceName: 'test-service',
    });

    expect(typeof (t.procedure as any).queryStep).toBe('function');
  });

  it('aether should have stop method', () => {
    const { aether } = createAetherTrpc({
      serverUrl: 'localhost:7233',
      serviceName: 'test-service',
    });

    expect(typeof aether.stop).toBe('function');
  });

  it('aether should have getSteps method', () => {
    const { aether } = createAetherTrpc({
      serverUrl: 'localhost:7233',
      serviceName: 'test-service',
    });

    expect(typeof aether.getSteps).toBe('function');
  });

  it('aether should have getWorkerId method', () => {
    const { aether } = createAetherTrpc({
      serverUrl: 'localhost:7233',
      serviceName: 'test-service',
    });

    expect(typeof aether.getWorkerId).toBe('function');
  });

  it('should generate workerId if not provided', () => {
    const { aether } = createAetherTrpc({
      serverUrl: 'localhost:7233',
      serviceName: 'test-service',
    });

    expect(aether.getWorkerId()).toBeDefined();
    expect(aether.getWorkerId().startsWith('trpc-')).toBe(true);
  });

  it('should use custom workerId if provided', () => {
    const { aether } = createAetherTrpc({
      serverUrl: 'localhost:7233',
      serviceName: 'test-service',
      workerId: 'my-custom-worker',
    });

    expect(aether.getWorkerId()).toBe('my-custom-worker');
  });
});

describe('aether.bindRouter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should register steps from router with auto-inferred names', () => {
    const { t, aether } = createAetherTrpc({
      serverUrl: 'localhost:7233',
      serviceName: 'test-service',
    });

    const handler = async ({ input }: { input: any }) => input;
    const procedure = (t.procedure as any).mutationStep(handler);

    // Create a router with the procedure
    const router = {
      _def: {
        procedures: {
          processOrder: procedure,
        },
      },
    };

    aether.bindRouter(router as any);

    const steps = aether.getSteps();
    expect(steps.has('processOrder')).toBe(true);
    expect(steps.get('processOrder')?.handler).toBe(handler);
  });

  it('should use explicit name when provided', () => {
    const { t, aether } = createAetherTrpc({
      serverUrl: 'localhost:7233',
      serviceName: 'test-service',
    });

    const handler = async ({ input }: { input: any }) => input;
    const procedure = (t.procedure as any).mutationStep('custom-step-name', handler);

    const router = {
      _def: {
        procedures: {
          processOrder: procedure,
        },
      },
    };

    aether.bindRouter(router as any);

    const steps = aether.getSteps();
    expect(steps.has('custom-step-name')).toBe(true);
    expect(steps.has('processOrder')).toBe(false);
  });

  it('should throw on duplicate step names', () => {
    const { t, aether } = createAetherTrpc({
      serverUrl: 'localhost:7233',
      serviceName: 'test-service',
    });

    const handler1 = async ({ input }: { input: any }) => input;
    const handler2 = async ({ input }: { input: any }) => input;
    const procedure1 = (t.procedure as any).mutationStep('same-name', handler1);
    const procedure2 = (t.procedure as any).mutationStep('same-name', handler2);

    const router = {
      _def: {
        procedures: {
          order1: procedure1,
          order2: procedure2,
        },
      },
    };

    expect(() => aether.bindRouter(router as any)).toThrow(/Duplicate step name/);
  });

  it('should support multiple bindRouter calls', () => {
    const { t, aether } = createAetherTrpc({
      serverUrl: 'localhost:7233',
      serviceName: 'test-service',
    });

    const handler1 = async ({ input }: { input: any }) => input;
    const handler2 = async ({ input }: { input: any }) => input;

    const router1 = {
      _def: {
        procedures: {
          step1: (t.procedure as any).mutationStep(handler1),
        },
      },
    };

    const router2 = {
      _def: {
        procedures: {
          step2: (t.procedure as any).mutationStep(handler2),
        },
      },
    };

    aether.bindRouter(router1 as any);
    aether.bindRouter(router2 as any);

    const steps = aether.getSteps();
    expect(steps.size).toBe(2);
    expect(steps.has('step1')).toBe(true);
    expect(steps.has('step2')).toBe(true);
  });

  it('should not register procedures without step methods', () => {
    const { t, aether } = createAetherTrpc({
      serverUrl: 'localhost:7233',
      serviceName: 'test-service',
    });

    // Create a regular procedure without step metadata (simulating t.procedure.query())
    const regularProcedure = { _def: {} };

    const router = {
      _def: {
        procedures: {
          health: regularProcedure,
        },
      },
    };

    aether.bindRouter(router as any);

    const steps = aether.getSteps();
    expect(steps.size).toBe(0);
  });

  it('should handle nested routers with prefix', () => {
    const { t, aether } = createAetherTrpc({
      serverUrl: 'localhost:7233',
      serviceName: 'test-service',
    });

    const handler = async ({ input }: { input: any }) => input;
    const procedure = (t.procedure as any).mutationStep(handler);

    const nestedRouter = {
      _def: {
        procedures: {
          create: procedure,
        },
      },
    };

    const mainRouter = {
      _def: {
        procedures: {
          orders: nestedRouter,
        },
      },
    };

    aether.bindRouter(mainRouter as any);

    const steps = aether.getSteps();
    expect(steps.has('orders.create')).toBe(true);
  });

  it('should use explicit name even in nested routers', () => {
    const { t, aether } = createAetherTrpc({
      serverUrl: 'localhost:7233',
      serviceName: 'test-service',
    });

    const handler = async ({ input }: { input: any }) => input;
    const procedure = (t.procedure as any).mutationStep('explicit-create', handler);

    const nestedRouter = {
      _def: {
        procedures: {
          create: procedure,
        },
      },
    };

    const mainRouter = {
      _def: {
        procedures: {
          orders: nestedRouter,
        },
      },
    };

    aether.bindRouter(mainRouter as any);

    const steps = aether.getSteps();
    expect(steps.has('explicit-create')).toBe(true);
    expect(steps.has('orders.create')).toBe(false);
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

describe('StepMeta types', () => {
  it('should have AETHER_STEP_META symbol exported', () => {
    expect(typeof AETHER_STEP_META).toBe('symbol');
  });
});
