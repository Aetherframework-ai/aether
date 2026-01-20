pub mod execution;
pub mod kernel;
pub mod scheduler;
pub mod state_machine;
pub mod task;
pub mod workflow;
pub mod persistence;
pub mod worker;
pub mod grpc_server;
pub mod server;

#[path = "proto/aether.rs"]
pub mod proto;

pub use execution::{ExecutionContext, ExecutionResult};
pub use kernel::AetherKernel;
pub use state_machine::{Workflow, WorkflowState};
pub use task::{RetryPolicy, Task};
pub use workflow::WorkflowExecutor;
