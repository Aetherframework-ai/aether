import { Module } from "@nestjs/common";
import { TrpcModule } from "./trpc/trpc.module";
import { AetherModule } from "./aether/aether.module";

@Module({
  imports: [TrpcModule, AetherModule],
})
export class AppModule {}
