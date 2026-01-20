"""
Example Python service using Aether SDK
"""

import asyncio
from aether import AetherService, step, activity, workflow


class DataProcessService(AetherService):
    service_name = "data-proc"
    group = "data-group"
    language = ["python"]

    @step()
    def process_data(self, data: dict) -> dict:
        """Process data - simple step"""
        print(f"Processing data: {data}")
        return {
            **data,
            "processed": True,
            "processor": "python",
            "timestamp": asyncio.get_event_loop().time(),
        }

    @activity(max_attempts=3, timeout=30000)
    def analyze_data(self, data: dict) -> dict:
        """Analyze data with retry"""
        print(f"Analyzing data: {data}")
        # Simulate analysis
        return {
            **data,
            "analyzed": True,
            "result": f"analyzed-{data.get('id', 'unknown')}",
        }

    @workflow()
    async def full_pipeline(self, ctx, data: dict) -> dict:
        """Complete processing pipeline"""
        print(f"Starting pipeline with: {data}")

        # Step 1: Process data
        processed = await ctx.step("self::process_data", data)

        # Step 2: Analyze data
        analyzed = await ctx.activity("self::analyze_data", processed)

        return {**analyzed, "pipeline_completed": True}


async def main():
    """Main entry point"""
    service = DataProcessService()

    try:
        await service.start(port=50051)

        # Keep running
        print("Service is running. Press Ctrl+C to stop.")
        await asyncio.Event().wait()

    except KeyboardInterrupt:
        print("\nShutting down...")
    finally:
        await service.stop()


if __name__ == "__main__":
    asyncio.run(main())
