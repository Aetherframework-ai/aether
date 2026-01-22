import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { createAetherTrpc, AetherTrpc, StepHandler } from "@aetherframework.ai/trpc";

@Injectable()
export class TrpcService implements OnModuleDestroy {
  private readonly aether: AetherTrpc;

  constructor() {
    this.aether = createAetherTrpc({
      serverUrl: process.env.AETHER_SERVER_URL || "http://localhost:7233",
      serviceName: "nestjs-demo-service",
      group: "default",
    });
  }

  /**
   * Create an Aether Step procedure - tRPC endpoint that is also registered as an Aether step
   * @param name - The step name for Aether registration
   * @param handler - The step handler function
   */
  aetherStep<T = any>(name: string, handler: StepHandler<T>): StepHandler<T> {
    return this.aether.step(name, handler);
  }

  getAetherTrpc(): AetherTrpc {
    return this.aether;
  }

  async serve(): Promise<void> {
    await this.aether.serve();
    console.log("[TrpcService] Aether worker started");
  }

  stop(): void {
    this.aether.stop();
    console.log("[TrpcService] Aether worker stopped");
  }

  onModuleDestroy(): void {
    this.stop();
  }
}
