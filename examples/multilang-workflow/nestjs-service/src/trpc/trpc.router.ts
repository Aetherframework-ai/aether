import { Injectable } from "@nestjs/common";
import { TrpcService } from "./trpc.service";

@Injectable()
export class TrpcRouter {
  constructor(private readonly trpcService: TrpcService) {}

  get appRouter() {
    const t = this.trpcService;
    return t.router({
      health: t.procedure.query(() => ({
        status: "ok",
        service: "nestjs-demo",
        timestamp: new Date().toISOString(),
      })),
    });
  }
}

export type AppRouter = TrpcRouter["appRouter"];
