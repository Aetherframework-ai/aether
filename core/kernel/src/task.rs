#[derive(Debug, Clone)]
pub struct Task {
    pub task_id: String,
    pub workflow_id: String,
    pub step_name: String,
    pub input: Vec<u8>,
    pub retry: Option<RetryPolicy>,
}

#[derive(Debug, Clone)]
pub struct RetryPolicy {
    pub max_attempts: u32,
    pub initial_interval: u64,
    pub backoff_multiplier: f64,
}

impl Default for RetryPolicy {
    fn default() -> Self {
        RetryPolicy {
            max_attempts: 3,
            initial_interval: 1000,
            backoff_multiplier: 2.0,
        }
    }
}
