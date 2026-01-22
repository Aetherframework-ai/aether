import { Module } from "@nestjs/common";
import { TrpcModule } from "./trpc/trpc.module";

@Module({
  imports: [TrpcModule],
})
export class AppModule {}
