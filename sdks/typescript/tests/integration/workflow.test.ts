import { AetherClient, WorkflowContext } from '../../src/index';

describe('Workflow Tests', () => {
  let client: AetherClient;

  beforeAll(() => {
    client = new AetherClient({
      serverUrl: 'http://localhost:7233',
    });
  });

  it('should create a workflow with multiple steps', async () => {
    const multiStepWorkflow = client.workflow('multi-step', async (ctx: WorkflowContext) => {
      const step1 = await ctx.step('step1', async () => 'step1-result');
      const step2 = await ctx.step('step2', async () => 'step2-result');
      const step3 = await ctx.step('step3', async () => 'step3-result');
      return { step1, step2, step3 };
    });

    const workflowId = await multiStepWorkflow.start();
    expect(workflowId).toBeTruthy();
    expect(typeof workflowId).toBe('string');
  });

  it('should start and wait for workflow result', async () => {
    const testWorkflow = client.workflow('test-workflow', async (ctx: WorkflowContext) => {
      const step1 = await ctx.step('step1', async () => 'step1-result');
      return { step1 };
    });

    const result = await testWorkflow.startAndWait();
    expect(result).toBeDefined();
  });

  it('should handle workflow with input parameters', async () => {
    const paramWorkflow = client.workflow('param-workflow', async (ctx: WorkflowContext, input: string) => {
      const step1 = await ctx.step('step1', async () => `processed-${input}`);
      return { step1, input };
    });

    const workflowId = await paramWorkflow.start('test-input');
    expect(workflowId).toBeTruthy();

    const result = await paramWorkflow.startAndWait('test-input');
    expect(result).toBeDefined();
  });
});
