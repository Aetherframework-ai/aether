use axum::{
    routing::{delete, get, post},
    Router,
};
use std::sync::Arc;
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

use crate::api::handlers::{admin, steps, workers, workflows};
use crate::api::models::{
    CancelWorkflowResponse, CompleteStepRequest, CreateWorkflowRequest, CreateWorkflowResponse,
    HeartbeatResponse, MetricsResponse, RegisterWorkerRequest, RegisterWorkerResponse,
    ReportStepRequest, ResourceInfo, RetryPolicy, StepResponse, TaskMessage, TaskPayload,
    WorkflowOptions, WorkflowResultResponse, WorkflowStatusResponse,
};
use crate::api::websocket;
use crate::persistence::Persistence;
use crate::scheduler::Scheduler;

/// OpenAPI documentation for the Aether Kernel REST API.
#[derive(OpenApi)]
#[openapi(
    paths(
        workflows::create_workflow,
        workflows::get_workflow_status,
        workflows::get_workflow_result,
        workflows::cancel_workflow,
        workers::register_worker,
        workers::worker_heartbeat,
        steps::report_step,
        steps::complete_step,
        admin::get_metrics,
    ),
    components(schemas(
        CreateWorkflowRequest,
        WorkflowOptions,
        CreateWorkflowResponse,
        WorkflowStatusResponse,
        WorkflowResultResponse,
        CancelWorkflowResponse,
        RegisterWorkerRequest,
        ResourceInfo,
        RegisterWorkerResponse,
        HeartbeatResponse,
        ReportStepRequest,
        CompleteStepRequest,
        StepResponse,
        TaskMessage,
        TaskPayload,
        RetryPolicy,
        MetricsResponse,
    )),
    tags(
        (name = "workflows", description = "Workflow management"),
        (name = "workers", description = "Worker management"),
        (name = "steps", description = "Step execution"),
        (name = "admin", description = "Administration"),
    )
)]
pub struct ApiDoc;

/// Create the Axum router with all API routes.
///
/// # Routes
///
/// ## Workflows
/// - `POST /workflows` - Create a new workflow
/// - `GET /workflows/{id}` - Get workflow status
/// - `GET /workflows/{id}/result` - Wait for and get workflow result
/// - `DELETE /workflows/{id}` - Cancel a workflow
///
/// ## Workers
/// - `POST /workers` - Register a new worker
/// - `GET /workers/{id}/tasks` - WebSocket task streaming
/// - `POST /workers/{id}/heartbeat` - Worker heartbeat
///
/// ## Steps
/// - `POST /steps/{taskId}/report` - Report step status
/// - `POST /steps/{taskId}/complete` - Complete a step
///
/// ## Admin
/// - `GET /metrics` - Get system metrics
///
/// ## Swagger UI
/// - `/swagger-ui` - Interactive API documentation
/// - `/api-docs/openapi.json` - OpenAPI JSON specification
pub fn create_router<P: Persistence + Clone + Send + Sync + 'static>(
    scheduler: Arc<Scheduler<P>>,
) -> Router {
    Router::new()
        // Workflow routes
        .route("/workflows", post(workflows::create_workflow::<P>))
        .route("/workflows/:id", get(workflows::get_workflow_status::<P>))
        .route(
            "/workflows/:id/result",
            get(workflows::get_workflow_result::<P>),
        )
        .route(
            "/workflows/:id",
            delete(workflows::cancel_workflow::<P>),
        )
        // Worker routes
        .route("/workers", post(workers::register_worker::<P>))
        .route("/workers/:id/tasks", get(websocket::worker_tasks_ws::<P>))
        .route(
            "/workers/:id/heartbeat",
            post(workers::worker_heartbeat::<P>),
        )
        // Step routes
        .route("/steps/:taskId/report", post(steps::report_step::<P>))
        .route(
            "/steps/:taskId/complete",
            post(steps::complete_step::<P>),
        )
        // Admin routes
        .route("/metrics", get(admin::get_metrics::<P>))
        // Swagger UI
        .merge(SwaggerUi::new("/swagger-ui").url("/api-docs/openapi.json", ApiDoc::openapi()))
        // State
        .with_state(scheduler)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_openapi_spec_generation() {
        // Verify that the OpenAPI spec can be generated without errors
        let spec = ApiDoc::openapi();
        let json = spec.to_json().expect("Should serialize to JSON");
        assert!(json.contains("workflows"));
        assert!(json.contains("workers"));
        assert!(json.contains("steps"));
        assert!(json.contains("admin"));
    }
}
