//! Execution context and result management

pub struct ExecutionContext {
    // Execution context data
}

impl Default for ExecutionContext {
    fn default() -> Self {
        Self::new()
    }
}

impl ExecutionContext {
    pub fn new() -> Self {
        ExecutionContext {}
    }
}

#[derive(Debug)]
pub enum ExecutionStatus {
    Pending,
    Running,
    Completed,
    Failed,
}

pub struct ExecutionResult {
    pub status: ExecutionStatus,
    pub output: Option<String>,
    pub error: Option<String>,
}

impl ExecutionResult {
    pub fn new(status: ExecutionStatus) -> Self {
        ExecutionResult {
            status,
            output: None,
            error: None,
        }
    }

    pub fn success() -> Self {
        Self::new(ExecutionStatus::Completed)
    }

    pub fn failed(error: String) -> Self {
        ExecutionResult {
            status: ExecutionStatus::Failed,
            output: None,
            error: Some(error),
        }
    }
}
