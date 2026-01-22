import { Injectable } from "@nestjs/common";
import { TrpcService } from "./trpc.service";
import { DemoService } from "../demo/demo.service";
import { z } from "zod";

@Injectable()
export class TrpcRouter {
  private readonly _appRouter: ReturnType<typeof this.createRouter>;

  constructor(
    private readonly trpcService: TrpcService,
    private readonly demoService: DemoService
  ) {
    // Initialize router in constructor to ensure Aether steps are registered
    // before AetherWorkerService collects them
    this._appRouter = this.createRouter();
  }

  get appRouter() {
    return this._appRouter;
  }

  private createRouter() {
    const t = this.trpcService;
    return t.router({
      // Standard tRPC endpoint
      health: t.procedure.query(() => ({
        status: "ok",
        service: "nestjs-demo",
        timestamp: new Date().toISOString(),
      })),

      demo: t.router({
        // tRPC endpoint that is also an Aether Step
        sync: t
          .aetherStep("nestjs-sync-step")
          .input(z.object({ message: z.string() }))
          .mutation(({ input }) => this.demoService.syncStep(input)),

        // tRPC endpoint that is also an Aether Activity
        async: t
          .aetherActivity("nestjs-async-step", { timeout: 5000 })
          .input(z.object({ message: z.string() }))
          .mutation(({ input }) => this.demoService.asyncStep(input)),
      }),
    });
  }
}

export type AppRouter = TrpcRouter["appRouter"];
