import { Module } from "@nestjs/common";
import { AetherDemoService } from "./aether.service";

@Module({
  providers: [AetherDemoService],
  exports: [AetherDemoService],
})
export class AetherModule {}
