import { Injectable } from "@nestjs/common";
import { aether } from "@aetherframework.ai/nestjs";

@Injectable()
export class WorkflowService {
	private client = aether({ serverUrl: "http://localhost:7233" });

	async executeWorkflow(input: any) {
		// TODO: Implement workflow execution logic
		// The Aether server should be running at http://localhost:7233
		// Use this.client to interact with workflows

		console.log("Executing workflow with input:", input);

		// Example: Start a workflow and wait for result
		// const result = await this.client.workflow('my-workflow').startAndWait(input);
		// return result;

		return { status: "executed", input };
	}
}
