import { Client } from './client';
import { Workflow } from './workflow';

// ========== Configuration ==========

export interface AetherConfig {
  serverUrl: string;
  workerId?: string;
  name?: string;
  discovery?: {
    type: 'dns' | 'k8s';
    domain?: string;
    namespace?: string;
  };
  services?: {
    [serviceName: string]: {
      serviceName: string;
      group: string;
      endpoint: string;
      resources?: {
        [resourceName: string]: {
          type: 'step' | 'activity' | 'workflow';
        };
      };
    };
  };
  scan?: {
    workflows?: string;
    steps?: string;
    activities?: string;
  };
}

// ========== Resource Reference ==========

export interface ResourceRef {
  name: string;
  serviceName?: string;
}

export type ResourceType = 'step' | 'activity' | 'workflow';

// ========== Activity Options ==========

export interface ActivityOptions {
  maxAttempts?: number;
  timeout?: number;
}

// ========== Workflow Context ==========

export interface WorkflowContext {
  // Execute a step (local or remote)
  step: <T>(ref: ResourceRef, input: any) => Promise<T>;
  
  // Execute an activity (local or remote)
  activity: <T>(ref: ResourceRef, input: any, options?: ActivityOptions) => Promise<T>;
  
  // Execute steps in parallel
  parallel: <T>(steps: (() => Promise<T>)[]) => Promise<T[]>;
  
  // Pause execution
  sleep: (duration: { minutes?: number; hours?: number; seconds?: number }) => Promise<void>;
  
  // Execute a child workflow (local or remote)
  child: <T>(ref: ResourceRef, args: any[]) => Promise<T>;
}

type WorkflowFunction<T> = (ctx: WorkflowContext, ...args: any[]) => Promise<T>;

// ========== Decorators ==========

// Symbol keys for storing metadata
const STEPS_KEY = Symbol.for('aether.steps');
const ACTIVITIES_KEY = Symbol.for('aether.activities');
const WORKFLOWS_KEY = Symbol.for('aether.workflows');

// Extended target type with metadata storage
interface DecoratedTarget {
  [STEPS_KEY]?: Array<{ name: string; type: string; handler: Function; options?: object }>;
  [ACTIVITIES_KEY]?: Array<{ name: string; type: string; handler: Function; options?: object }>;
  [WORKFLOWS_KEY]?: Array<{ name: string; execute: Function }>;
  name?: string;
  prototype?: {
    execute: Function;
  };
}

export function step(name?: string): MethodDecorator {
  return function(target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    const stepName = name || String(propertyKey);
    
    // Store step metadata
    const decoratedTarget = target as DecoratedTarget;
    if (!decoratedTarget[STEPS_KEY]) {
      decoratedTarget[STEPS_KEY] = [];
    }
    decoratedTarget[STEPS_KEY]!.push({
      name: stepName,
      type: 'step',
      handler: method,
    });
    
    return descriptor;
  };
}

export function activity(options?: ActivityOptions, name?: string): MethodDecorator {
  return function(target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    const activityName = name || String(propertyKey);
    
    // Store activity metadata
    const decoratedTarget = target as DecoratedTarget;
    if (!decoratedTarget[ACTIVITIES_KEY]) {
      decoratedTarget[ACTIVITIES_KEY] = [];
    }
    decoratedTarget[ACTIVITIES_KEY]!.push({
      name: activityName,
      type: 'activity',
      options: options || {},
      handler: method,
    });
    
    return descriptor;
  };
}

export function workflow(name?: string): ClassDecorator {
  return function<T extends Function>(target: T): T {
    const workflowName = name || target.name;
    
    // Store workflow metadata
    const decoratedTarget = target as unknown as DecoratedTarget;
    if (!decoratedTarget[WORKFLOWS_KEY]) {
      decoratedTarget[WORKFLOWS_KEY] = [];
    }
    decoratedTarget[WORKFLOWS_KEY]!.push({
      name: workflowName,
      execute: (target as any).prototype.execute,
    });
    
    return target;
  };
}

// ========== Discovered Resources ==========

export interface DiscoveredResource {
  name: string;
  type: ResourceType;
  handler?: Function;
  className?: string;
}

export function discoverResources(target: any): DiscoveredResource[] {
  const resources: DiscoveredResource[] = [];
  const decoratedTarget = target as DecoratedTarget;
  
  // Discover steps
  const steps = decoratedTarget[STEPS_KEY] || [];
  for (const step of steps) {
    resources.push({
      name: toKebabCase(step.name),
      type: 'step',
      handler: step.handler,
      className: target.name,
    });
  }
  
  // Discover activities
  const activities = decoratedTarget[ACTIVITIES_KEY] || [];
  for (const activity of activities) {
    resources.push({
      name: toKebabCase(activity.name),
      type: 'activity',
      handler: activity.handler,
      className: target.name,
    });
  }
  
  // Discover workflows
  const workflows = decoratedTarget[WORKFLOWS_KEY] || [];
  for (const wf of workflows) {
    resources.push({
      name: toKebabCase(wf.name),
      type: 'workflow',
      className: target.name,
    });
  }
  
  return resources;
}

// Helper: Convert camelCase to kebab-case
function toKebabCase(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

// ========== Main Client ==========

export class AetherClient {
  private client: Client;
  private config: AetherConfig;

  constructor(config: AetherConfig) {
    this.config = config;
    this.client = new Client(config.serverUrl);
  }

  workflow<T extends Record<string, any>>(name: string, fn: WorkflowFunction<T>) {
    return new Workflow<T>(this.client, name, fn, this.config);
  }

  async serve(workflows: Workflow<any>[]) {
    console.log('Starting Aether server...');
    console.log(`Registered ${workflows.length} workflows`);
    
    if (this.config.services) {
      console.log(`Configured ${Object.keys(this.config.services).length} remote services`);
    }
  }
}

export { Workflow } from './workflow';

export function aether(config: AetherConfig): AetherClient {
  return new AetherClient(config);
}

export default aether;
