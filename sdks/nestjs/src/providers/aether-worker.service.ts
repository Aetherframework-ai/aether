import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Inject,
  Logger,
  Optional,
} from "@nestjs/common";
import { AETHER_CONFIG_TOKEN } from "../aether.constants";
import WebSocket from "ws";

export interface AetherWorkerConfig {
  /**
   * Aether server URL (e.g., 'http://localhost:7233')
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
   * Reconnect interval in milliseconds when WebSocket disconnects
   * @default 1000
   */
  reconnectInterval?: number;

  /**
   * Maximum reconnection attempts
   * @default 10
   */
  maxReconnectAttempts?: number;
}

export interface RegisteredHandler {
  name: string;
  type: "step" | "activity";
  handler: (input: any) => any | Promise<any>;
  options?: Record<string, any>;
}

export interface Task {
  taskId: string;
  workflowId: string;
  stepName: string;
  input: any;
  retryPolicy?: { maxRetries: number; backoff: string };
}

export interface RegisterResponse {
  workerId: string;
  sessionToken: string;
}

/**
 * Token for injecting the step registry
 */
export const AETHER_STEP_REGISTRY_TOKEN = "AETHER_STEP_REGISTRY_TOKEN";

/**
 * Internal HTTP + WebSocket client for Aether communication
 */
class AetherHttpClient {
  private baseUrl: string;
  private wsUrl: string;
  private ws: WebSocket | null = null;
  private workerId: string | null = null;
  private sessionToken: string | null = null;
  private onTaskCallback: ((task: Task) => void) | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts: number;
  private reconnectInterval: number;
  private isConnected = false;
  private logger = new Logger("AetherHttpClient");

  constructor(
    serverUrl: string,
    reconnectInterval = 1000,
    maxReconnectAttempts = 10
  ) {
    this.baseUrl = serverUrl.replace(/\/$/, "");
    this.wsUrl = this.baseUrl.replace(/^http/, "ws");
    this.reconnectInterval = reconnectInterval;
    this.maxReconnectAttempts = maxReconnectAttempts;
  }

  async register(request: {
    workerId: string;
    serviceName: string;
    group: string;
    language: string[];
    provides: Array<{ name: string; type: string }>;
  }): Promise<RegisterResponse> {
    const resources = request.provides.map((p) => ({
      name: p.name,
      type: p.type,
    }));

    const res = await fetch(`${this.baseUrl}/workers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        serviceName: request.serviceName,
        group: request.group,
        language: request.language,
        resources,
      }),
    });

    if (!res.ok) {
      throw new Error(`Failed to register worker: ${res.statusText}`);
    }

    const data = (await res.json()) as RegisterResponse;
    this.workerId = data.workerId;
    this.sessionToken = data.sessionToken;
    return data;
  }

  connect(onTask: (task: Task) => void): void {
    if (!this.workerId || !this.sessionToken) {
      throw new Error("Must register before connecting");
    }

    this.onTaskCallback = onTask;
    this.establishWebSocket();
  }

  private establishWebSocket(): void {
    if (!this.workerId || !this.sessionToken) return;

    const wsEndpoint = `${this.wsUrl}/workers/${this.workerId}/tasks?token=${this.sessionToken}`;
    this.logger.debug(`Connecting to WebSocket: ${wsEndpoint}`);

    this.ws = new WebSocket(wsEndpoint);

    this.ws.on("open", () => {
      this.logger.log("WebSocket connected");
      this.isConnected = true;
      this.reconnectAttempts = 0;
    });

    this.ws.on("message", (data: WebSocket.Data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === "task" && this.onTaskCallback) {
          this.onTaskCallback(msg.payload);
          // Send acknowledgment
          this.ws?.send(
            JSON.stringify({ type: "ack", taskId: msg.payload.taskId })
          );
        }
      } catch (error: any) {
        this.logger.error(`Failed to parse WebSocket message: ${error.message}`);
      }
    });

    this.ws.on("error", (error: Error) => {
      this.logger.error(`WebSocket error: ${error.message}`);
    });

    this.ws.on("close", () => {
      this.logger.warn("WebSocket disconnected");
      this.isConnected = false;
      this.attemptReconnect();
    });
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.logger.error(
        `Max reconnection attempts (${this.maxReconnectAttempts}) reached`
      );
      return;
    }

    this.reconnectAttempts++;
    this.logger.log(
      `Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${this.reconnectInterval}ms`
    );

    setTimeout(() => {
      if (!this.isConnected && this.onTaskCallback) {
        this.establishWebSocket();
      }
    }, this.reconnectInterval);
  }

  disconnect(): void {
    this.isConnected = false;
    this.onTaskCallback = null;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  async completeStep(
    taskId: string,
    result: any,
    error?: string
  ): Promise<boolean> {
    const res = await fetch(`${this.baseUrl}/steps/${taskId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ output: result, error }),
    });
    return res.ok;
  }

  async reportStepStarted(
    workflowId: string,
    stepName: string,
    input: any
  ): Promise<boolean> {
    const res = await fetch(`${this.baseUrl}/steps/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workflowId,
        stepName,
        status: "STARTED",
        input,
      }),
    });
    return res.ok;
  }

  async reportStepCompleted(
    workflowId: string,
    stepName: string,
    output: any
  ): Promise<boolean> {
    const res = await fetch(`${this.baseUrl}/steps/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workflowId,
        stepName,
        status: "COMPLETED",
        output,
      }),
    });
    return res.ok;
  }

  async reportStepFailed(
    workflowId: string,
    stepName: string,
    error: string
  ): Promise<boolean> {
    const res = await fetch(`${this.baseUrl}/steps/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workflowId,
        stepName,
        status: "FAILED",
        error,
      }),
    });
    return res.ok;
  }

  async heartbeat(): Promise<boolean> {
    if (!this.workerId) return false;
    const res = await fetch(
      `${this.baseUrl}/workers/${this.workerId}/heartbeat`,
      {
        method: "POST",
      }
    );
    return res.ok;
  }
}

@Injectable()
export class AetherWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AetherWorkerService.name);
  private client: AetherHttpClient | null = null;
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

    // Create HTTP + WebSocket client
    this.client = new AetherHttpClient(
      this.config.serverUrl,
      this.config.reconnectInterval,
      this.config.maxReconnectAttempts
    );

    // Prepare provides list
    const provides = Array.from(this.handlers.values()).map((handler) => ({
      name: handler.name,
      type: handler.type,
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
      this.logger.log(`Worker registered with server: ${response.workerId}`);
    } catch (error: any) {
      this.logger.error(`Failed to register worker: ${error.message}`);
      throw error;
    }

    // Start WebSocket connection for task polling
    this.isRunning = true;
    this.client.connect((task: Task) => {
      this.handleTask(task).catch((error) => {
        this.logger.error(`Task handling error: ${error.message}`);
      });
    });

    this.logger.log("Aether worker started successfully!");
  }

  /**
   * Stop the worker
   */
  async stop(): Promise<void> {
    this.isRunning = false;
    if (this.client) {
      this.client.disconnect();
      this.client = null;
    }
    this.logger.log("Aether worker stopped");
  }

  private async handleTask(task: Task): Promise<void> {
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
