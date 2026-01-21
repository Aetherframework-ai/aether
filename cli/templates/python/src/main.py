"""Main entry point for the Aether workflow project."""
from aether_framework_sdk import aether
from workflows.workflow import {{ workflow_name_snake_case }}


async def main():
    """Start the Aether server with registered workflows."""
    print("Starting Aether workflow server...")
    await aether.serve([{{ workflow_name_snake_case }}])
    print("Server running at http://localhost:7233")


if __name__ == "__main__":
    import asyncio

    asyncio.run(main())
