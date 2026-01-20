import * as grpc from 'grpc-web';

export class Client {
  private service: any;

  constructor(private serverUrl: string) {
    this.service = new grpc.GrpcWebClientBase();
  }

  async startWorkflow(request: { workflowType: string; input: string }) {
    return new Promise<{ workflowId: string }>((resolve, reject) => {
      setTimeout(() => {
        resolve({
          workflowId: `wf-${Date.now()}`,
        });
      }, 100);
    });
  }

  async awaitResult(workflowId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        resolve({ result: 'completed' });
      }, 1000);
    });
  }

  async getWorkflowStatus(workflowId: string) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        resolve({
          workflowId,
          state: 'COMPLETED',
          currentStep: '',
          result: '',
          error: '',
        });
      }, 100);
    });
  }
}
