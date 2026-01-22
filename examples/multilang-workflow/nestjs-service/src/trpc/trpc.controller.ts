import { All, Controller, Req, Res } from "@nestjs/common";
import { TrpcRouter } from "./trpc.router";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import type { Request, Response } from "express";

@Controller("trpc")
export class TrpcController {
  constructor(private readonly trpcRouter: TrpcRouter) {}

  @All("*")
  async handle(@Req() req: Request, @Res() res: Response) {
    const fetchReq = new Request(`http://localhost${req.url}`, {
      method: req.method,
      headers: req.headers as HeadersInit,
      body: req.method !== "GET" ? JSON.stringify(req.body) : undefined,
    });

    const response = await fetchRequestHandler({
      endpoint: "/trpc",
      req: fetchReq,
      router: this.trpcRouter.appRouter,
      createContext: () => ({}),
    });

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    res.send(await response.text());
  }
}
