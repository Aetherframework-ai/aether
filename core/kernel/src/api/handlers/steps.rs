use axum::{
    extract::{Path, State},
    Json,
};
use std::sync::Arc;

use crate::api::error::ApiError;
use crate::api::models::{CompleteStepRequest, ReportStepRequest, StepResponse};
use crate::persistence::Persistence;
use crate::scheduler::Scheduler;

pub type AppState<P> = Arc<Scheduler<P>>;

/// Parse task_id to extract workflow_id and step_name.
/// Format: workflow_id-step_name (workflow_id is UUID with dashes)
fn parse_task_id(task_id: &str) -> Result<(&str, &str), ApiError> {
    let parts: Vec<&str> = task_id.rsplitn(2, '-').collect();
    if parts.len() != 2 {
        return Err(ApiError::bad_request(
            "INVALID_TASK_ID",
            &format!("Invalid task_id format: {}", task_id),
        ));
    }
    let step_name = parts[0];
    let workflow_id = parts[1];
    Ok((workflow_id, step_name))
}

/// POST /steps/{taskId}/report - Report step status
#[utoipa::path(
    post,
    path = "/steps/{taskId}/report",
    params(("taskId" = String, Path, description = "Task ID")),
    request_body = ReportStepRequest,
    responses(
        (status = 200, description = "Step status reported", body = StepResponse),
        (status = 400, description = "Invalid input"),
        (status = 404, description = "Task not found"),
    ),
    tag = "steps"
)]
pub async fn report_step<P: Persistence + Clone + Send + Sync + 'static>(
    State(scheduler): State<AppState<P>>,
    Path(task_id): Path<String>,
    Json(req): Json<ReportStepRequest>,
) -> Result<Json<StepResponse>, ApiError> {
    // Validate status
    let status_upper = req.status.to_uppercase();
    if !["STARTED", "RUNNING", "COMPLETED", "FAILED"].contains(&status_upper.as_str()) {
        return Err(ApiError::bad_request(
            "INVALID_STATUS",
            &format!("Invalid step status: {}", req.status),
        ));
    }

    // Parse task_id to get workflow_id and step_name
    let (workflow_id, step_name) = parse_task_id(&task_id)?;

    // Use tracker to record step status
    match status_upper.as_str() {
        "STARTED" | "RUNNING" => {
            scheduler
                .tracker
                .step_started(workflow_id, step_name, vec![], vec![])
                .await;
        }
        "COMPLETED" => {
            let message_bytes = req
                .message
                .as_ref()
                .map(|m| m.as_bytes().to_vec())
                .unwrap_or_default();
            scheduler
                .tracker
                .step_completed(workflow_id, step_name, message_bytes)
                .await;
        }
        "FAILED" => {
            let error_msg = req.message.clone().unwrap_or_else(|| "Unknown error".to_string());
            scheduler
                .tracker
                .step_failed(workflow_id, step_name, error_msg)
                .await;
        }
        _ => {}
    }

    Ok(Json(StepResponse { success: true }))
}

/// POST /steps/{taskId}/complete - Complete a step
#[utoipa::path(
    post,
    path = "/steps/{taskId}/complete",
    params(("taskId" = String, Path, description = "Task ID")),
    request_body = CompleteStepRequest,
    responses(
        (status = 200, description = "Step completed", body = StepResponse),
        (status = 400, description = "Invalid input"),
        (status = 404, description = "Task not found"),
    ),
    tag = "steps"
)]
pub async fn complete_step<P: Persistence + Clone + Send + Sync + 'static>(
    State(scheduler): State<AppState<P>>,
    Path(task_id): Path<String>,
    Json(req): Json<CompleteStepRequest>,
) -> Result<Json<StepResponse>, ApiError> {
    // Convert output to bytes
    let output_bytes = req
        .output
        .map(|o| serde_json::to_vec(&o))
        .transpose()
        .map_err(|e| ApiError::bad_request("INVALID_OUTPUT", &e.to_string()))?
        .unwrap_or_default();

    // If there's an error, mark as failed; otherwise complete
    if let Some(error) = req.error {
        // Parse task_id to get workflow_id and step_name for failure tracking
        let (workflow_id, step_name) = parse_task_id(&task_id)?;
        scheduler
            .tracker
            .step_failed(workflow_id, step_name, error)
            .await;
        return Ok(Json(StepResponse { success: true }));
    }

    // Complete the task using scheduler
    scheduler
        .complete_task(&task_id, output_bytes)
        .await
        .map_err(|e| ApiError::internal(&e.to_string()))?;

    Ok(Json(StepResponse { success: true }))
}
