pub mod execution;
pub mod grpc_server;
pub mod kernel;
pub mod persistence;
pub mod scheduler;
pub mod server;
pub mod service_registry;
pub mod state_machine;
pub mod task;
pub mod worker;
pub mod workflow;

#[path = "proto/aether.v1.rs"]
pub mod proto;

pub use execution::{ExecutionContext, ExecutionResult};
pub use kernel::AetherKernel;
pub use service_registry::{ServiceInfo, ServiceRegistry};
pub use state_machine::{Workflow, WorkflowState};
pub use task::{ResourceType, RetryPolicy, ServiceResource, Task};
pub use workflow::WorkflowExecutor;
