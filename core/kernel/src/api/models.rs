use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

// === Workflow Models ===

#[derive(Debug, Deserialize, ToSchema)]
pub struct CreateWorkflowRequest {
    #[serde(rename = "workflowType")]
    pub workflow_type: String,
    pub input: serde_json::Value,
    #[serde(default)]
    pub options: Option<WorkflowOptions>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct WorkflowOptions {
    #[serde(rename = "workflowId")]
    pub workflow_id: Option<String>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct CreateWorkflowResponse {
    #[serde(rename = "workflowId")]
    pub workflow_id: String,
    pub status: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct WorkflowStatusResponse {
    #[serde(rename = "workflowId")]
    pub workflow_id: String,
    pub status: String,
    #[serde(rename = "currentStep", skip_serializing_if = "Option::is_none")]
    pub current_step: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct WorkflowResultResponse {
    #[serde(rename = "workflowId")]
    pub workflow_id: String,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub output: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct CancelWorkflowResponse {
    pub success: bool,
    pub message: String,
}

// === Worker Models ===

#[derive(Debug, Deserialize, ToSchema)]
pub struct RegisterWorkerRequest {
    #[serde(rename = "serviceName")]
    pub service_name: String,
    #[serde(default)]
    pub resources: Vec<ResourceInfo>,
}

#[derive(Debug, Deserialize, Serialize, ToSchema)]
pub struct ResourceInfo {
    pub name: String,
    #[serde(rename = "type")]
    pub resource_type: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct RegisterWorkerResponse {
    #[serde(rename = "workerId")]
    pub worker_id: String,
    #[serde(rename = "sessionToken")]
    pub session_token: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct HeartbeatResponse {
    pub success: bool,
    #[serde(rename = "nextHeartbeat")]
    pub next_heartbeat: u64,
}

// === Step Models ===

#[derive(Debug, Deserialize, ToSchema)]
pub struct ReportStepRequest {
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct CompleteStepRequest {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub output: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct StepResponse {
    pub success: bool,
}

// === WebSocket Models ===

#[derive(Debug, Serialize, ToSchema)]
pub struct TaskMessage {
    #[serde(rename = "type")]
    pub msg_type: String,
    pub payload: TaskPayload,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct TaskPayload {
    #[serde(rename = "taskId")]
    pub task_id: String,
    #[serde(rename = "workflowId")]
    pub workflow_id: String,
    #[serde(rename = "stepName")]
    pub step_name: String,
    pub input: serde_json::Value,
    #[serde(rename = "retryPolicy", skip_serializing_if = "Option::is_none")]
    pub retry_policy: Option<RetryPolicy>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct RetryPolicy {
    #[serde(rename = "maxRetries")]
    pub max_retries: u32,
    pub backoff: String,
}

// === Admin Models ===

#[derive(Debug, Serialize, ToSchema)]
pub struct MetricsResponse {
    #[serde(rename = "activeWorkflows")]
    pub active_workflows: u64,
    #[serde(rename = "completedWorkflows")]
    pub completed_workflows: u64,
    #[serde(rename = "failedWorkflows")]
    pub failed_workflows: u64,
}
