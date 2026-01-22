/**
 * Aether NestJS SDK
 *
 * This module provides integration between NestJS and the Aether workflow engine,
 * allowing tRPC endpoints to be registered as Aether steps and activities.
 */

// Main module
export { AetherModule, AetherModuleOptions, AetherModuleAsyncOptions } from "./aether.module";

// Constants and tokens
export {
  AETHER_CONFIG_TOKEN,
  AETHER_STEP_METADATA,
  AETHER_ACTIVITY_METADATA,
  AETHER_WORKFLOW_METADATA,
  AETHER_CONTEXT_METADATA,
  AETHER_CLIENT_TOKEN,
  AETHER_METADATA_STORAGE_TOKEN,
  ResourceType,
  RESOURCE_REF_SYMBOL,
} from "./aether.constants";

// Worker service
export {
  AetherWorkerService,
  AetherWorkerConfig,
  RegisteredHandler,
  AETHER_STEP_REGISTRY_TOKEN,
} from "./providers/aether-worker.service";

// Interfaces
export * from "./interfaces";
