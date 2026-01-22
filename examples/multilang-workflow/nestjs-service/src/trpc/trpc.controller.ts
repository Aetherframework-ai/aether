import { All, Controller, Req, Res } from "@nestjs/common";
import { TrpcRouter } from "./trpc.router";
import { TrpcService } from "./trpc.service";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import type { Request as ExpressRequest, Response } from "express";

@Controller("trpc")
export class TrpcController {
  constructor(
    private readonly trpcRouter: TrpcRouter,
    private readonly trpcService: TrpcService,
  ) {}

  @All("*")
  async handle(@Req() req: ExpressRequest, @Res() res: Response) {
    const fetchReq = new Request(`http://localhost${req.url}`, {
      method: req.method,
      headers: req.headers as HeadersInit,
      body: req.method !== "GET" ? JSON.stringify(req.body) : undefined,
    });

    // Extract step name from URL path (e.g., /trpc/demo.sync -> demo.sync)
    const stepName = req.url.replace(/^\/trpc\//, '').split('?')[0];

    const response = await fetchRequestHandler({
      endpoint: "/trpc",
      req: fetchReq,
      router: this.trpcRouter.appRouter,
      createContext: () => ({
        __aetherClient: this.trpcService.aether.getClient(),
        __aetherConfig: this.trpcService.aether.getConfig(),
        __stepName: stepName,
      }),
    });

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    res.send(await response.text());
  }
}
