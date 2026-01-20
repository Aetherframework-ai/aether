import { Client } from './client';

export class Workflow<T> {
  private fn: any;

  constructor(
    private client: Client,
    private name: string,
    fn: any
  ) {
    this.fn = fn;
  }

  async start(...args: any[]) {
    const request = {
      workflowType: this.name,
      input: JSON.stringify(args),
    };

    const response = await this.client.startWorkflow(request);
    return response.workflowId;
  }

  async startAndWait(...args: any[]) {
    const workflowId = await this.start(...args);
    return await this.client.awaitResult(workflowId);
  }
}
