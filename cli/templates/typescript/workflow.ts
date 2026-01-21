import { aether } from '@aether/sdk';

const {{ workflow_name }} = aether.workflow('{{ workflow_name }}', async (ctx, input: {{ input_type }}) => {
  // TODO: 实现工作流逻辑
  const result = await ctx.step('step-1', async () => {
    return { message: 'Hello' };
  });

  return result;
});

export { {{ workflow_name }} };
