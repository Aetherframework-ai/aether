import { Module } from "@nestjs/common";
import { TrpcService } from "./trpc.service";
import { TrpcRouter } from "./trpc.router";
import { TrpcController } from "./trpc.controller";
import { DemoService } from "../demo/demo.service";

@Module({
  controllers: [TrpcController],
  providers: [TrpcService, TrpcRouter, DemoService],
  exports: [TrpcService, TrpcRouter],
})
export class TrpcModule {}
