export interface AetherTrpcConfig {
  serverUrl: string;
  serviceName: string;
  group?: string;
  workerId?: string;
  /** Fallback behavior when Aether server is unavailable */
  fallbackOnError?: 'error' | 'local' | 'warn';
}

export interface StepHandler<T = any> {
  (opts: { input: T; ctx?: any }): Promise<any> | any;
}

export interface RegisteredStep {
  name: string;
  handler: StepHandler;
}

export type StepRegistry = Map<string, RegisteredStep>;

export const AETHER_STEP_META = Symbol('aether-step-meta');

export interface StepMeta {
  explicitName?: string;
  handler: StepHandler;
  type: 'mutation' | 'query';
}

export interface RegisteredStepWithPath extends RegisteredStep {
  path: string;
}
