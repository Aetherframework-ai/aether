import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

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
}

bootstrap();
