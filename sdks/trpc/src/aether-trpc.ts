import { Client } from '@aetherframework.ai/sdk';
import {
  AetherTrpcConfig,
  StepHandler,
  RegisteredStep,
  StepRegistry,
} from './types';

export class AetherTrpc {
  private client: Client;
  private steps: StepRegistry = new Map();
  private workerId: string;
  private config: AetherTrpcConfig;
  private isRunning = false;
  private pollingInterval?: NodeJS.Timeout;

  constructor(config: AetherTrpcConfig) {
    this.config = config;
    this.client = new Client(config.serverUrl);
    this.workerId = config.workerId || `trpc-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  step<T = any>(name: string, handler: StepHandler<T>): StepHandler<T> {
    this.steps.set(name, { name, handler });
    return handler;
  }

  async serve(): Promise<void> {
    if (this.isRunning) {
      console.warn('[AetherTrpc] Worker is already running');
      return;
    }

    // 1. 注册 worker
    await this.client.register({
      workerId: this.workerId,
      serviceName: this.config.serviceName,
      group: this.config.group || 'default',
      language: ['typescript', 'trpc'],
      provides: Array.from(this.steps.values()).map((s) => ({
        name: s.name,
        type: 1, // ResourceType.STEP
      })),
    });

    // 2. 启动 polling 循环
    this.isRunning = true;
    this.startPolling();
  }

  private startPolling(): void {
    this.pollingInterval = setInterval(async () => {
      if (!this.isRunning) return;

      try {
        const tasks = await this.client.pollTasksOnce(this.workerId, 10);

        for (const task of tasks) {
          await this.handleTask(task);
        }
      } catch (error: any) {
        console.error('[AetherTrpc] Polling error:', error.message);
      }
    }, 200);
  }

  private async handleTask(task: any): Promise<void> {
    const step = this.steps.get(task.stepName);
    if (!step) {
      console.error(`[AetherTrpc] No handler for step: ${task.stepName}`);
      await this.client.completeStep(task.taskId, {}, `No handler: ${task.stepName}`);
      return;
    }

    try {
      await this.client.reportStepStarted(task.workflowId, task.stepName, task.input);
      const result = await step.handler({ input: task.input });
      await this.client.reportStepCompleted(task.workflowId, task.stepName, result);
      await this.client.completeStep(task.taskId, result);
    } catch (error: any) {
      await this.client.reportStepFailed(task.workflowId, task.stepName, error.message);
      await this.client.completeStep(task.taskId, {}, error.message);
    }
  }

  stop(): void {
    this.isRunning = false;
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = undefined;
    }
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
