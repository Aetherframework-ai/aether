import { Client } from './client';
import { AetherConfig, ActivityOptions } from './index';

export class Workflow<T> {
  private fn: any;
  private config: AetherConfig;
  private stepHandlers: Map<string, (input: any) => Promise<any>> = new Map();

  constructor(
    private client: Client,
    private name: string,
    fn: any,
    config: AetherConfig
  ) {
    this.fn = fn;
    this.config = config;
  }

  getName(): string {
    return this.name;
  }

  async start(...args: any[]): Promise<string> {
    const request = {
      workflowType: this.name,
      input: args[0], // 传第一个参数作为input
    };

    const response = await this.client.startWorkflow(request);
    return response.workflowId;
  }

  async startAndWait(...args: any[]): Promise<T> {
    const workflowId = await this.start(...args);
    const result = await this.client.awaitResult(workflowId);
    return result;
  }

  // 创建workflow上下文用于本地执行
  private createContext(): any {
    const self = this;

    return {
      // 执行本地step
      step: async function<R>(name: string, fn: () => Promise<R>): Promise<R> {
        console.log(`[Workflow] Executing step: ${name}`);
        const result = await fn();
        console.log(`[Workflow] Step ${name} completed`);
        return result;
      },

      // 并行执行
      parallel: async function<R>(steps: (() => Promise<R>)[]): Promise<R[]> {
        return await Promise.all(steps.map(s => s()));
      },

      // 暂停执行
      sleep: async function(duration: { minutes?: number; hours?: number; seconds?: number }) {
        const ms = (duration.minutes || 0) * 60000 +
                   (duration.hours || 0) * 3600000 +
                   (duration.seconds || 0) * 1000;
        await new Promise(resolve => setTimeout(resolve, ms));
      },
    };
  }

  // 在本地执行workflow（用于worker模式）
  async executeLocally(...args: any[]): Promise<T> {
    const ctx = this.createContext();
    return await this.fn(ctx, ...args);
  }
}
