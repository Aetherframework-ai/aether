import { AetherClient, Workflow, WorkflowContext } from '../../src/index';

describe('Aether Integration Tests', () => {
  let client: AetherClient;
  
  beforeAll(async () => {
    client = new AetherClient({
      serverUrl: 'http://localhost:7233',
    });
  });

  describe('Workflow Lifecycle', () => {
    it('should create and start a workflow', async () => {
      const workflow = client.workflow('test-workflow', async (ctx: WorkflowContext, input: string) => {
        const step1Result = await ctx.step('step1', async () => {
          return `processed-${input}`;
        });
        
        const step2Result = await ctx.step('step2', async () => {
          return `finalized-${step1Result}`;
        });
        
        return { step1: step1Result, step2: step2Result };
      });
      
      const workflowId = await workflow.start('test-input');
      expect(workflowId).toBeTruthy();
      expect(typeof workflowId).toBe('string');
    });

    it('should handle parallel workflow execution', async () => {
      const parallelWorkflow = client.workflow('parallel-workflow', async (ctx: WorkflowContext, count: number) => {
        const tasks = Array.from({ length: count }, (_, i) => 
          () => ctx.step(`task-${i}`, async () => `result-${i}`)
        );
        
        const results = await ctx.parallel(tasks);
        return { results };
      });
      
      const workflowId = await parallelWorkflow.start(3);
      expect(workflowId).toBeTruthy();
    });

    it('should start and wait for workflow completion', async () => {
      const workflow = client.workflow('wait-workflow', async (ctx: WorkflowContext) => {
        const step1 = await ctx.step('step1', async () => 'step1-result');
        return { step1 };
      });
      
      const result = await workflow.startAndWait();
      expect(result).toBeDefined();
    });
  });
});
