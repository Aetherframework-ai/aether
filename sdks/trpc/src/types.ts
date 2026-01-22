export interface AetherTrpcConfig {
  serverUrl: string;
  serviceName: string;
  group?: string;
  workerId?: string;
}

export interface StepHandler<TInput = unknown, TOutput = unknown> {
  (opts: { input: TInput }): Promise<TOutput> | TOutput;
}

export interface RegisteredStep {
  name: string;
  handler: StepHandler;
}

export type StepRegistry = Map<string, RegisteredStep>;
