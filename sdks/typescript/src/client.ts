import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import * as path from 'path';

export interface ActivityOptions {
  maxAttempts?: number;
  timeout?: number;
}

// Proto 文件路径
const PROTO_PATH = path.resolve(__dirname, '../../../proto/aether.proto');

// 加载 proto 定义
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: false,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const aetherProto = grpc.loadPackageDefinition(packageDefinition) as any;

export class Client {
  private clientService: any;
  private workerService: any;
  private serverUrl: string;

  constructor(serverUrl: string) {
    this.serverUrl = serverUrl;
    // 从 http://localhost:7233 提取 host:port
    const url = serverUrl.replace(/^https?:\/\//, '');

    // 创建 gRPC 客户端
    this.clientService = new aetherProto.aether.v1.ClientService(
      url,
      grpc.credentials.createInsecure()
    );

    this.workerService = new aetherProto.aether.v1.WorkerService(
      url,
      grpc.credentials.createInsecure()
    );
  }

  async startWorkflow(request: { workflowType: string; input: any }): Promise<{ workflowId: string }> {
    return new Promise((resolve, reject) => {
      const grpcRequest = {
        workflowType: request.workflowType,
        input: Buffer.from(JSON.stringify(request.input)),
      };

      this.clientService.startWorkflow(grpcRequest, (error: any, response: any) => {
        if (error) {
          console.error('[Aether Client] StartWorkflow error:', error.message);
          reject(error);
        } else {
          console.log('[Aether Client] Workflow started:', response.workflowId);
          resolve({ workflowId: response.workflowId });
        }
      });
    });
  }

  async awaitResult(workflowId: string, timeoutSeconds: number = 60): Promise<any> {
    return new Promise((resolve, reject) => {
      const grpcRequest = {
        workflowId,
        timeoutSeconds,
      };

      this.clientService.awaitResult(grpcRequest, (error: any, response: any) => {
        if (error) {
          // 如果是 FAILED_PRECONDITION，说明 workflow 还在运行，需要轮询
          if (error.code === grpc.status.FAILED_PRECONDITION) {
            // 轮询等待结果
            this.pollForResult(workflowId, timeoutSeconds)
              .then(resolve)
              .catch(reject);
          } else {
            reject(error);
          }
        } else {
          try {
            const result = response.result?.length > 0
              ? JSON.parse(response.result.toString())
              : null;
            resolve({ result, error: response.error, state: response.state });
          } catch {
            resolve({ result: response.result, error: response.error, state: response.state });
          }
        }
      });
    });
  }

  private async pollForResult(workflowId: string, timeoutSeconds: number): Promise<any> {
    const startTime = Date.now();
    const timeoutMs = timeoutSeconds * 1000;

    while (Date.now() - startTime < timeoutMs) {
      const status = await this.getWorkflowStatus(workflowId);

      if (status.state === 'COMPLETED' || status.state === 2) {
        return { result: status.result, state: 'COMPLETED' };
      }
      if (status.state === 'FAILED' || status.state === 3) {
        return { error: status.error, state: 'FAILED' };
      }

      // 等待 500ms 后重试
      await new Promise(r => setTimeout(r, 500));
    }

    throw new Error('Workflow timeout');
  }

  async getWorkflowStatus(workflowId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.clientService.getWorkflowStatus({ workflowId }, (error: any, response: any) => {
        if (error) {
          reject(error);
        } else {
          let result = null;
          if (response.result?.length > 0) {
            try {
              result = JSON.parse(response.result.toString());
            } catch {
              result = response.result;
            }
          }
          resolve({
            workflowId: response.workflowId,
            state: response.state,
            currentStep: response.currentStep,
            result,
            error: response.error,
            startedAt: response.startedAt,
            completedAt: response.completedAt,
          });
        }
      });
    });
  }

  async cancelWorkflow(workflowId: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.clientService.cancelWorkflow({ workflowId }, (error: any, response: any) => {
        if (error) {
          reject(error);
        } else {
          resolve(response.success);
        }
      });
    });
  }

  // ========== Worker API ==========

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

  pollTasks(workerId: string, maxTasks: number, onTask: (task: any) => void): void {
    const call = this.workerService.pollTasks({ workerId, maxTasks });

    call.on('data', (task: any) => {
      // 解析 input
      let input = null;
      if (task.input?.length > 0) {
        try {
          input = JSON.parse(task.input.toString());
        } catch {
          input = task.input;
        }
      }
      onTask({ ...task, input });
    });

    call.on('error', (error: any) => {
      if (error.code !== 1) { // CANCELLED
        console.error('[Aether Client] PollTasks error:', error.message);
      }
    });

    call.on('end', () => {
      // Stream ended, this is normal
    });
  }

  async pollTasksOnce(workerId: string, maxTasks: number): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const tasks: any[] = [];
      const call = this.workerService.pollTasks({ workerId, maxTasks });

      call.on('data', (task: any) => {
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

      call.on('error', (error: any) => {
        if (error.code === 1) { // CANCELLED
          resolve(tasks);
        } else {
          reject(error);
        }
      });

      call.on('end', () => {
        resolve(tasks);
      });
    });
  }

  async completeStep(taskId: string, result: any, error?: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const grpcRequest = {
        taskId,
        result: Buffer.from(JSON.stringify(result)),
        error: error || '',
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

  async heartbeat(taskId: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.workerService.heartbeat({ taskId }, (error: any, response: any) => {
        if (error) {
          reject(error);
        } else {
          resolve(response.ok);
        }
      });
    });
  }
}
