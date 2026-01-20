/**
 * Aether NestJS SDK Constants
 *
 * This file contains all constants used throughout the Aether NestJS SDK,
 * including metadata keys for decorators and injection tokens for dependency injection.
 */

export const AETHER_STEP_METADATA = Symbol('AETHER_STEP_METADATA');

export const AETHER_ACTIVITY_METADATA = Symbol('AETHER_ACTIVITY_METADATA');

export const AETHER_WORKFLOW_METADATA = Symbol('AETHER_WORKFLOW_METADATA');

export const AETHER_CONTEXT_METADATA = Symbol('AETHER_CONTEXT_METADATA');

export const AETHER_CLIENT_TOKEN = 'AETHER_CLIENT_TOKEN';

export const AETHER_METADATA_STORAGE_TOKEN = 'AETHER_METADATA_STORAGE_TOKEN';

export const AETHER_CONFIG_TOKEN = 'AETHER_CONFIG_TOKEN';

export enum ResourceType {
  STEP = 'Step',
  ACTIVITY = 'Activity',
  WORKFLOW = 'Workflow',
}

export const RESOURCE_REF_SYMBOL = Symbol('RESOURCE_REF');
