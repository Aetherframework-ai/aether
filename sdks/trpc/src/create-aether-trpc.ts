// sdks/trpc/src/create-aether-trpc.ts
import { initTRPC } from '@trpc/server';
import type { AnyRouter } from '@trpc/server';
import { Client } from '@aetherframework.ai/sdk';
import { createProcedureBuilderProxy, ExtendedProcedureBuilder } from './procedure-builder-proxy';
import {
  AetherTrpcConfig,
  StepRegistry,
  AETHER_STEP_META,
  StepMeta,
  RegisteredStepWithPath,
} from './types';

type OriginalTRPC = ReturnType<typeof initTRPC.create>;

/**
 * Extended tRPC instance with Aether step support.
 * The `procedure` property returns an ExtendedProcedureBuilder that includes
 * `mutationStep` and `queryStep` methods.
 */
export type AetherTRPC = Omit<OriginalTRPC, 'procedure'> & {
  procedure: ExtendedProcedureBuilder<OriginalTRPC['procedure']>;
};

interface AetherTask {
  taskId: string;
  stepName: string;
  workflowId: string;
  workflowType: string;
  input: unknown;
}

export interface AetherInstance {
  bindRouter(router: AnyRouter, prefix?: string): void;
  serve(): Promise<void>;
  stop(): void;
  getSteps(): StepRegistry;
  getWorkerId(): string;
  /** Get the Aether client for workflow operations */
  getClient(): Client;
  /** Get the config for fallback behavior */
  getConfig(): AetherTrpcConfig;
}

export function createAetherTrpc(config: AetherTrpcConfig): {
  t: AetherTRPC;
  aether: AetherInstance;
} {
  const originalT = initTRPC.create();

  // Wrap t object so that t.procedure supports mutationStep/queryStep
  const t = new Proxy(originalT, {
    get(target, prop, receiver) {
      if (prop === 'procedure') {
        return createProcedureBuilderProxy(target.procedure);
      }
      return Reflect.get(target, prop, receiver);
    },
  }) as unknown as AetherTRPC;

  // Create aether instance
  const client = new Client(config.serverUrl);
  const workerId = config.workerId || `trpc-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const steps: Map<string, RegisteredStepWithPath> = new Map();
  let isRunning = false;
  let pollingInterval: NodeJS.Timeout | undefined;

  const aether: AetherInstance = {
    bindRouter(router: AnyRouter, prefix = '') {
      const procedures = (router as any)._def.procedures || (router as any)._def.record;

      if (!procedures) {
        console.warn('[AetherTrpc] No procedures found in router');
        return;
      }

      for (const [key, procedure] of Object.entries(procedures)) {
        const path = prefix ? `${prefix}.${key}` : key;

        // Check if this is a nested router
        if ((procedure as any)?._def?.procedures || (procedure as any)?._def?.record) {
          aether.bindRouter(procedure as AnyRouter, path);
          continue;
        }

        // Check if it has step metadata
        const meta = (procedure as any)?.[AETHER_STEP_META] as StepMeta | undefined;
        if (!meta) continue;

        // Determine step name
        const stepName = meta.explicitName ?? path;

        // Check for duplicates
        if (steps.has(stepName)) {
          const existing = steps.get(stepName)!;
          throw new Error(
            `[AetherTrpc] Duplicate step name "${stepName}": ` +
            `both "${existing.path}" and "${path}" resolve to this name. ` +
            `Please use explicit names to resolve the conflict.`
          );
        }

        steps.set(stepName, {
          name: stepName,
          handler: meta.handler,
          path,
        });
      }
    },

    async serve() {
      if (isRunning) {
        console.warn('[AetherTrpc] Worker is already running');
        return;
      }

      if (steps.size === 0) {
        throw new Error('[AetherTrpc] No steps registered. Did you forget to call bindRouter()?');
      }

      // Note: Aether server currently uses 'language' field as 'workflow_types'
      // So we put step names here to enable task matching
      const stepNames = Array.from(steps.keys());

      await client.register({
        workerId,
        serviceName: config.serviceName,
        group: config.group || 'default',
        language: stepNames,  // Used as workflow_types by Aether server
        provides: Array.from(steps.values()).map((s) => ({
          name: s.name,
          type: 1,
        })),
      });

      isRunning = true;
      startPolling();
    },

    stop() {
      isRunning = false;
      if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = undefined;
      }
    },

    getSteps() {
      return steps as StepRegistry;
    },

    getWorkerId() {
      return workerId;
    },

    getClient() {
      return client;
    },

    getConfig() {
      return config;
    },
  };

  function startPolling() {
    console.log('[AetherTrpc] Starting polling, registered steps:', Array.from(steps.keys()));
    pollingInterval = setInterval(async () => {
      if (!isRunning) return;

      try {
        const tasks = await client.pollTasksOnce(workerId, 10);

        if (tasks.length > 0) {
          console.log('[AetherTrpc] Received tasks:', tasks.map(t => ({ stepName: t.stepName, workflowType: t.workflowType, taskId: t.taskId })));
        }

        for (const task of tasks) {
          await handleTask(task);
        }
      } catch (error: any) {
        console.error('[AetherTrpc] Polling error:', error.message);
      }
    }, 200);
  }

  async function handleTask(task: AetherTask) {
    // For "start" step, look up handler by workflowType (used by single-step auto-workflows)
    let step = steps.get(task.stepName);
    const effectiveStepName = task.stepName === 'start' && !step && task.workflowType
      ? task.workflowType
      : task.stepName;

    if (!step && task.stepName === 'start' && task.workflowType) {
      step = steps.get(task.workflowType);
    }

    if (!step) {
      console.error(`[AetherTrpc] No handler for step: ${effectiveStepName}`);
      await client.completeStep(task.taskId, {}, `No handler: ${effectiveStepName}`);
      return;
    }

    // Inject worker context
    const ctx = {
      __aetherTask: true,
      __workflowId: task.workflowId,
      __taskId: task.taskId,
    };

    try {
      await client.reportStepStarted(task.workflowId, effectiveStepName, task.input);
      const result = await step.handler({ input: task.input, ctx });
      await client.reportStepCompleted(task.workflowId, effectiveStepName, result);
      await client.completeStep(task.taskId, result);
    } catch (error: any) {
      await client.reportStepFailed(task.workflowId, effectiveStepName, error.message);
      await client.completeStep(task.taskId, {}, error.message);
    }
  }

  return { t, aether };
}
