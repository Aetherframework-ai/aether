import { Injectable } from "@nestjs/common";
import { initTRPC } from "@trpc/server";
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
    this._appRouter = this.createRouter();
  }

  get appRouter() {
    return this._appRouter;
  }

  private createRouter() {
    const t = initTRPC.create();

    return t.router({
      health: t.procedure.query(() => ({
        status: "ok",
        service: "nestjs-demo",
        timestamp: new Date().toISOString(),
      })),

      demo: t.router({
        // tRPC endpoint that is also an Aether Step
        sync: t.procedure
          .input(z.object({ message: z.string() }))
          .mutation(
            this.trpcService.aetherStep("nestjs-sync-step")(
              async ({ input }: { input: { message: string } }) => {
                return this.demoService.syncStep(input);
              }
            )
          ),

        // tRPC endpoint that is also an Aether Step (for async)
        async: t.procedure
          .input(z.object({ message: z.string() }))
          .mutation(
            this.trpcService.aetherStep("nestjs-async-step")(
              async ({ input }: { input: { message: string } }) => {
                return this.demoService.asyncStep(input);
              }
            )
          ),
      }),
    });
  }
}

export type AppRouter = TrpcRouter["appRouter"];
