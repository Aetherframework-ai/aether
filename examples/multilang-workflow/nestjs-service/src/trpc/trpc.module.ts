import { Module } from "@nestjs/common";
import { TrpcService } from "./trpc.service";
import { TrpcRouter } from "./trpc.router";
import { TrpcController } from "./trpc.controller";
import { AetherModule } from "@aetherframework.ai/nestjs";
import { DemoService } from "../demo/demo.service";

@Module({
  imports: [
    AetherModule.forRootWithTrpc(
      {
        serverUrl: process.env.AETHER_SERVER_URL || "localhost:7233",
        serviceName: "nestjs-demo",
        group: "default",
        autoServe: process.env.AETHER_WORKER_ENABLED === "true",
      },
      TrpcService
    ),
  ],
  controllers: [TrpcController],
  providers: [TrpcService, TrpcRouter, DemoService],
  exports: [TrpcService, TrpcRouter],
})
export class TrpcModule {}
