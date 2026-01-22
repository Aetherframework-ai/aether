#[cfg(feature = "dashboard")]
pub mod dashboard_assets;
#[cfg(feature = "dashboard")]
pub mod dashboard_server;

pub mod broadcaster;
pub mod execution;
pub mod grpc_server;
pub mod kernel;
pub mod persistence;
pub mod scheduler;
pub mod server;
pub mod service_registry;
pub mod state_machine;
pub mod task;
pub mod tracker;
pub mod worker;
pub mod workflow;

#[rustfmt::skip]
#[path = "proto/aether.v1.rs"]
pub mod proto;

pub use broadcaster::{EventBroadcaster, EventPayload, EventType, WorkflowEvent};
pub use execution::{ExecutionContext, ExecutionResult};
pub use kernel::AetherKernel;
pub use service_registry::{ServiceInfo, ServiceRegistry};
pub use state_machine::{Workflow, WorkflowState};
pub use task::{ResourceType, RetryPolicy, ServiceResource, Task};
pub use tracker::{StepExecution, StepExecutionStatus, WorkflowExecution, WorkflowTracker};
pub use workflow::WorkflowExecutor;
