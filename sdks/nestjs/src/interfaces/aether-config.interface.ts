/**
 * Aether NestJS Configuration and Metadata Interfaces
 *
 * Defines configuration options and metadata structures for
 * workflow, step, and activity registration.
 */

import { ResourceType } from '../aether.constants';

/**
 * Main configuration interface for the Aether NestJS SDK
 */
export interface AetherNestjsConfig {
  /**
   * Service name for this NestJS application
   * Used for service discovery and resource targeting
   */
  serviceName: string;

  /**
   * gRPC server host for Aether core
   * @default 'localhost'
   */
  host?: string;

  /**
   * gRPC server port for Aether core
   * @default 50051
   */
  port?: number;

  /**
   * Whether to enable automatic resource discovery
   * @default true
   */
  autoDiscover?: boolean;

  /**
   * Path to the proto file for gRPC communication
   * @default 'proto/aether.proto'
   */
  protoPath?: string;
}

/**
 * Default configuration values
 */
export const AETHER_NESTJS_DEFAULT_CONFIG: Partial<AetherNestjsConfig> = {
  host: 'localhost',
  port: 50051,
  autoDiscover: true,
  protoPath: 'proto/aether.proto',
};

/**
 * Base metadata interface for all Aether resources
 */
export interface BaseMetadata {
  /**
   * Unique name identifying this resource within the service
   */
  name: string;

  /**
   * Display name for UI purposes
   */
  displayName?: string;

  /**
   * Description of what this resource does
   */
  description?: string;

  /**
   * Tags for categorization and filtering
   */
  tags?: string[];
}

/**
 * Metadata for a Step definition
 */
export interface StepMetadata extends BaseMetadata {
  /**
   * Resource type identifier
   */
  type: ResourceType.STEP;

  /**
   * Activity to execute when this step runs
   * Can be a string reference or an ActivityOptions object
   */
  activity: string | ActivityOptions;

  /**
   * Whether this step can be retried on failure
   * @default true
   */
  retryable?: boolean;

  /**
   * Maximum number of retry attempts
   * @default 3
   */
  maxRetries?: number;

  /**
   * Timeout in milliseconds for this step
   * @default 30000 (30 seconds)
   */
  timeout?: number;
}

/**
 * Options for configuring an activity call
 */
export interface ActivityOptions {
  /**
   * Name of the activity method
   */
  name: string;

  /**
   * Service that implements this activity
   * If not provided, uses the current service
   */
  serviceName?: string;

  /**
   * Task queue for activity execution
   */
  taskQueue?: string;

  /**
   * Timeout in milliseconds
   * @default 30000
   */
  timeout?: number;

  /**
   * Retry policy configuration
   */
  retryPolicy?: RetryPolicy;
}

/**
 * Retry policy configuration
 */
export interface RetryPolicy {
  /**
   * Maximum number of attempts
   * @default 3
   */
  maxAttempts?: number;

  /**
   * Initial backoff interval in milliseconds
   * @default 1000
   */
  initialInterval?: number;

  /**
   * Maximum backoff interval in milliseconds
   * @default 60000
   */
  maxInterval?: number;

  /**
   * Backoff multiplier
   * @default 2.0
   */
  multiplier?: number;

  /**
   * Whether to retry on non-200 status codes
   * @default true
   */
  retryOnNon200?: boolean;
}

/**
 * Metadata for an Activity definition
 */
export interface ActivityMetadata extends BaseMetadata {
  /**
   * Resource type identifier
   */
  type: ResourceType.ACTIVITY;

  /**
   * Whether this activity is a singleton (one instance per service)
   * @default false
   */
  singleton?: boolean;

  /**
   * Default task queue for this activity
   */
  taskQueue?: string;

  /**
   * Default timeout in milliseconds
   * @default 30000
   */
  timeout?: number;
}

/**
 * Metadata for a Workflow definition
 */
export interface WorkflowMetadata extends BaseMetadata {
  /**
   * Resource type identifier
   */
  type: ResourceType.WORKFLOW;

  /**
   * List of step names or references that compose this workflow
   * Each entry can be a step name (string) or StepOptions object
   */
  steps: (string | StepOptions)[];

  /**
   * Default start-to-start timeout in milliseconds
   * @default 300000 (5 minutes)
   */
  startToStartTimeout?: number;

  /**
   * Default execution timeout in milliseconds
   * @default 600000 (10 minutes)
   */
  executionTimeout?: number;
}

/**
 * Options for configuring a step reference within a workflow
 */
export interface StepOptions {
  /**
   * Name of the step (must match a registered step)
   */
  name: string;

  /**
   * Alternative activity to use for this step
   * Overrides the step's default activity
   */
  activity?: string | ActivityOptions;

  /**
   * Whether to skip this step
   * @default false
   */
  skip?: boolean;

  /**
   * Timeout override for this specific step execution
   */
  timeout?: number;
}

/**
 * Type for metadata storage
 */
export type AetherMetadata =
  | StepMetadata
  | ActivityMetadata
  | WorkflowMetadata;
