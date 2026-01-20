/**
 * Aether NestJS SDK Interfaces
 *
 * Re-exports all interface definitions for convenient importing.
 */

// Configuration interfaces
export {
  AetherNestjsConfig,
  AETHER_NESTJS_DEFAULT_CONFIG,
  BaseMetadata,
  StepMetadata,
  ActivityMetadata,
  WorkflowMetadata,
  StepOptions,
  ActivityOptions,
  RetryPolicy,
  AetherMetadata,
} from './aether-config.interface';

// Resource reference interfaces
export {
  BaseResourceRef,
  StepRef,
  ActivityRef,
  WorkflowRef,
  AnyResourceRef,
  ResourceRegistrationOptions,
  AetherClient,
  WorkflowExecutionContext,
  WorkflowExecutionResult,
  WorkflowExecutionStatus,
  ActivityResult,
  StepResult,
} from './resource-ref.interface';

// Workflow context interfaces
export {
  ActivityContext,
  StepContext,
  WorkflowContext,
  ActivityHandler,
  StepHandler,
  WorkflowHandler,
  SignalHandler,
  QueryHandler,
  WorkflowRegistration,
  ActivityRegistration,
  StepRegistration,
} from './workflow-context.interface';
