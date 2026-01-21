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
  private createContext(workflowId: string): any {
    const self = this;

    return {
      // 执行本地step，并向服务器报告状态
      step: async function<R>(name: string, fn: () => Promise<R>): Promise<R> {
        console.log(`[Workflow] Executing step: ${name}`);

        // 报告 step 开始
        try {
          await self.client.reportStepStarted(workflowId, name, {});
        } catch (e) {
          console.warn(`[Workflow] Failed to report step started: ${e}`);
        }

        try {
          const result = await fn();
          console.log(`[Workflow] Step ${name} completed`);

          // 报告 step 完成
          try {
            await self.client.reportStepCompleted(workflowId, name, result);
          } catch (e) {
            console.warn(`[Workflow] Failed to report step completed: ${e}`);
          }

          return result;
        } catch (error: any) {
          console.error(`[Workflow] Step ${name} failed:`, error.message);

          // 报告 step 失败
          try {
            await self.client.reportStepFailed(workflowId, name, error.message || String(error));
          } catch (e) {
            console.warn(`[Workflow] Failed to report step failed: ${e}`);
          }

          throw error;
        }
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
  async executeLocally(workflowId: string, ...args: any[]): Promise<T> {
    const ctx = this.createContext(workflowId);
    return await this.fn(ctx, ...args);
  }
}
