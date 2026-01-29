export interface WorkflowHandle {
  workflowId: string;
  status: string;
}

export interface WorkflowResult {
  workflowId: string;
  status: string;
  output?: any;
  error?: string;
}

export interface RegisterResponse {
  workerId: string;
  sessionToken: string;
}

export interface Task {
  taskId: string;
  workflowId: string;
  stepName: string;
  input: any;
  retryPolicy?: { maxRetries: number; backoff: string };
}

export interface ActivityOptions {
  maxAttempts?: number;
  timeout?: number;
}

// WebSocket type for both browser and Node.js environments
declare const WebSocket: {
  new (url: string): WebSocket;
  prototype: WebSocket;
};

interface WebSocket {
  onmessage: ((event: { data: string }) => void) | null;
  onerror: ((event: Event) => void) | null;
  onclose: ((event: Event) => void) | null;
  onopen: ((event: Event) => void) | null;
  send(data: string): void;
  close(): void;
  readyState: number;
}

export class AetherClient {
  private baseUrl: string;

  constructor(url: string) {
    this.baseUrl = url.replace(/\/$/, '');
  }

  async startWorkflow(workflowType: string, input: any): Promise<WorkflowHandle> {
    const res = await fetch(`${this.baseUrl}/workflows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workflowType, input }),
    });
    if (!res.ok) throw new Error(`Failed to start workflow: ${res.statusText}`);
    return res.json() as Promise<WorkflowHandle>;
  }

  async getWorkflowStatus(workflowId: string): Promise<WorkflowHandle> {
    const res = await fetch(`${this.baseUrl}/workflows/${workflowId}`);
    if (!res.ok) throw new Error(`Failed to get status: ${res.statusText}`);
    return res.json() as Promise<WorkflowHandle>;
  }

  async awaitResult(workflowId: string, timeoutSeconds = 30): Promise<WorkflowResult> {
    const res = await fetch(
      `${this.baseUrl}/workflows/${workflowId}/result?timeout=${timeoutSeconds}`
    );
    if (!res.ok) throw new Error(`Failed to get result: ${res.statusText}`);
    return res.json() as Promise<WorkflowResult>;
  }

  async cancelWorkflow(workflowId: string): Promise<boolean> {
    const res = await fetch(`${this.baseUrl}/workflows/${workflowId}`, {
      method: 'DELETE',
    });
    return res.ok;
  }
}

export class AetherWorker {
  private baseUrl: string;
  private wsUrl: string;
  private ws: WebSocket | null = null;
  private workerId: string | null = null;
  private sessionToken: string | null = null;

  constructor(url: string) {
    this.baseUrl = url.replace(/\/$/, '');
    this.wsUrl = this.baseUrl.replace(/^http/, 'ws');
  }

  async register(serviceName: string, resources: Array<{ name: string; type: string }> = []): Promise<RegisterResponse> {
    const res = await fetch(`${this.baseUrl}/workers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serviceName, resources }),
    });
    if (!res.ok) throw new Error(`Failed to register: ${res.statusText}`);
    const data = await res.json() as RegisterResponse;
    this.workerId = data.workerId;
    this.sessionToken = data.sessionToken;
    return data;
  }

  connect(onTask: (task: Task) => void): void {
    if (!this.workerId || !this.sessionToken) {
      throw new Error('Must register before connecting');
    }

    this.ws = new WebSocket(
      `${this.wsUrl}/workers/${this.workerId}/tasks?token=${this.sessionToken}`
    );

    this.ws.onmessage = (event: { data: string }) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'task') {
        onTask(msg.payload);
        this.ws?.send(JSON.stringify({ type: 'ack', taskId: msg.payload.taskId }));
      }
    };

    this.ws.onerror = (_error: Event) => {
      console.error('WebSocket error');
    };
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
  }

  async completeStep(taskId: string, output?: any, error?: string): Promise<boolean> {
    const res = await fetch(`${this.baseUrl}/steps/${taskId}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ output, error }),
    });
    return res.ok;
  }

  async reportStep(taskId: string, status: 'STARTED' | 'COMPLETED' | 'FAILED', message?: string): Promise<boolean> {
    const res = await fetch(`${this.baseUrl}/steps/${taskId}/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, message }),
    });
    return res.ok;
  }

  async heartbeat(): Promise<boolean> {
    if (!this.workerId) return false;
    const res = await fetch(`${this.baseUrl}/workers/${this.workerId}/heartbeat`, {
      method: 'POST',
    });
    return res.ok;
  }
}

