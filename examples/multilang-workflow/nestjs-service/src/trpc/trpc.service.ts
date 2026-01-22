import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { createAetherTrpc, AetherTrpc } from "@aetherframework.ai/trpc";

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

  get procedure() {
    return this.aether;
  }

  /**
   * Get the AetherTrpc instance for serving
   */
  getAetherTrpc(): AetherTrpc {
    return this.aether;
  }

  /**
   * Create an Aether Step procedure - tRPC endpoint that is also registered as an Aether step
   * @param name - The step name for Aether registration
   */
  aetherStep(name: string) {
    return this.aether.step(name);
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
