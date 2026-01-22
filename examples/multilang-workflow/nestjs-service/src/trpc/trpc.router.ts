import { Injectable } from "@nestjs/common";
import { initTRPC } from "@trpc/server";
import { TrpcService } from "./trpc.service";
import { DemoService } from "../demo/demo.service";
import { z } from "zod";

const PYTHON_URL = "http://localhost:3002";

@Injectable()
export class TrpcRouter {
	private readonly _appRouter: ReturnType<typeof this.createRouter>;

	constructor(private readonly trpcService: TrpcService) {
		this._appRouter = this.createRouter();
	}

	get appRouter() {
		return this._appRouter;
	}

	private createRouter() {
		const t = initTRPC.create();

		return t.router({
			health: t.procedure.query(() => ({
				status: "ok",
				service: "nestjs-demo",
				timestamp: new Date().toISOString(),
			})),

			demo: t.router({
				// tRPC endpoint - sync step
				sync: t.procedure
					.input(
						z.object({
							message: z.string(),
							callPython: z.boolean().optional().default(false),
						}),
					)
					.mutation(async ({ input }) => {
						console.log("sync step", input);
					}),

				// tRPC endpoint - async step
				async: t.procedure
					.input(
						z.object({
							message: z.string(),
							callPython: z.boolean().optional().default(false),
						}),
					)
					.mutation(async ({ input }) => {
						console.log("async step", input);
					}),
			}),
		});
	}
}

export type AppRouter = TrpcRouter["appRouter"];
