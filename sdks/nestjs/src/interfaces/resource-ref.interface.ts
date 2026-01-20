/**
 * Aether Resource Reference Interfaces
 *
 * Defines interfaces for referencing resources (steps, activities, workflows)
 * within the Aether ecosystem.
 */

import { ResourceType } from '../aether.constants';
import { ActivityOptions } from './aether-config.interface';

/**
 * Base interface for all resource references
 */
export interface BaseResourceRef {
  /**
   * Name of the resource
   */
  name: string;

  /**
   * Type of resource being referenced
   */
  resourceType: ResourceType;
}

/**
 * Reference to a Step resource
 */
export interface StepRef extends BaseResourceRef {
  /**
   * Resource type identifier
   */
  resourceType: ResourceType.STEP;

  /**
   * Activity to execute for this step
   */
  activity: string | ActivityOptions;
}

/**
 * Reference to an Activity resource
 */
export interface ActivityRef extends BaseResourceRef {
  /**
   * Resource type identifier
   */
  resourceType: ResourceType.ACTIVITY;
}

/**
 * Reference to a Workflow resource
 */
export interface WorkflowRef extends BaseResourceRef {
  /**
   * Resource type identifier
   */
  resourceType: ResourceType.WORKFLOW;
}

/**
 * Union type for all resource references
 */
export type AnyResourceRef = StepRef | ActivityRef | WorkflowRef;

/**
 * Options for resource registration
 */
export interface ResourceRegistrationOptions {
  /**
   * Whether this resource is exported for use by other services
   * @default true
   */
  exported?: boolean;

  /**
   * Version string for this resource
   * Used for versioning and compatibility checking
   */
  version?: string;
}

/**
 * Interface for the Aether client used for making gRPC calls
 */
export interface AetherClient {
  /**
   * Register a resource with Aether core
   */
  registerResource(
    resource: AnyResourceRef,
    options?: ResourceRegistrationOptions,
  ): Promise<void>;

  /**
   * Unregister a resource from Aether core
   */
  unregisterResource(
    name: string,
    resourceType: ResourceType,
  ): Promise<void>;

  /**
   * Execute a step and return the result
   */
  executeStep(
    stepRef: StepRef,
    input: unknown,
    context?: WorkflowExecutionContext,
  ): Promise<unknown>;

  /**
   * Execute an activity and return the result
   */
  executeActivity(
    activityRef: string | ActivityRef,
    input: unknown,
    context?: WorkflowExecutionContext,
  ): Promise<unknown>;

  /**
   * Start a workflow execution
   */
  startWorkflow(
    workflowRef: string | WorkflowRef,
    input: unknown,
    context?: WorkflowExecutionContext,
  ): Promise<WorkflowExecutionResult>;

  /**
   * Signal a running workflow
   */
  signalWorkflow(
    executionId: string,
    signalName: string,
    payload: unknown,
  ): Promise<void>;

   /**
   * Query the state of a workflow execution
   */
  queryWorkflow(
    executionId: string,
    queryType: string,
    args?: ReadonlyArray<unknown>,
  ): Promise<unknown>;
}

/**
 * Context information for workflow execution
 */
export interface WorkflowExecutionContext {
  /**
   * Unique execution ID for this workflow run
   */
  executionId: string;

  /**
   * ID of the workflow being executed
   */
  workflowId: string;

  /**
   * Current attempt number (for retries)
   */
  attempt: number;

  /**
   * Task token for this execution
   */
  taskToken: string;

  /**
   * Header metadata from the workflow start
   */
  headers?: Record<string, string>;

  /**
   * Additional context data
   */
  data?: Record<string, unknown>;
}

/**
 * Status of a workflow execution
 */
export enum WorkflowExecutionStatus {
  RUNNING = 'Running',
  COMPLETED = 'Completed',
  FAILED = 'Failed',
  TIMED_OUT = 'TimedOut',
  CANCELLED = 'Cancelled',
  TERMINATED = 'Terminated',
}

/**
 * Result of a workflow execution
 */
export interface WorkflowExecutionResult {
  /**
   * Unique execution ID
   */
  executionId: string;

  /**
   * Final status of the workflow
   */
  status: WorkflowExecutionStatus;

  /**
   * Output from the workflow (if completed successfully)
   */
  output?: unknown;

  /**
   * Error message (if failed)
   */
  error?: string;

  /**
   * Error details (if failed)
   */
  errorDetails?: unknown;

  /**
   * When the workflow started
   */
  startTime: Date;

  /**
   * When the workflow completed
   */
  endTime?: Date;

  /**
   * Duration in milliseconds
   */
  duration?: number;
}

/**
 * Interface for activity result
 */
export interface ActivityResult<T = unknown> {
  /**
   * Whether the activity succeeded
   */
  success: boolean;

  /**
   * Result data (if successful)
   */
  result?: T;

  /**
   * Error message (if failed)
   */
  error?: string;

  /**
   * Retry count for this attempt
   */
  attempt: number;
}

/**
 * Interface for step result
 */
export interface StepResult<T = unknown> {
  /**
   * Name of the step
   */
  stepName: string;

  /**
   * Whether the step succeeded
   */
  success: boolean;

  /**
   * Output from the step
   */
  output?: T;

  /**
   * Error message (if failed)
   */
  error?: string;

  /**
   * Duration in milliseconds
   */
  duration: number;

  /**
   * Timestamp when the step started
   */
  startTime: Date;

  /**
   * Timestamp when the step completed
   */
  endTime: Date;
}
