use crate::persistence::Persistence;
use crate::proto::client_service_server::ClientService as GrpcClientService;
use crate::proto::worker_service_server::WorkerService as GrpcWorkerService;
use crate::proto::{
    AwaitResultRequest, CancelRequest, CancelResponse, CompleteStepRequest, CompleteStepResponse,
    GetStatusRequest, HeartbeatRequest, HeartbeatResponse, PollRequest, RegisterRequest,
    RegisterResponse, ReportStepRequest, ReportStepResponse, StartWorkflowRequest,
    StartWorkflowResponse, StepStatus, Task, WorkflowResult, WorkflowStatus,
};
use crate::scheduler::Scheduler;
use crate::state_machine::{Workflow, WorkflowState};
use crate::task::ResourceType;
use std::collections::HashMap;
use std::convert::TryFrom;
use tokio::sync::mpsc;
use tokio::sync::RwLock;
use tokio_stream::wrappers::ReceiverStream;
use tonic::{Request, Response, Status};
use uuid::Uuid;

// Convert from proto i32 to internal ResourceType
impl TryFrom<i32> for ResourceType {
    type Error = String;

    fn try_from(value: i32) -> Result<Self, Self::Error> {
        match value {
            0 => Ok(ResourceType::Step),
            1 => Ok(ResourceType::Activity),
            2 => Ok(ResourceType::Workflow),
            _ => Err(format!("Unknown resource type: {}", value)),
        }
    }
}

#[allow(dead_code)]
pub struct ClientService<P: Persistence> {
    scheduler: Scheduler<P>,
    #[allow(clippy::type_complexity)]
    active_workflows:
        RwLock<HashMap<String, tokio::sync::oneshot::Sender<Result<Vec<u8>, String>>>>,
}

impl<P: Persistence + Clone> Clone for ClientService<P> {
    fn clone(&self) -> Self {
        ClientService {
            scheduler: self.scheduler.clone(),
            active_workflows: RwLock::new(HashMap::new()),
        }
    }
}

impl<P: Persistence> ClientService<P> {
    pub fn new(scheduler: Scheduler<P>) -> Self {
        ClientService {
            scheduler,
            active_workflows: RwLock::new(HashMap::new()),
        }
    }
}

