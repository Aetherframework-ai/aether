import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { createAetherTrpc, AetherInstance } from "@aetherframework.ai/trpc";

@Injectable()
export class TrpcService implements OnModuleDestroy {
	public readonly t: ReturnType<typeof createAetherTrpc>["t"];
	public readonly aether: AetherInstance;

	constructor() {
		const { t, aether } = createAetherTrpc({
			serverUrl: process.env.AETHER_SERVER_URL || "http://localhost:7233",
			serviceName: "nestjs-demo-service",
			group: "default",
			fallbackOnError: (process.env.AETHER_FALLBACK as any) || "warn",
		});

		this.t = t;
		this.aether = aether;
	}

	onModuleDestroy() {
		this.aether.stop();
	}
}
