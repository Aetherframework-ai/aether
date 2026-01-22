import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Inject,
  Logger,
  Optional,
} from "@nestjs/common";
import { AETHER_CONFIG_TOKEN } from "../aether.constants";
import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import * as path from "path";

export interface AetherWorkerConfig {
  /**
   * Aether server URL (e.g., 'localhost:7233')
   */
  serverUrl: string;

  /**
   * Service name for this NestJS application
   */
  serviceName: string;

  /**
   * Worker ID (auto-generated if not provided)
   */
  workerId?: string;

  /**
   * Worker group
   * @default 'default'
   */
  group?: string;

  /**
   * Whether to automatically start the worker on module init
   * @default true
   */
  autoServe?: boolean;

  /**
   * Polling interval in milliseconds
   * @default 200
   */
  pollingInterval?: number;

  /**
   * Maximum tasks to poll at once
   * @default 10
   */
  maxTasks?: number;

  /**
   * Path to the proto file
   */
  protoPath?: string;
}

export interface RegisteredHandler {
  name: string;
  type: "step" | "activity";
  handler: (input: any) => any | Promise<any>;
  options?: Record<string, any>;
}

/**
 * Token for injecting the step registry
 */
export const AETHER_STEP_REGISTRY_TOKEN = "AETHER_STEP_REGISTRY_TOKEN";

/**
 * Internal gRPC client for Aether communication
 */
class AetherGrpcClient {
  private workerService: any;

  constructor(serverUrl: string, protoPath?: string) {
    // Default proto path
    const resolvedProtoPath =
      protoPath || path.resolve(__dirname, "../../../../proto/aether.proto");

    // Load proto definition
    const packageDefinition = protoLoader.loadSync(resolvedProtoPath, {
      keepCase: false,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });

    const aetherProto = grpc.loadPackageDefinition(packageDefinition) as any;

    // Extract host:port from URL
    const url = serverUrl.replace(/^https?:\/\//, "");

    // Create gRPC client
    this.workerService = new aetherProto.aether.v1.WorkerService(
      url,
      grpc.credentials.createInsecure()
    );
  }

  async register(request: {
    workerId: string;
    serviceName: string;
    group: string;
    language: string[];
    provides: Array<{ name: string; type: number }>;
  }): Promise<{ serverId: string }> {
    return new Promise((resolve, reject) => {
      this.workerService.register(request, (error: any, response: any) => {
        if (error) {
          reject(error);
        } else {
          resolve({ serverId: response.serverId });
        }
      });
    });
  }

  async pollTasksOnce(workerId: string, maxTasks: number): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const tasks: any[] = [];
      const call = this.workerService.pollTasks({ workerId, maxTasks });

      call.on("data", (task: any) => {
        let input = null;
        if (task.input?.length > 0) {
          try {
            input = JSON.parse(task.input.toString());
          } catch {
            input = task.input;
          }
        }
        tasks.push({ ...task, input });
      });

      call.on("error", (error: any) => {
        if (error.code === 1) {
          // CANCELLED
          resolve(tasks);
        } else {
          reject(error);
        }
      });

      call.on("end", () => {
        resolve(tasks);
      });
    });
  }

  async completeStep(
    taskId: string,
    result: any,
    error?: string
  ): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const grpcRequest = {
        taskId,
        result: Buffer.from(JSON.stringify(result)),
        error: error || "",
      };

      this.workerService.completeStep(grpcRequest, (err: any, response: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(response.success);
        }
      });
    });
  }

  async reportStepStarted(
    workflowId: string,
    stepName: string,
    input: any
  ): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const grpcRequest = {
        workflowId,
        stepName,
        status: 0, // STEP_STARTED
        input: Buffer.from(JSON.stringify(input || {})),
        output: Buffer.alloc(0),
        error: "",
      };

      this.workerService.reportStep(grpcRequest, (err: any, response: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(response.success);
        }
      });
    });
  }

  async reportStepCompleted(
    workflowId: string,
    stepName: string,
    output: any
  ): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const grpcRequest = {
        workflowId,
        stepName,
        status: 1, // STEP_COMPLETED
        input: Buffer.alloc(0),
        output: Buffer.from(JSON.stringify(output || {})),
        error: "",
      };

      this.workerService.reportStep(grpcRequest, (err: any, response: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(response.success);
        }
      });
    });
  }

  async reportStepFailed(
    workflowId: string,
    stepName: string,
    error: string
  ): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const grpcRequest = {
        workflowId,
        stepName,
        status: 2, // STEP_FAILED
        input: Buffer.alloc(0),
        output: Buffer.alloc(0),
        error,
      };

      this.workerService.reportStep(grpcRequest, (err: any, response: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(response.success);
        }
      });
    });
  }
}

