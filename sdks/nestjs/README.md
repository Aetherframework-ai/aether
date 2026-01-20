# Aether NestJS SDK

NestJS SDK for Aether workflow engine.

## Installation

```bash
npm install @aether/nestjs @aether/sdk
```

## Quick Start

1. Import AetherModule in your AppModule:
```typescript
import { Module } from '@nestjs/common';
import { AetherModule } from '@aether/nestjs';

@Module({
  imports: [
    AetherModule.forRoot({
      serverUrl: 'http://localhost:7233',
    }),
  ],
})
export class AppModule {}
```

2. Use decorators in your services:
```typescript
import { Injectable } from '@nestjs/common';
import { AetherService, Step, Activity } from '@aether/nestjs';

@Injectable()
export class MyService {
  constructor(private readonly aether: AetherService) {}

  @Step()
  async myStep(input: any) {
    return { processed: true };
  }

  @Activity({ maxAttempts: 3 })
  async myActivity(input: any) {
    return this.aether.step({ name: 'myStep', serviceName: 'other-service' }, input);
  }
}
```

## Features

- NestJS-native decorators (@Step, @Activity, @Workflow)
- Dependency injection support
- Auto-discovery of decorated methods
- Integration with Aether core

## License

MIT
