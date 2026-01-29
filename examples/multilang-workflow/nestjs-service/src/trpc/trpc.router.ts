import { Injectable, OnModuleInit } from "@nestjs/common";
import { TrpcService } from "./trpc.service";
import { z } from "zod";
import type { AnyRouter } from "@trpc/server";

@Injectable()
export class TrpcRouter implements OnModuleInit {
	private readonly _appRouter: AnyRouter;

	constructor(private readonly trpcService: TrpcService) {
		this._appRouter = this.createRouter();
	}

	get appRouter(): AnyRouter {
		return this._appRouter;
	}

	async onModuleInit() {
		// Bind router (but don't start worker yet - let main.ts control that)
		this.trpcService.aether.bindRouter(this._appRouter);
		console.log("[TrpcRouter] Router bound to Aether");
	}

	private createRouter() {
		const { t } = this.trpcService;

		return t.router({
			health: t.procedure.query(() => ({
				status: "ok",
				service: "nestjs-demo",
				timestamp: new Date().toISOString(),
			})),

			demo: t.router({
				// mutationStep - auto-inferred name: 'demo.sync'
				sync: t.procedure
					.input(
						z.object({
							message: z.string(),
							callPython: z.boolean().optional().default(false),
						}),
					)
					.mutationStep(async ({ input }) => {
						console.log("[demo.sync] Processing:", input);
						return {
							success: true,
							message: input.message,
							timestamp: new Date().toISOString(),
						};
					}),

				// mutationStep - auto-inferred name: 'demo.async'
				async: t.procedure
					.input(
						z.object({
							message: z.string(),
							callPython: z.boolean().optional().default(false),
						}),
					)
					.mutationStep(async ({ input }) => {
						console.log("[demo.async] Processing:", input);
						return {
							success: true,
							message: input.message,
							timestamp: new Date().toISOString(),
						};
					}),
			}),
		});
	}
}

export type AppRouter = TrpcRouter["appRouter"];