#[tonic::async_trait]
impl<P: Persistence + Clone> GrpcClientService for ClientService<P>
where
    P: Send + Sync + 'static,
{
    async fn start_workflow(
        &self,
        request: Request<StartWorkflowRequest>,
    ) -> Result<Response<StartWorkflowResponse>, Status> {
        let request = request.into_inner();
        let workflow_id = Uuid::new_v4().to_string();
        let workflow_type = request.workflow_type.clone();

        let workflow = Workflow::new(workflow_id.clone(), request.workflow_type, request.input);

        self.scheduler
            .persistence
            .save_workflow(&workflow)
            .await
            .map_err(|e| Status::internal(e.to_string()))?;

        if let Some(started_state) = workflow.state.start() {
            self.scheduler
                .persistence
                .update_workflow_state(&workflow_id, started_state)
                .await
                .map_err(|e| Status::internal(e.to_string()))?;
        }

        // 记录 workflow 到 tracker 以便 Dashboard 显示
        self.scheduler
            .tracker
            .start_workflow(workflow_id.clone(), workflow_type)
            .await;

        Ok(Response::new(StartWorkflowResponse {
            workflow_id: workflow_id.clone(),
        }))
    }

    async fn get_workflow_status(
        &self,
        request: Request<GetStatusRequest>,
    ) -> Result<Response<WorkflowStatus>, Status> {
        let request = request.into_inner();

        let workflow = self
            .scheduler
            .persistence
            .get_workflow(&request.workflow_id)
            .await
            .map_err(|e| Status::internal(e.to_string()))?
            .ok_or_else(|| Status::not_found("Workflow not found"))?;

        let state = match workflow.state {
            WorkflowState::Pending => 0,
            WorkflowState::Running { .. } => 1,
            WorkflowState::Completed { .. } => 2,
            WorkflowState::Failed { .. } => 3,
            WorkflowState::Cancelled => 4,
        };

        let current_step = match &workflow.state {
            WorkflowState::Running { current_step } => current_step.clone().unwrap_or_default(),
            _ => String::new(),
        };

        let (result, error, completed_at) = match &workflow.state {
            WorkflowState::Completed { result } => {
                (result.clone(), String::new(), workflow.updated_at.seconds)
            }
            WorkflowState::Failed { error } => (Vec::new(), error.clone(), 0),
            _ => (Vec::new(), String::new(), 0),
        };

        let started_at = workflow.started_at.seconds;

        Ok(Response::new(WorkflowStatus {
            workflow_id: workflow.id,
            state,
            current_step,
            result,
            error,
            started_at,
            completed_at,
        }))
    }

    async fn await_result(
        &self,
        request: Request<AwaitResultRequest>,
    ) -> Result<Response<WorkflowResult>, Status> {
        let request = request.into_inner();
        let workflow_id = request.workflow_id;

        let workflow = self
            .scheduler
            .persistence
            .get_workflow(&workflow_id)
            .await
            .map_err(|e| Status::internal(e.to_string()))?
            .ok_or_else(|| Status::not_found("Workflow not found"))?;

        match workflow.state {
            WorkflowState::Completed { result } => Ok(Response::new(WorkflowResult {
                result,
                error: String::new(),
                state: 2,
            })),
            WorkflowState::Failed { error } => Ok(Response::new(WorkflowResult {
                result: Vec::new(),
                error,
                state: 3,
            })),
            WorkflowState::Cancelled => Ok(Response::new(WorkflowResult {
                result: Vec::new(),
                error: String::new(),
                state: 4,
            })),
            WorkflowState::Running { .. } | WorkflowState::Pending => {
                Err(Status::failed_precondition("Workflow is still running"))
            }
        }
    }

    async fn cancel_workflow(
        &self,
        request: Request<CancelRequest>,
    ) -> Result<Response<CancelResponse>, Status> {
        let request = request.into_inner();

        let workflow = self
            .scheduler
            .persistence
            .get_workflow(&request.workflow_id)
            .await
            .map_err(|e| Status::internal(e.to_string()))?
            .ok_or_else(|| Status::not_found("Workflow not found"))?;

        if let Some(cancelled_state) = workflow.state.cancel() {
            self.scheduler
                .persistence
                .update_workflow_state(&request.workflow_id, cancelled_state)
                .await
                .map_err(|e| Status::internal(e.to_string()))?;
        }

        Ok(Response::new(CancelResponse { success: true }))
    }
}