@Injectable()
export class AetherWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AetherWorkerService.name);
  private client: AetherGrpcClient | null = null;
  private workerId: string;
  private isRunning = false;
  private handlers = new Map<string, RegisteredHandler>();

  constructor(
    @Inject(AETHER_CONFIG_TOKEN)
    private readonly config: AetherWorkerConfig,
    @Optional()
    @Inject(AETHER_STEP_REGISTRY_TOKEN)
    private readonly stepRegistry?: Map<string, RegisteredHandler>
  ) {
    this.workerId =
      config.workerId ||
      `nestjs-worker-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  async onModuleInit() {
    // Merge handlers from step registry if provided
    if (this.stepRegistry) {
      this.stepRegistry.forEach((handler, name) => {
        this.handlers.set(name, handler);
      });
    }

    if (this.config.autoServe !== false && this.handlers.size > 0) {
      await this.start();
    }
  }

  async onModuleDestroy() {
    await this.stop();
  }

  /**
   * Register a handler for a step or activity
   */
  registerHandler(handler: RegisteredHandler): void {
    this.handlers.set(handler.name, handler);
    this.logger.log(`Registered ${handler.type}: ${handler.name}`);
  }

  /**
   * Register multiple handlers
   */
  registerHandlers(handlers: Map<string, RegisteredHandler>): void {
    handlers.forEach((handler, name) => {
      this.handlers.set(name, handler);
    });
  }

  /**
   * Get all registered handlers
   */
  getHandlers(): Map<string, RegisteredHandler> {
    return this.handlers;
  }

  /**
   * Start the worker
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn("Worker is already running");
      return;
    }

    this.logger.log(`Starting Aether worker: ${this.workerId}`);
    this.logger.log(
      `Handlers: ${Array.from(this.handlers.keys()).join(", ") || "(none)"}`
    );

    // Create gRPC client
    this.client = new AetherGrpcClient(
      this.config.serverUrl,
      this.config.protoPath
    );

    // Prepare provides list
    const provides = Array.from(this.handlers.values()).map((handler) => ({
      name: handler.name,
      type: handler.type === "step" ? 1 : 0, // ResourceType.STEP = 1, ACTIVITY = 0
    }));

    // Register with Aether core
    try {
      const response = await this.client.register({
        workerId: this.workerId,
        serviceName: this.config.serviceName,
        group: this.config.group || "default",
        language: ["typescript", "nestjs"],
        provides,
      });
      this.logger.log(`Worker registered with server: ${response.serverId}`);
    } catch (error: any) {
      this.logger.error(`Failed to register worker: ${error.message}`);
      throw error;
    }

    // Start polling
    this.isRunning = true;
    this.startPolling();

    this.logger.log("Aether worker started successfully!");
  }

  /**
   * Stop the worker
   */
  async stop(): Promise<void> {
    this.isRunning = false;
    this.logger.log("Aether worker stopped");
  }

  private async startPolling(): Promise<void> {
    const pollingInterval = this.config.pollingInterval || 200;
    const maxTasks = this.config.maxTasks || 10;

    const runLoop = async () => {
      while (this.isRunning && this.client) {
        try {
          const tasks = await this.client.pollTasksOnce(this.workerId, maxTasks);

          for (const task of tasks) {
            await this.handleTask(task);
          }

          // Wait before next poll
          await new Promise((resolve) => setTimeout(resolve, pollingInterval));
        } catch (error: any) {
          this.logger.error(`Polling error: ${error.message}`);
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    };

    runLoop().catch((error) => {
      this.logger.error(`Poll loop error: ${error.message}`);
    });
  }

  private async handleTask(task: any): Promise<void> {
    const { taskId, stepName, workflowId, input } = task;

    this.logger.debug(`Received task: ${taskId}, step: ${stepName}`);

    try {
      // Find handler for this step
      const handler = this.handlers.get(stepName);

      if (!handler) {
        // If no specific handler, try to handle 'start' step by executing all handlers
        if (stepName === "start") {
          this.logger.log(`Executing workflow start for: ${workflowId}`);
          await this.client!.completeStep(taskId, { started: true });
          return;
        }

        this.logger.warn(`No handler found for step: ${stepName}`);
        await this.client!.completeStep(
          taskId,
          {},
          `No handler for step: ${stepName}`
        );
        return;
      }

      // Report step started
      await this.client!.reportStepStarted(workflowId, stepName, input);

      // Execute handler
      const result = await handler.handler(input);

      // Report step completed
      await this.client!.reportStepCompleted(workflowId, stepName, result);

      // Complete the task
      await this.client!.completeStep(taskId, result);

      this.logger.debug(`Task completed: ${taskId}`);
    } catch (error: any) {
      this.logger.error(`Task error: ${error.message}`);

      // Report step failed
      try {
        await this.client!.reportStepFailed(workflowId, stepName, error.message);
        await this.client!.completeStep(taskId, {}, error.message);
      } catch (reportError: any) {
        this.logger.error(`Failed to report error: ${reportError.message}`);
      }
    }
  }
}
