# Aether Python SDK

A Python SDK for the Aether workflow engine.

## Installation

```bash
pip install aether-sdk
```

## Quick Start

```python
from aether import AetherService, step, activity, workflow

class MyService(AetherService):
    service_name = 'my-service'
    group = 'my-group'
    language = ['python']
    
    @step()
    def process_data(self, data: dict) -> dict:
        """Process data step"""
        return {**data, 'processed': True}
    
    @activity(max_attempts=3, timeout=30000)
    def analyze_data(self, data: dict) -> dict:
        """Analyze data with retry"""
        return run_analysis(data)
    
    @workflow()
    async def pipeline(self, ctx, data: dict) -> dict:
        """Complete processing pipeline"""
        processed = await ctx.step('self::process_data', data)
        return await ctx.step('self::analyze_data', processed)

# Start the service
service = MyService()
await service.start(port=50051)
```

## Features

- **Decorators**: `@step()`, `@activity()`, `@workflow()`
- **Service Registration**: Automatic registration with Aether server
- **Context Methods**: `ctx.step()`, `ctx.activity()`, `ctx.child()`
- **Retry Logic**: Built-in retry with exponential backoff

## API Reference

### AetherService

```python
class AetherService:
    service_name: str      # Unique service identifier
    group: str             # Logical grouping
    language: List[str]    # Programming languages
    
    async def start(self, host: str = '0.0.0.0', port: int = 50051)
    async def stop(self)
```

### Decorators

```python
@step(name: Optional[str] = None)
@activity(options: Optional[ActivityOptions] = None, name: Optional[str] = None)
@workflow(name: Optional[str] = None)
```

### Context Methods

```python
async ctx.step(name: str, input: Any) -> Any
async ctx.activity(name: str, input: Any, options: Optional[ActivityOptions] = None) -> Any
async ctx.child(workflow: str, args: List[Any]) -> Any
```

## License

MIT
