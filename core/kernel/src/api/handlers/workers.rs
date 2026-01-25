use axum::{
    extract::{Path, State},
    Json,
};
use std::sync::Arc;

use crate::api::error::ApiError;
use crate::api::models::{HeartbeatResponse, RegisterWorkerRequest, RegisterWorkerResponse};
use crate::persistence::Persistence;
use crate::scheduler::Scheduler;
use crate::task::ResourceType;

pub type AppState<P> = Arc<Scheduler<P>>;

/// POST /workers - Register a new worker
#[utoipa::path(
    post,
    path = "/workers",
    request_body = RegisterWorkerRequest,
    responses(
        (status = 201, description = "Worker registered", body = RegisterWorkerResponse),
        (status = 400, description = "Invalid input"),
    ),
    tag = "workers"
)]
pub async fn register_worker<P: Persistence + Clone + Send + Sync + 'static>(
    State(scheduler): State<AppState<P>>,
    Json(req): Json<RegisterWorkerRequest>,
) -> Result<Json<RegisterWorkerResponse>, ApiError> {
    let worker_id = uuid::Uuid::new_v4().to_string();
    let session_token = uuid::Uuid::new_v4().to_string();

    // Convert ResourceInfo to (String, ResourceType) tuples
    let resources: Vec<(String, ResourceType)> = req
        .resources
        .into_iter()
        .map(|r| {
            let resource_type = match r.resource_type.to_uppercase().as_str() {
                "STEP" => ResourceType::Step,
                "ACTIVITY" => ResourceType::Activity,
                "WORKFLOW" => ResourceType::Workflow,
                _ => ResourceType::Step, // Default to Step
            };
            (r.name, resource_type)
        })
        .collect();

    // Register worker to scheduler
    // Note: Using empty defaults for group and workflow_types as they're not in the API request
    scheduler
        .register_worker(
            worker_id.clone(),
            req.service_name,
            "default".to_string(), // default group
            vec![],                // empty workflow_types, can be extended
            resources,
        )
        .await;

    Ok(Json(RegisterWorkerResponse {
        worker_id,
        session_token,
    }))
}

/// POST /workers/{id}/heartbeat - Worker heartbeat
#[utoipa::path(
    post,
    path = "/workers/{id}/heartbeat",
    params(("id" = String, Path, description = "Worker ID")),
    responses(
        (status = 200, description = "Heartbeat acknowledged", body = HeartbeatResponse),
        (status = 404, description = "Worker not found"),
    ),
    tag = "workers"
)]
pub async fn worker_heartbeat<P: Persistence + Clone + Send + Sync + 'static>(
    State(_scheduler): State<AppState<P>>,
    Path(_worker_id): Path<String>,
) -> Result<Json<HeartbeatResponse>, ApiError> {
    // TODO: Update worker last heartbeat time in scheduler
    // For now, return a successful response
    Ok(Json(HeartbeatResponse {
        success: true,
        next_heartbeat: 30, // 30 seconds until next heartbeat
    }))
}
