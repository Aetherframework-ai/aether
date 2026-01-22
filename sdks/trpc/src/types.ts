import type { Client } from '@aetherframework.ai/sdk';

export interface AetherTrpcConfig {
  serverUrl: string;
  serviceName: string;
  group?: string;
  workerId?: string;
}

export interface StepHandler<T = any> {
  (opts: { input: T }): Promise<any> | any;
}

export interface RegisteredStep {
  name: string;
  handler: StepHandler;
}

export type StepRegistry = Map<string, RegisteredStep>;
