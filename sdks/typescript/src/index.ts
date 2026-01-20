import { Client } from './client';
import { Workflow } from './workflow';

export interface AetherConfig {
  serverUrl: string;
  workerId?: string;
}

export class AetherClient {
  private client: Client;

  constructor(config: AetherConfig) {
    this.client = new Client(config.serverUrl);
  }

  workflow<T extends Record<string, any>>(name: string, fn: WorkflowFunction<T>) {
    return new Workflow<T>(this.client, name, fn);
  }

  async serve(workflows: Workflow<any>[]) {
    console.log('Starting Aether server...');
    console.log(`Registered ${workflows.length} workflows`);
  }
}

type WorkflowFunction<T> = (ctx: WorkflowContext, ...args: any[]) => Promise<T>;

export interface WorkflowContext {
  step: <T>(name: string, fn: () => Promise<T>) => Promise<T>;
  parallel: <T>(steps: (() => Promise<T>)[]) => Promise<T[]>;
  sleep: (name: string, duration: { minutes?: number; hours?: number; seconds?: number }) => Promise<void>;
  child: <T>(workflow: Workflow<T>, args: any[]) => Promise<T>;
}

export { Workflow } from './workflow';

export function aether(config: AetherConfig): AetherClient {
  return new AetherClient(config);
}

export default aether;
