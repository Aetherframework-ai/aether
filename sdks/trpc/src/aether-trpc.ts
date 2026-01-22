import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import * as path from 'path';
import { AetherTrpcConfig, StepHandler, RegisteredStep, StepRegistry } from './types';

const PROTO_PATH = path.resolve(__dirname, '../../../proto/aether.proto');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: false,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const aetherProto = grpc.loadPackageDefinition(packageDefinition) as any;

class GrpcClient {
  private workerService: any;
  private serverUrl: string;

  constructor(serverUrl: string) {
    this.serverUrl = serverUrl;
    const url = serverUrl.replace(/^https?:\/\//, '');
    this.workerService = new aetherProto.aether.v1.WorkerService(
      url,
      grpc.credentials.createInsecure()
    );
  }

  async register(request: {
    workerId: string;
    serviceName: string;
    group: string;
    language: string[];
    provides: Array<{ name: string; type: number }>;
  }): Promise<{ serverId: string }> {
    return new Promise((resolve, reject) => {
      this.workerService.register(request, (error: any, response: any) => {
        if (error) {
          reject(error);
        } else {
          resolve({ serverId: response.serverId });
        }
      });
    });
  }

  async pollTasksOnce(workerId: string, maxTasks: number): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const tasks: any[] = [];
      const call = this.workerService.pollTasks({ workerId, maxTasks });

      call.on('data', (task: any) => {
        let input = null;
        if (task.input?.length > 0) {
          try {
            input = JSON.parse(task.input.toString());
          } catch {
            input = task.input;
          }
        }
        tasks.push({ ...task, input });
      });

      call.on('error', (error: any) => {
        if (error.code === 1) {
          resolve(tasks);
        } else {
          reject(error);
        }
      });

      call.on('end', () => {
        resolve(tasks);
      });
    });
  }

  async completeStep(taskId: string, result: any, error?: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const grpcRequest = {
        taskId,
        result: Buffer.from(JSON.stringify(result)),
        error: error || '',
      };

      this.workerService.completeStep(grpcRequest, (err: any, response: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(response.success);
        }
      });
    });
  }

  async reportStepStarted(workflowId: string, stepName: string, input: any): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const grpcRequest = {
        workflowId,
        stepName,
        status: 0,
        input: Buffer.from(JSON.stringify(input || {})),
        output: Buffer.alloc(0),
        error: '',
      };

      this.workerService.reportStep(grpcRequest, (err: any, response: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(response.success);
        }
      });
    });
  }

  async reportStepCompleted(workflowId: string, stepName: string, output: any): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const grpcRequest = {
        workflowId,
        stepName,
        status: 1,
        input: Buffer.alloc(0),
        output: Buffer.from(JSON.stringify(output || {})),
        error: '',
      };

      this.workerService.reportStep(grpcRequest, (err: any, response: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(response.success);
        }
      });
    });
  }

  async reportStepFailed(workflowId: string, stepName: string, error: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const grpcRequest = {
        workflowId,
        stepName,
        status: 2,
        input: Buffer.alloc(0),
        output: Buffer.alloc(0),
        error,
      };

      this.workerService.reportStep(grpcRequest, (err: any, response: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(response.success);
        }
      });
    });
  }
}

export class AetherTrpc {
  private client: GrpcClient | null = null;
  private steps: StepRegistry = new Map();
  private workerId: string;
  private config: AetherTrpcConfig;
  private isRunning = false;
  private pollingInterval: number = 200;
  private pollingLoop: Promise<void> | null = null;

  constructor(config: AetherTrpcConfig) {
    this.config = config;
    this.workerId = config.workerId || `trpc-worker-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    if (config.pollingInterval) {
      this.pollingInterval = config.pollingInterval;
    }
  }

  step<T = unknown, U = unknown>(name: string, handler: StepHandler<T, U>): void {
    this.steps.set(name, {
      name,
      handler: handler as StepHandler,
    });
  }

  async serve(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.client = new GrpcClient(this.config.serverUrl);

    const provides = Array.from(this.steps.values()).map((step) => ({
      name: step.name,
      type: 1,
    }));

    try {
      await this.client.register({
        workerId: this.workerId,
        serviceName: this.config.serviceName,
        group: this.config.group || 'default',
        language: ['typescript', 'trpc'],
        provides,
      });
    } catch (error: any) {
      throw new Error(`Failed to register worker: ${error.message}`);
    }

    this.isRunning = true;
    this.startPolling();
  }

  private startPolling(): void {
    const runLoop = async () => {
      const maxTasks = 10;

      while (this.isRunning && this.client) {
        try {
          const tasks = await this.client.pollTasksOnce(this.workerId, maxTasks);

          for (const task of tasks) {
            await this.handleTask(task);
          }

          await new Promise((resolve) => setTimeout(resolve, this.pollingInterval));
        } catch (error: any) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    };

    this.pollingLoop = runLoop();
  }

  private async handleTask(task: any): Promise<void> {
    const { taskId, stepName, workflowId, input } = task;

    try {
      const registeredStep = this.steps.get(stepName);

      if (!registeredStep) {
        if (stepName === 'start') {
          await this.client!.completeStep(taskId, { started: true });
          return;
        }

        await this.client!.completeStep(
          taskId,
          {},
          `No handler for step: ${stepName}`
        );
        return;
      }

      await this.client!.reportStepStarted(workflowId, stepName, input);

      const result = await registeredStep.handler({ input });

      await this.client!.reportStepCompleted(workflowId, stepName, result);

      await this.client!.completeStep(taskId, result);
    } catch (error: any) {
      try {
        await this.client!.reportStepFailed(workflowId, stepName, error.message);
        await this.client!.completeStep(taskId, {}, error.message);
      } catch (reportError: any) {
        console.error(`Failed to report error: ${reportError.message}`);
      }
    }
  }

  stop(): void {
    this.isRunning = false;
  }

  getSteps(): StepRegistry {
    return this.steps;
  }

  getWorkerId(): string {
    return this.workerId;
  }
}

export function createAetherTrpc(config: AetherTrpcConfig): AetherTrpc {
  return new AetherTrpc(config);
}