// Legacy Client class for backward compatibility with existing code
// This wraps AetherClient and AetherWorker to provide the old API
export class Client {
  private client: AetherClient;
  private worker: AetherWorker;
  private serverUrl: string;
  private registeredWorkerId: string | null = null;

  constructor(serverUrl: string) {
    this.serverUrl = serverUrl;
    this.client = new AetherClient(serverUrl);
    this.worker = new AetherWorker(serverUrl);
  }

  async startWorkflow(request: { workflowType: string; input: any }): Promise<{ workflowId: string }> {
    console.log('[Aether Client] Starting workflow:', request.workflowType);
    const result = await this.client.startWorkflow(request.workflowType, request.input);
    console.log('[Aether Client] Workflow started:', result.workflowId);
    return { workflowId: result.workflowId };
  }

  async awaitResult(workflowId: string, timeoutSeconds: number = 60): Promise<any> {
    const result = await this.client.awaitResult(workflowId, timeoutSeconds);
    return {
      result: result.output,
      error: result.error,
      state: result.status,
    };
  }

  async getWorkflowStatus(workflowId: string): Promise<any> {
    const result = await this.client.getWorkflowStatus(workflowId);
    return {
      workflowId: result.workflowId,
      state: result.status,
    };
  }

  async cancelWorkflow(workflowId: string): Promise<boolean> {
    return await this.client.cancelWorkflow(workflowId);
  }

  // ========== Worker API ==========

  async register(request: {
    workerId: string;
    serviceName: string;
    group: string;
    language: string[];
    provides: Array<{ name: string; type: number }>;
  }): Promise<{ serverId: string }> {
    const resources = request.provides.map(p => ({
      name: p.name,
      type: p.type === 0 ? 'step' : p.type === 1 ? 'activity' : 'workflow',
    }));

    const result = await this.worker.register(request.serviceName, resources);
    this.registeredWorkerId = result.workerId;
    return { serverId: result.workerId };
  }

  pollTasks(workerId: string, maxTasks: number, onTask: (task: any) => void): void {
    // Use WebSocket-based task polling
    this.worker.connect((task: Task) => {
      onTask({
        taskId: task.taskId,
        workflowId: task.workflowId,
        stepName: task.stepName,
        input: task.input,
        retryPolicy: task.retryPolicy,
      });
    });
  }

  async pollTasksOnce(workerId: string, maxTasks: number): Promise<any[]> {
    // For REST-based polling, we need to implement a different approach
    // This is a simplified version that returns empty array
    // In practice, you'd use the WebSocket connection or implement long-polling
    return [];
  }

  async completeStep(taskId: string, result: any, error?: string): Promise<boolean> {
    return await this.worker.completeStep(taskId, result, error);
  }

  async heartbeat(taskId: string): Promise<boolean> {
    return await this.worker.heartbeat();
  }

  // Step status enum
  static StepStatus = {
    STEP_STARTED: 0,
    STEP_COMPLETED: 1,
    STEP_FAILED: 2,
  };

  async reportStepStarted(workflowId: string, stepName: string, input: any): Promise<boolean> {
    // Use the step report endpoint with workflowId as taskId for now
    const res = await fetch(`${this.serverUrl}/steps/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workflowId,
        stepName,
        status: 'STARTED',
        input,
      }),
    });
    return res.ok;
  }

  async reportStepCompleted(workflowId: string, stepName: string, output: any): Promise<boolean> {
    const res = await fetch(`${this.serverUrl}/steps/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workflowId,
        stepName,
        status: 'COMPLETED',
        output,
      }),
    });
    return res.ok;
  }

  async reportStepFailed(workflowId: string, stepName: string, error: string): Promise<boolean> {
    const res = await fetch(`${this.serverUrl}/steps/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workflowId,
        stepName,
        status: 'FAILED',
        error,
      }),
    });
    return res.ok;
  }
}
