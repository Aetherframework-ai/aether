import { aether } from "@aetherframework.ai/sdk";

const client = aether({
  serverUrl: "http://localhost:7233",
});

const NESTJS_URL = "http://localhost:3001";
const PYTHON_URL = "http://localhost:3002";

async function callService(url: string, data: any): Promise<any> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return response.json();
}

const multilangDemo = client.workflow(
  "multilang-demo",
  async (ctx, input: { message: string }) => {
    const results: any[] = [];

    // Step 1: NestJS Sync
    const r1 = await ctx.step("nestjs-sync", async () => {
      console.log("→ Calling NestJS sync step...");
      // In real Aether, this would use ctx.call("nestjs-demo::syncStep", ...)
      // For demo, we call the HTTP endpoint directly
      return await callService(`${NESTJS_URL}/trpc/demo.sync`, {
        message: input.message,
      });
    });
    results.push(r1);

    // Step 2: Python Sync
    const r2 = await ctx.step("python-sync", async () => {
      console.log("→ Calling Python sync step...");
      return await callService(`${PYTHON_URL}/sync-step`, {
        message: input.message,
      });
    });
    results.push(r2);

    // Step 3: NestJS Async
    const r3 = await ctx.step("nestjs-async", async () => {
      console.log("→ Calling NestJS async step...");
      return await callService(`${NESTJS_URL}/trpc/demo.async`, {
        message: input.message,
      });
    });
    results.push(r3);

    // Step 4: Python Async
    const r4 = await ctx.step("python-async", async () => {
      console.log("→ Calling Python async step...");
      return await callService(`${PYTHON_URL}/async-step`, {
        message: input.message,
      });
    });
    results.push(r4);

    return {
      workflow: "multilang-demo",
      steps: results,
      totalSteps: results.length,
    };
  }
);

async function main() {
  console.log("=".repeat(50));
  console.log("Multilang Workflow Demo");
  console.log("=".repeat(50));
  console.log("");

  const result = await multilangDemo.startAndWait({
    message: "Hello Aether!",
  });

  console.log("");
  console.log("=".repeat(50));
  console.log("Workflow Result:");
  console.log(JSON.stringify(result, null, 2));
}

main().catch(console.error);
