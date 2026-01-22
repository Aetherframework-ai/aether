import { aether } from "@aetherframework.ai/sdk";

const client = aether({
	serverUrl: "http://localhost:7233",
});

const NESTJS_URL = "http://localhost:3001";

async function callNestJsTrpc(endpoint: string, data: any): Promise<any> {
	const response = await fetch(`${NESTJS_URL}/trpc/${endpoint}`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(data),
	});
	return response.json();
}

async function main() {
	const result = await callNestJsTrpc("demo.sync", {
		message: "Hello Aether!",
		callPython: true,
	});

	console.log("");
	console.log("=".repeat(50));
	console.log("Workflow Result:");
	console.log(JSON.stringify(result, null, 2));
}

main().catch(console.error);
