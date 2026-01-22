import { Injectable } from "@nestjs/common";
import { initTRPC } from "@trpc/server";

export interface AetherStepOptions {
  timeout?: number;
  retryable?: boolean;
  maxRetries?: number;
}

export interface AetherActivityOptions {
  timeout?: number;
  singleton?: boolean;
  taskQueue?: string;
}

export interface RegisteredStep {
  name: string;
  type: "step" | "activity";
  handler: (...args: any[]) => any;
  options?: AetherStepOptions | AetherActivityOptions;
}

@Injectable()
export class TrpcService {
  private readonly trpc = initTRPC.create();
  private readonly aetherSteps = new Map<string, RegisteredStep>();

  get procedure() {
    return this.trpc.procedure;
  }

  get router() {
    return this.trpc.router;
  }

  /**
   * Create an Aether Step procedure - tRPC endpoint that is also registered as an Aether step
   * @param name - The step name for Aether registration
   * @param options - Optional step configuration
   */
  aetherStep(name: string, options?: AetherStepOptions) {
    const service = this;
    const baseProcedure = this.trpc.procedure;

    return {
      input: <T>(schema: T) => ({
        mutation: <R>(handler: (opts: { input: T extends { parse: (input: any) => infer U } ? U : T }) => R) => {
          service.aetherSteps.set(name, {
            name,
            type: "step",
            handler: (input: any) => handler({ input }),
            options,
          });
          return (baseProcedure.input(schema as any) as any).mutation(handler);
        },
        query: <R>(handler: (opts: { input: T extends { parse: (input: any) => infer U } ? U : T }) => R) => {
          service.aetherSteps.set(name, {
            name,
            type: "step",
            handler: (input: any) => handler({ input }),
            options,
          });
          return (baseProcedure.input(schema as any) as any).query(handler);
        },
      }),
      mutation: <R>(handler: () => R) => {
        service.aetherSteps.set(name, {
          name,
          type: "step",
          handler: () => handler(),
          options,
        });
        return baseProcedure.mutation(handler);
      },
      query: <R>(handler: () => R) => {
        service.aetherSteps.set(name, {
          name,
          type: "step",
          handler: () => handler(),
          options,
        });
        return baseProcedure.query(handler);
      },
    };
  }

  /**
   * Create an Aether Activity procedure - tRPC endpoint that is also registered as an Aether activity
   * @param name - The activity name for Aether registration
   * @param options - Optional activity configuration
   */
  aetherActivity(name: string, options?: AetherActivityOptions) {
    const service = this;
    const baseProcedure = this.trpc.procedure;

    return {
      input: <T>(schema: T) => ({
        mutation: <R>(handler: (opts: { input: T extends { parse: (input: any) => infer U } ? U : T }) => R) => {
          service.aetherSteps.set(name, {
            name,
            type: "activity",
            handler: (input: any) => handler({ input }),
            options,
          });
          return (baseProcedure.input(schema as any) as any).mutation(handler);
        },
        query: <R>(handler: (opts: { input: T extends { parse: (input: any) => infer U } ? U : T }) => R) => {
          service.aetherSteps.set(name, {
            name,
            type: "activity",
            handler: (input: any) => handler({ input }),
            options,
          });
          return (baseProcedure.input(schema as any) as any).query(handler);
        },
      }),
      mutation: <R>(handler: () => R) => {
        service.aetherSteps.set(name, {
          name,
          type: "activity",
          handler: () => handler(),
          options,
        });
        return baseProcedure.mutation(handler);
      },
      query: <R>(handler: () => R) => {
        service.aetherSteps.set(name, {
          name,
          type: "activity",
          handler: () => handler(),
          options,
        });
        return baseProcedure.query(handler);
      },
    };
  }

  /**
   * Get all registered Aether steps and activities
   */
  getAetherSteps(): Map<string, RegisteredStep> {
    return this.aetherSteps;
  }
}
