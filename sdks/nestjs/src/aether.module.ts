import { DynamicModule, Module, Provider, Type } from "@nestjs/common";
import { AETHER_CONFIG_TOKEN } from "./aether.constants";
import {
  AetherWorkerService,
  AetherWorkerConfig,
  AETHER_STEP_REGISTRY_TOKEN,
  RegisteredHandler,
} from "./providers/aether-worker.service";

export interface AetherModuleOptions extends AetherWorkerConfig {
  /**
   * Whether the module is global
   * @default false
   */
  isGlobal?: boolean;
}

export interface AetherModuleAsyncOptions {
  /**
   * Whether the module is global
   * @default false
   */
  isGlobal?: boolean;

  /**
   * Factory imports
   */
  imports?: any[];

  /**
   * Injection tokens to inject into the factory
   */
  inject?: any[];

  /**
   * Factory function to create the config
   */
  useFactory: (
    ...args: any[]
  ) => Promise<AetherWorkerConfig> | AetherWorkerConfig;
}

@Module({})
export class AetherModule {
  /**
   * Register the Aether module with static configuration
   * @param options - Aether module configuration
   */
  static forRoot(options: AetherModuleOptions): DynamicModule {
    const providers: Provider[] = [
      {
        provide: AETHER_CONFIG_TOKEN,
        useValue: options,
      },
      AetherWorkerService,
    ];

    return {
      module: AetherModule,
      global: options.isGlobal ?? false,
      providers,
      exports: [AetherWorkerService, AETHER_CONFIG_TOKEN],
    };
  }

  /**
   * Register the Aether module with async configuration
   * @param options - Async configuration options
   */
  static forRootAsync(options: AetherModuleAsyncOptions): DynamicModule {
    const providers: Provider[] = [
      {
        provide: AETHER_CONFIG_TOKEN,
        useFactory: options.useFactory,
        inject: options.inject || [],
      },
      AetherWorkerService,
    ];

    return {
      module: AetherModule,
      global: options.isGlobal ?? false,
      imports: options.imports || [],
      providers,
      exports: [AetherWorkerService, AETHER_CONFIG_TOKEN],
    };
  }

  /**
   * Register the Aether module with a TrpcService that has aetherStep handlers
   * This method collects handlers from TrpcService and registers them with the worker
   *
   * @param options - Aether module configuration
   * @param trpcServiceClass - The TrpcService class to collect handlers from
   */
  static forRootWithTrpc(
    options: AetherModuleOptions,
    trpcServiceClass: Type<any>
  ): DynamicModule {
    const providers: Provider[] = [
      {
        provide: AETHER_CONFIG_TOKEN,
        useValue: options,
      },
      {
        provide: AETHER_STEP_REGISTRY_TOKEN,
        useFactory: (trpcService: any) => {
          // Get registered steps from TrpcService
          if (typeof trpcService.getAetherSteps === "function") {
            const steps = trpcService.getAetherSteps();
            const handlers = new Map<string, RegisteredHandler>();

            steps.forEach((step: any, name: string) => {
              handlers.set(name, {
                name,
                type: step.type || "step",
                handler: step.handler,
                options: step.options,
              });
            });

            return handlers;
          }
          return new Map();
        },
        inject: [trpcServiceClass],
      },
      AetherWorkerService,
    ];

    return {
      module: AetherModule,
      global: options.isGlobal ?? false,
      providers,
      exports: [AetherWorkerService, AETHER_CONFIG_TOKEN],
    };
  }
}
