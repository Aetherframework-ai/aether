// sdks/trpc/src/procedure-builder-proxy.ts
import { AETHER_STEP_META, StepMeta, StepHandler } from './types';

/**
 * Type definitions for the step methods added by the proxy
 */
type MutationStepFn = {
  <TOutput>(handler: StepHandler<any>): any;
  <TOutput>(name: string, handler: StepHandler<any>): any;
};

type QueryStepFn = {
  <TOutput>(handler: StepHandler<any>): any;
  <TOutput>(name: string, handler: StepHandler<any>): any;
};

/**
 * Extended procedure builder type with mutationStep and queryStep methods
 */
export type ExtendedProcedureBuilder<T> = T & {
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
