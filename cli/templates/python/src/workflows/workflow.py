from aether_framework_sdk import aether


@aether.workflow("{{ workflow_name }}")
async def {{ workflow_name_snake }}(ctx: "aether.WorkflowContext", input_data: dict) -> dict:
    """
    Aether workflow definition.

    Args:
        ctx: Workflow context with step() method
        input_data: Input data for the workflow

    Returns:
        Workflow result
    """
    # TODO: 实现工作流逻辑
    async def _step1():
        return {"message": "Hello"}

    result = await ctx.step("step_1", _step1)

    return result


if __name__ == "__main__":
    import asyncio


    async def main():
        print("Starting Aether workflow...")
        await aether.serve([{{ workflow_name_snake }}])
        print("Server running at http://localhost:7233")


    asyncio.run(main())
