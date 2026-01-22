import { Injectable } from "@nestjs/common";

@Injectable()
export class DemoService {
  syncStep(input: { message: string }) {
    console.log(`[NestJS] Sync step: ${input.message}`);
    return {
      source: "nestjs",
      type: "sync",
      message: input.message,
      timestamp: Date.now(),
    };
  }

  async asyncStep(input: { message: string }) {
    await new Promise((r) => setTimeout(r, 500));
    console.log(`[NestJS] Async step: ${input.message}`);
    return {
      source: "nestjs",
      type: "async",
      message: input.message,
      timestamp: Date.now(),
    };
  }
}
