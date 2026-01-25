/// Resource type enumeration
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub enum ResourceType {
    Step = 0,
    Activity = 1,
    Workflow = 2,
}

/// Task metadata for activity retry configuration
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ResourceMetadata {
    pub max_attempts: Option<u32>,
    pub timeout: Option<u64>,
    pub input_schema: Option<String>,
    pub output_schema: Option<String>,
}

/// A resource offered by a service
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ServiceResource {
    pub name: String,
    pub resource_type: ResourceType,
    pub metadata: Option<ResourceMetadata>,
}

#[derive(Debug, Clone)]
pub struct Task {
    pub task_id: String,
    pub workflow_id: String,
    pub step_name: String,
    pub target_service: Option<String>,
    pub target_resource: Option<String>,
    pub resource_type: ResourceType,
    pub input: Vec<u8>,
    pub retry: Option<RetryPolicy>,
    pub workflow_type: String,
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
