import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { TrpcService } from "./trpc/trpc.service";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: ["http://localhost:3000", "http://localhost:7233"],
    credentials: true,
  });

  const port = process.env.PORT || 3001;
  await app.listen(port);

  console.log(`[NestJS] Demo service running on http://localhost:${port}`);
  console.log(`[NestJS] tRPC endpoint: http://localhost:${port}/trpc`);

  // Start Aether worker (default: enabled, set AETHER_WORKER_ENABLED=false to disable)
  if (process.env.AETHER_WORKER_ENABLED !== "false") {
    const trpcService = app.get(TrpcService);
    await trpcService.aether.serve();
    console.log("[NestJS] Aether worker started");
  }
}

bootstrap();
