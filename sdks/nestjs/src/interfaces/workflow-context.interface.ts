/**
 * Aether Workflow Context Interface
 *
 * Defines the context object available to workflow, step, and activity
 * methods during execution.
 */

import { ActivityOptions, StepOptions } from './aether-config.interface';
import {
  ActivityResult,
  StepResult,
  WorkflowExecutionContext,
  WorkflowExecutionStatus,
} from './resource-ref.interface';

/**
 * Context available to activity methods
 */
export interface ActivityContext {
  /**
   * Name of the current activity
   */
  activityName: string;

  /**
   * Workflow execution context
   */
  executionContext: WorkflowExecutionContext;

  /**
   * Input data for this activity
   */
  input: unknown;

  /**
   * Get a value from the workflow context
   */
  get<T = unknown>(key: string): T | undefined;

  /**
   * Set a value in the workflow context
   * This value will be available to subsequent steps
   */
  set(key: string, value: unknown): void;

  /**
   * Log a message
   */
  log(message: string, metadata?: Record<string, unknown>): void;

  /**
   * Create a heartbeat for long-running activities
   */
  heartbeat(details?: unknown): Promise<void>;

  /**
   * Get the current attempt number
   */
  getAttempt(): number;

  /**
   * Throw an application failure that won't be retried
   */
  failApplication(reason: string, details?: unknown): never;
}

/**
 * Context available to step methods
 */
export interface StepContext {
  /**
   * Name of the current step
   */
  stepName: string;

  /**
   * Workflow execution context
   */
  executionContext: WorkflowExecutionContext;

  /**
   * Input data for this step
   */
  input: unknown;

  /**
   * Execute an activity within this step
   */
  activity<T = unknown>(
    activityRef: string | ActivityOptions,
    input: unknown,
  ): Promise<ActivityResult<T>>;

  /**
   * Execute a nested workflow within this step
   */
  workflow<T = unknown>(
    workflowRef: string,
    input: unknown,
  ): Promise<unknown>;

  /**
   * Get a value from the workflow context
   */
  get<T = unknown>(key: string): T | undefined;

  /**
   * Set a value in the workflow context
   */
  set(key: string, value: unknown): void;

  /**
   * Continue as a new workflow execution
   */
  continueAsNew(input: unknown, reason?: string): never;

  /**
   * Log a message
   */
  log(message: string, metadata?: Record<string, unknown>): void;
}

/**
 * Context available to workflow methods
 */
export interface WorkflowContext {
  /**
   * Name of the current workflow
   */
  workflowName: string;

  /**
   * Workflow execution context
   */
  executionContext: WorkflowExecutionContext;

  /**
   * Input data for this workflow
   */
  input: unknown;

  /**
   * Result of the last step (for chaining)
   */
  lastStepResult: unknown;

  /**
   * Execute a step in this workflow
   */
  step<T = unknown>(
    stepRef: string | StepOptions,
    input?: unknown,
  ): Promise<StepResult<T>>;

  /**
   * Execute an activity directly (bypassing step definition)
   */
  activity<T = unknown>(
    activityRef: string | ActivityOptions,
    input: unknown,
  ): Promise<ActivityResult<T>>;

  /**
   * Execute a nested workflow
   */
  nestedWorkflow<T = unknown>(
    workflowRef: string,
    input: unknown,
  ): Promise<unknown>;

  /**
   * Get a value from the workflow context
   */
  get<T = unknown>(key: string): T | undefined;

  /**
   * Set a value in the workflow context
   */
  set(key: string, value: unknown): void;

  /**
   * Signal this workflow
   */
  signal(signalName: string, payload: unknown): Promise<void>;

  /**
   * Query this workflow
   */
  query<T = unknown>(queryType: string, args?: unknown[]): Promise<T>;

  /**
   * Get the current workflow status
   */
  getStatus(): WorkflowExecutionStatus;

  /**
   * Check if the workflow is still running
   */
  isRunning(): boolean;

  /**
   * Complete the workflow with a result
   */
  complete(result: unknown): never;

  /**
   * Fail the workflow with an error
   */
  fail(error: string | Error, details?: unknown): never;

  /**
   * Cancel the workflow
   */
  cancel(reason?: string): never;

  /**
   * Log a message
   */
  log(message: string, metadata?: Record<string, unknown>): void;

  /**
   * Create a timer (pause execution for a duration)
   */
  timer(durationMs: number): Promise<void>;

  /**
   * Wait for a signal with a specific name
   */
  waitForSignal<T = unknown>(signalName: string, timeoutMs?: number): Promise<T>;
}

/**
 * Handler type for activity methods
 */
export type ActivityHandler<TInput = unknown, TOutput = unknown> = (
  ctx: ActivityContext,
  input: TInput,
) => Promise<TOutput> | TOutput;

/**
 * Handler type for step methods (for custom step implementations)
 */
export type StepHandler<TInput = unknown, TOutput = unknown> = (
  ctx: StepContext,
  input: TInput,
) => Promise<TOutput> | TOutput;

/**
 * Handler type for workflow methods
 */
export type WorkflowHandler<TInput = unknown, TOutput = unknown> = (
  ctx: WorkflowContext,
  input: TInput,
) => Promise<TOutput> | TOutput;

/**
 * Type for workflow signal handlers
 */
export type SignalHandler<T = unknown> = (ctx: WorkflowContext, payload: T) => void;

/**
 * Type for workflow query handlers
 */
export type QueryHandler<TArgs extends unknown[] = unknown[], TOutput = unknown> = (
  ctx: WorkflowContext,
  ...args: TArgs
) => Promise<TOutput> | TOutput;

/**
 * Interface for workflow registration
 */
export interface WorkflowRegistration {
  /**
   * Name of the workflow
   */
  name: string;

  /**
   * Handler function for the workflow
   */
  handler: WorkflowHandler;

  /**
   * Signal handlers registered for this workflow
   */
  signalHandlers?: Record<string, SignalHandler>;

  /**
   * Query handlers registered for this workflow
   */
  queryHandlers?: Record<string, QueryHandler>;
}

/**
 * Interface for activity registration
 */
export interface ActivityRegistration {
  /**
   * Name of the activity
   */
  name: string;

  /**
   * Handler function for the activity
   */
  handler: ActivityHandler;

  /**
   * Whether this activity is a singleton
   */
  singleton?: boolean;
}

/**
 * Interface for step registration
 */
export interface StepRegistration {
  /**
   * Name of the step
   */
  name: string;

  /**
   * Handler function for the step (optional, for custom steps)
   */
  handler?: StepHandler;

  /**
   * Activity to execute for this step
   */
  activity: string | ActivityOptions;
}
