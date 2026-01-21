import { aether } from "@aetherframework.ai/sdk";

const client = aether({
	serverUrl: "http://localhost:7233",
});

const slowWorkflow = client.workflow(
	"slow-process",
	async (ctx, name: string) => {
		console.log(`Starting slow workflow for: ${name}`);

		await ctx.step("step-1-init", async () => {
			console.log("Step 1: Initializing...");
			await new Promise((resolve) => setTimeout(resolve, 5000));
			return "initialized";
		});

		await ctx.step("step-2-process", async () => {
			console.log("Step 2: Processing...");
			await new Promise((resolve) => setTimeout(resolve, 5000));
			return "processed";
		});

		await ctx.step("step-3-finalize", async () => {
			console.log("Step 3: Finalizing...");
			await new Promise((resolve) => setTimeout(resolve, 5000));
			return "finalized";
		});

		return { status: "completed", name };
	},
);

async function main() {
	console.log("Registering workflow...");
	await client.serve([slowWorkflow]);
	console.log("Workflow registered!");

	console.log("Starting slow workflow...");
	const workflowId = await slowWorkflow.start("test-slow");
	console.log(`Workflow started with ID: ${workflowId}`);
	console.log("Check the dashboard now!");
}

main().catch(console.error);
