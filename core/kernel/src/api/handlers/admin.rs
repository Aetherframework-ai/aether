use axum::{extract::State, Json};
use std::sync::Arc;

use crate::api::error::ApiError;
use crate::api::models::MetricsResponse;
use crate::persistence::Persistence;
use crate::scheduler::Scheduler;
use crate::state_machine::WorkflowState;

pub type AppState<P> = Arc<Scheduler<P>>;

/// GET /metrics - Get system metrics
pub async fn get_metrics<P: Persistence + Clone + Send + Sync + 'static>(
    State(scheduler): State<AppState<P>>,
) -> Result<Json<MetricsResponse>, ApiError> {
    // Get all workflows and count by state
    let workflows = scheduler
        .persistence
        .list_workflows(None)
        .await
        .map_err(|e| ApiError::internal(&e.to_string()))?;

    let mut active_workflows = 0u64;
    let mut completed_workflows = 0u64;
    let mut failed_workflows = 0u64;

    for workflow in workflows {
        match workflow.state {
            WorkflowState::Pending | WorkflowState::Running { .. } => {
                active_workflows += 1;
            }
            WorkflowState::Completed { .. } => {
                completed_workflows += 1;
            }
            WorkflowState::Failed { .. } => {
                failed_workflows += 1;
            }
            WorkflowState::Cancelled => {
                // Cancelled workflows are counted as neither active nor failed
            }
        }
    }

    Ok(Json(MetricsResponse {
        active_workflows,
        completed_workflows,
        failed_workflows,
    }))
}
