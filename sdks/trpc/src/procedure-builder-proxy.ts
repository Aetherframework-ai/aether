// sdks/trpc/src/procedure-builder-proxy.ts
import { AETHER_STEP_META, StepMeta, StepHandler, AetherTrpcConfig } from './types';

/**
 * Check if an error is a connection error (Aether server unavailable)
 */
export function isConnectionError(error: any): boolean {
  return error?.code === 14  // gRPC UNAVAILABLE
    || error?.message?.includes('ECONNREFUSED')
    || error?.message?.includes('ETIMEDOUT');
}

/**
 * Handle errors during workflow creation with configurable fallback
 */
export async function handleFallback(
  error: any,
  handler: StepHandler,
  opts: { input: any; ctx: any },
  config: AetherTrpcConfig
): Promise<any> {
  // Only fallback for connection errors
  if (!isConnectionError(error)) {
    throw error;
  }

  const fallback = config.fallbackOnError ?? 'error';

  if (fallback === 'error') {
    const err = new Error(`Aether server unavailable: ${error.message}`);
    (err as any).code = 'SERVICE_UNAVAILABLE';
    throw err;
  }

  if (fallback === 'warn') {
    console.warn(
      `[AetherTrpc] Aether unavailable, falling back to local execution:`,
      error.message
    );
  }

  // 'local' or 'warn' mode: execute handler locally
  return handler(opts);
}

/**
 * Type definitions for the step methods added by the proxy
 */
type MutationStepFn = {
  (handler: StepHandler<any>): any;
  (name: string, handler: StepHandler<any>): any;
};

type QueryStepFn = {
  (handler: StepHandler<any>): any;
  (name: string, handler: StepHandler<any>): any;
};

// Methods on ProcedureBuilder that return a new ProcedureBuilder
type ChainableMethods = 'input' | 'output' | 'use' | 'meta' | 'unstable_concat';

/**
 * Helper type to wrap chainable methods to return ExtendedProcedureBuilder
 */
type WrapChainableMethods<T> = {
  [K in keyof T]: K extends ChainableMethods
    ? T[K] extends (...args: infer A) => infer R
      ? (...args: A) => ExtendedProcedureBuilder<R>
      : T[K]
    : T[K];
};

/**
 * Extended procedure builder type with mutationStep and queryStep methods.
 * Only chainable methods (input, output, use, meta) are wrapped to preserve
 * the extended methods through the chain.
 */
export type ExtendedProcedureBuilder<T> = WrapChainableMethods<T> & {
  mutationStep: MutationStepFn;
  queryStep: QueryStepFn;
};

/**
 * Creates a step method (mutationStep or queryStep) that wraps the original
 * mutation/query method and attaches StepMeta to the result
 */
function createStepMethod(
  procedureBuilder: any,
  type: 'mutation' | 'query'
) {
  return function (...args: any[]) {
    let explicitName: string | undefined;
    let handler: StepHandler;

    if (typeof args[0] === 'string') {
      explicitName = args[0];
      handler = args[1];
    } else {
      handler = args[0];
    }

    // Call the original mutation/query method
    const procedure = procedureBuilder[type](handler);

    // Attach step metadata
    const meta: StepMeta = {
      handler,
      type,
      explicitName,
    };

    procedure[AETHER_STEP_META] = meta;

    return procedure;
  };
}

/**
 * Creates a Proxy wrapper around tRPC's ProcedureBuilder to inject
 * `mutationStep` and `queryStep` methods.
 *
 * Key behaviors:
 * - When accessing `mutationStep` or `queryStep`, return a function that
 *   creates the procedure and attaches StepMeta
 * - When calling methods like `.input()` that return a new ProcedureBuilder,
 *   also wrap the result
 * - Support both `handler` and `(name, handler)` signatures
 *
 * @param procedureBuilder - The tRPC ProcedureBuilder to wrap
 * @returns A proxied ProcedureBuilder with mutationStep and queryStep methods
 */
export function createProcedureBuilderProxy<T extends object>(
  procedureBuilder: T
): ExtendedProcedureBuilder<T> {
  return new Proxy(procedureBuilder, {
    get(target, prop, receiver) {
      if (prop === 'mutationStep') {
        return createStepMethod(target, 'mutation');
      }
      if (prop === 'queryStep') {
        return createStepMethod(target, 'query');
      }

      const value = Reflect.get(target, prop, receiver);

      // If the returned value is a function, wrap it to also proxy the result
      // when it returns a new ProcedureBuilder (e.g., after calling .input())
      if (typeof value === 'function') {
        return function (this: any, ...args: any[]) {
          const result = value.apply(target, args);
          // Check if result is a ProcedureBuilder (has _def and mutation/query methods)
          if (result && typeof result === 'object' && '_def' in result && 'mutation' in result) {
            return createProcedureBuilderProxy(result);
          }
          return result;
        };
      }

      return value;
    },
  }) as ExtendedProcedureBuilder<T>;
}
