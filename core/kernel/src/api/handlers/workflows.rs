use axum::{
    extract::{Path, Query, State},
    Json,
};
use serde::Deserialize;
use std::sync::Arc;

use crate::api::error::ApiError;
use crate::api::models::{
    CancelWorkflowResponse, CreateWorkflowRequest, CreateWorkflowResponse,
    WorkflowResultResponse, WorkflowStatusResponse,
};
use crate::persistence::Persistence;
use crate::scheduler::Scheduler;
use crate::state_machine::{Workflow, WorkflowState};

pub type AppState<P> = Arc<Scheduler<P>>;

#[derive(Debug, Deserialize)]
pub struct ResultQuery {
    #[serde(default = "default_timeout")]
    pub timeout: u64,
}

fn default_timeout() -> u64 {
    30
}

/// POST /workflows - Create a new workflow
#[utoipa::path(
    post,
    path = "/workflows",
    request_body = CreateWorkflowRequest,
    responses(
        (status = 201, description = "Workflow created", body = CreateWorkflowResponse),
        (status = 400, description = "Invalid input"),
    ),
    tag = "workflows"
)]
pub async fn create_workflow<P: Persistence + Clone + Send + Sync + 'static>(
    State(scheduler): State<AppState<P>>,
    Json(req): Json<CreateWorkflowRequest>,
) -> Result<Json<CreateWorkflowResponse>, ApiError> {
    let workflow_id = req
        .options
        .and_then(|o| o.workflow_id)
        .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());

    let input_bytes = serde_json::to_vec(&req.input)
        .map_err(|e| ApiError::bad_request("INVALID_INPUT", &e.to_string()))?;

    // Create a new workflow using the Persistence layer
    let workflow = Workflow::new(workflow_id.clone(), req.workflow_type, input_bytes);

    scheduler
        .persistence
        .save_workflow(&workflow)
        .await
        .map_err(|e| ApiError::internal(&e.to_string()))?;

    Ok(Json(CreateWorkflowResponse {
        workflow_id,
        status: "PENDING".to_string(),
    }))
}

/// GET /workflows/{id} - Get workflow status
#[utoipa::path(
    get,
    path = "/workflows/{id}",
    params(("id" = String, Path, description = "Workflow ID")),
    responses(
        (status = 200, description = "Workflow status", body = WorkflowStatusResponse),
        (status = 404, description = "Workflow not found"),
    ),
    tag = "workflows"
)]
pub async fn get_workflow_status<P: Persistence + Clone + Send + Sync + 'static>(
    State(scheduler): State<AppState<P>>,
    Path(workflow_id): Path<String>,
) -> Result<Json<WorkflowStatusResponse>, ApiError> {
    let workflow = scheduler
        .persistence
        .get_workflow(&workflow_id)
        .await
        .map_err(|e| ApiError::internal(&e.to_string()))?
        .ok_or_else(|| {
            ApiError::not_found(
                "WORKFLOW_NOT_FOUND",
                &format!("Workflow '{}' not found", workflow_id),
            )
        })?;

    let (status, current_step, error) = match &workflow.state {
        WorkflowState::Pending => ("PENDING".to_string(), None, None),
        WorkflowState::Running { current_step } => {
            ("RUNNING".to_string(), current_step.clone(), None)
        }
        WorkflowState::Completed { .. } => ("COMPLETED".to_string(), None, None),
        WorkflowState::Failed { error } => ("FAILED".to_string(), None, Some(error.clone())),
        WorkflowState::Cancelled => ("CANCELLED".to_string(), None, None),
    };

    Ok(Json(WorkflowStatusResponse {
        workflow_id: workflow.id,
        status,
        current_step,
        error,
    }))
}

/// GET /workflows/{id}/result - Wait for and get workflow result
#[utoipa::path(
    get,
    path = "/workflows/{id}/result",
    params(
        ("id" = String, Path, description = "Workflow ID"),
        ("timeout" = u64, Query, description = "Timeout in seconds"),
    ),
    responses(
        (status = 200, description = "Workflow result", body = WorkflowResultResponse),
        (status = 404, description = "Workflow not found"),
        (status = 408, description = "Request timeout"),
    ),
    tag = "workflows"
)]
pub async fn get_workflow_result<P: Persistence + Clone + Send + Sync + 'static>(
    State(scheduler): State<AppState<P>>,
    Path(workflow_id): Path<String>,
    Query(query): Query<ResultQuery>,
) -> Result<Json<WorkflowResultResponse>, ApiError> {
    let timeout_duration = std::time::Duration::from_secs(query.timeout);
    let start = std::time::Instant::now();

    loop {
        let workflow = scheduler
            .persistence
            .get_workflow(&workflow_id)
            .await
            .map_err(|e| ApiError::internal(&e.to_string()))?
            .ok_or_else(|| {
                ApiError::not_found(
                    "WORKFLOW_NOT_FOUND",
                    &format!("Workflow '{}' not found", workflow_id),
                )
            })?;

        match &workflow.state {
            WorkflowState::Completed { result } => {
                let output = serde_json::from_slice(result).ok();
                return Ok(Json(WorkflowResultResponse {
                    workflow_id: workflow.id,
                    status: "COMPLETED".to_string(),
                    output,
                    error: None,
                }));
            }
            WorkflowState::Failed { error } => {
                return Ok(Json(WorkflowResultResponse {
                    workflow_id: workflow.id,
                    status: "FAILED".to_string(),
                    output: None,
                    error: Some(error.clone()),
                }));
            }
            WorkflowState::Cancelled => {
                return Ok(Json(WorkflowResultResponse {
                    workflow_id: workflow.id,
                    status: "CANCELLED".to_string(),
                    output: None,
                    error: None,
                }));
            }
            _ => {
                if start.elapsed() > timeout_duration {
                    return Err(ApiError::timeout("Workflow result timeout"));
                }
                tokio::time::sleep(std::time::Duration::from_millis(100)).await;
            }
        }
    }
}

/// DELETE /workflows/{id} - Cancel a workflow
#[utoipa::path(
    delete,
    path = "/workflows/{id}",
    params(("id" = String, Path, description = "Workflow ID")),
    responses(
        (status = 202, description = "Workflow cancelled", body = CancelWorkflowResponse),
        (status = 404, description = "Workflow not found"),
    ),
    tag = "workflows"
)]
pub async fn cancel_workflow<P: Persistence + Clone + Send + Sync + 'static>(
    State(scheduler): State<AppState<P>>,
    Path(workflow_id): Path<String>,
) -> Result<Json<CancelWorkflowResponse>, ApiError> {
    let workflow = scheduler
        .persistence
        .get_workflow(&workflow_id)
        .await
        .map_err(|e| ApiError::internal(&e.to_string()))?
        .ok_or_else(|| {
            ApiError::not_found(
                "WORKFLOW_NOT_FOUND",
                &format!("Workflow '{}' not found", workflow_id),
            )
        })?;

    let cancelled_state = workflow.state.cancel().ok_or_else(|| {
        ApiError::bad_request(
            "INVALID_STATE",
            "Workflow cannot be cancelled in its current state",
        )
    })?;

    scheduler
        .persistence
        .update_workflow_state(&workflow_id, cancelled_state)
        .await
        .map_err(|e| ApiError::internal(&e.to_string()))?;

    Ok(Json(CancelWorkflowResponse {
        success: true,
        message: format!("Workflow '{}' cancelled", workflow_id),
    }))
}
