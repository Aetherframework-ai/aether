import { Client } from './client';
import { AetherConfig, ResourceRef, ActivityOptions } from './index';

// Helper to convert string to ResourceRef
function toResourceRef(ref: string | ResourceRef): ResourceRef {
  return typeof ref === 'string' ? { name: ref } : ref;
}

export class Workflow<T> {
  private fn: any;
  private config: AetherConfig;

  constructor(
    private client: Client,
    private name: string,
    fn: any,
    config: AetherConfig
  ) {
    this.fn = fn;
    this.config = config;
  }

  async start(...args: any[]) {
    const request = {
      workflowType: this.name,
      input: JSON.stringify(args),
    };

    const response = await this.client.startWorkflow(request);
    return response.workflowId;
  }

  async startAndWait(...args: any[]) {
    const workflowId = await this.start(...args);
    return await this.client.awaitResult(workflowId);
  }

  // Create workflow context with remote service support
  private createContext(): any {
    const self = this;
    
    return {
      // Execute a step (local or remote)
      step: async function<T>(ref: string | ResourceRef, input: any): Promise<T> {
        const resource = toResourceRef(ref);
        if (resource.serviceName) {
          // Remote step - call via gRPC
          return await self.client.executeRemoteStep(
            resource.serviceName,
            resource.name,
            input
          );
        } else {
          // Local step - not supported in this version
          throw new Error(`Local step '${resource.name}' not implemented. Use remote service.`);
        }
      },
      
      // Execute an activity (local or remote)
      activity: async function<T>(ref: string | ResourceRef, input: any, options?: ActivityOptions): Promise<T> {
        const resource = toResourceRef(ref);
        if (resource.serviceName) {
          // Remote activity - call via gRPC
          return await self.client.executeRemoteActivity(
            resource.serviceName,
            resource.name,
            input,
            options
          );
        } else {
          // Local activity - not supported in this version
          throw new Error(`Local activity '${resource.name}' not implemented. Use remote service.`);
        }
      },
      
      // Execute steps in parallel
      parallel: async function<T>(steps: (() => Promise<T>)[]): Promise<T[]> {
        const results = await Promise.all(steps.map(s => s()));
        return results;
      },
      
      // Pause execution
      sleep: async function(duration: { minutes?: number; hours?: number; seconds?: number }) {
        const ms = (duration.minutes || 0) * 60000 + 
                   (duration.hours || 0) * 3600000 + 
                   (duration.seconds || 0) * 1000;
        await new Promise(resolve => setTimeout(resolve, ms));
      },
      
      // Execute a child workflow (local or remote)
      child: async function<T>(ref: string | ResourceRef, args: any[]): Promise<T> {
        const resource = toResourceRef(ref);
        if (resource.serviceName) {
          // Remote workflow - call via gRPC
          return await self.client.executeRemoteWorkflow(
            resource.serviceName,
            resource.name,
            args
          );
        } else {
          // Local workflow - not supported in this version
          throw new Error(`Local workflow '${resource.name}' not implemented. Use remote service.`);
        }
      },
    };
  }
}