#[tonic::async_trait]
impl<P: Persistence + Clone> GrpcWorkerService for ClientService<P>
where
    P: Send + Sync + 'static,
{
    type PollTasksStream = tokio_stream::wrappers::ReceiverStream<Result<Task, Status>>;

    async fn register(
        &self,
        request: Request<RegisterRequest>,
    ) -> Result<Response<RegisterResponse>, Status> {
        let request = request.into_inner();

        // Convert proto resources to internal format
        let resources: Result<Vec<(String, crate::task::ResourceType)>, String> = request
            .provides
            .into_iter()
            .map(|r| -> Result<(String, crate::task::ResourceType), String> {
                Ok((r.name, r.r#type.try_into()?))
            })
            .collect();

        let resources = resources.map_err(Status::invalid_argument)?;

        self.scheduler
            .register_worker(
                request.worker_id,
                request.service_name,
                request.group,
                request.language,
                resources,
            )
            .await;

        Ok(Response::new(RegisterResponse {
            server_id: "aether-server-1".to_string(),
            supported_workflow_types: vec![],
        }))
    }

    async fn poll_tasks(
        &self,
        request: Request<PollRequest>,
    ) -> Result<Response<Self::PollTasksStream>, Status> {
        let request = request.into_inner();
        let worker_id = request.worker_id.clone();
        let max_tasks = if request.max_tasks > 0 {
            request.max_tasks as usize
        } else {
            10
        };

        let tasks = self.scheduler.poll_tasks(&worker_id, max_tasks).await;

        // 记录 step 开始执行到 tracker
        for task in &tasks {
            self.scheduler
                .tracker
                .step_started(
                    &task.workflow_id,
                    &task.step_name,
                    task.input.clone(),
                    vec![],
                )
                .await;

            // 广播 step 开始事件
            let _ = self
                .scheduler
                .broadcaster
                .broadcast_step_started(
                    &task.workflow_id,
                    "workflow", // TODO: 从 workflow 获取实际类型
                    &task.step_name,
                    task.input.clone(),
                )
                .await;
        }

        let (tx, rx) = mpsc::channel(100);
        tokio::spawn(async move {
            for task in tasks {
                let proto_task = Task {
                    task_id: task.task_id,
                    workflow_id: task.workflow_id,
                    step_name: task.step_name,
                    target_service: task.target_service.unwrap_or_default(),
                    target_resource: task.target_resource.unwrap_or_default(),
                    resource_type: task.resource_type as i32,
                    input: task.input,
                    retry: task.retry.map(|r| crate::proto::RetryPolicy {
                        max_attempts: r.max_attempts as i32,
                        initial_interval: r.initial_interval as i32,
                        backoff_multiplier: r.backoff_multiplier as i32,
                    }),
                };
                let _ = tx.send(Ok(proto_task)).await;
            }
        });

        let stream = ReceiverStream::new(rx);
        Ok(Response::new(stream))
    }

    async fn complete_step(
        &self,
        request: Request<CompleteStepRequest>,
    ) -> Result<Response<CompleteStepResponse>, Status> {
        let request = request.into_inner();

        if !request.error.is_empty() {
            let workflow = self
                .scheduler
                .persistence
                .get_workflow(&request.task_id)
                .await
                .map_err(|e| Status::internal(e.to_string()))?;

            if let Some(workflow) = workflow {
                if let Some(failed_state) = workflow.state.fail(request.error.clone()) {
                    self.scheduler
                        .persistence
                        .update_workflow_state(&workflow.id, failed_state)
                        .await
                        .map_err(|e| Status::internal(e.to_string()))?;
                }
            }
        } else {
            self.scheduler
                .complete_task(&request.task_id, request.result)
                .await
                .map_err(|e| Status::internal(e.to_string()))?;
        }

        Ok(Response::new(CompleteStepResponse { success: true }))
    }

    #[allow(unused_variables)]
    async fn heartbeat(
        &self,
        request: Request<HeartbeatRequest>,
    ) -> Result<Response<HeartbeatResponse>, Status> {
        Ok(Response::new(HeartbeatResponse { ok: true }))
    }

    async fn report_step(
        &self,
        request: Request<ReportStepRequest>,
    ) -> Result<Response<ReportStepResponse>, Status> {
        let request = request.into_inner();
        let workflow_id = &request.workflow_id;
        let step_name = &request.step_name;

        match StepStatus::try_from(request.status) {
            Ok(StepStatus::StepStarted) => {
                // 记录 step 开始
                self.scheduler
                    .tracker
                    .step_started(workflow_id, step_name, request.input.clone(), vec![])
                    .await;

                // 广播 step 开始事件
                let _ = self
                    .scheduler
                    .broadcaster
                    .broadcast_step_started(
                        workflow_id,
                        "workflow", // TODO: 从 workflow 获取实际类型
                        step_name,
                        request.input,
                    )
                    .await;
            }
            Ok(StepStatus::StepCompleted) => {
                // 记录 step 完成
                self.scheduler
                    .tracker
                    .step_completed(workflow_id, step_name, request.output.clone())
                    .await;

                // 广播 step 完成事件
                let _ = self
                    .scheduler
                    .broadcaster
                    .broadcast_step_completed(workflow_id, "workflow", step_name, request.output)
                    .await;
            }
            Ok(StepStatus::StepFailed) => {
                // 记录 step 失败
                self.scheduler
                    .tracker
                    .step_failed(workflow_id, step_name, request.error.clone())
                    .await;

                // 广播 step 失败事件
                let _ = self
                    .scheduler
                    .broadcaster
                    .broadcast_step_failed(
                        workflow_id,
                        "workflow",
                        step_name,
                        request.error.clone(),
                        1,
                    )
                    .await;
            }
            Err(_) => {
                return Err(Status::invalid_argument("Invalid step status"));
            }
        }

        Ok(Response::new(ReportStepResponse { success: true }))
    }
}
