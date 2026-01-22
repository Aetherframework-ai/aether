import { Injectable } from "@nestjs/common";
import { initTRPC } from "@trpc/server";

@Injectable()
export class TrpcService {
  private readonly trpc = initTRPC.create();

  get procedure() {
    return this.trpc.procedure;
  }

  get router() {
    return this.trpc.router;
  }
}
