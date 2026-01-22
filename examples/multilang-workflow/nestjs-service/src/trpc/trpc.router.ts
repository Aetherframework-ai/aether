import { Injectable } from "@nestjs/common";
import { TrpcService } from "./trpc.service";
import { AetherDemoService } from "../aether/aether.service";
import { z } from "zod";

@Injectable()
export class TrpcRouter {
  constructor(
    private readonly trpcService: TrpcService,
    private readonly aetherDemo: AetherDemoService
  ) {}

  get appRouter() {
    const t = this.trpcService;
    return t.router({
      health: t.procedure.query(() => ({
        status: "ok",
        service: "nestjs-demo",
        timestamp: new Date().toISOString(),
      })),
      demo: t.router({
        sync: t.procedure
          .input(z.object({ message: z.string() }))
          .mutation(({ input }) => this.aetherDemo.syncStep(input)),
        async: t.procedure
          .input(z.object({ message: z.string() }))
          .mutation(({ input }) => this.aetherDemo.asyncStep(input)),
      }),
    });
  }
}

export type AppRouter = TrpcRouter["appRouter"];
