use crate::broadcaster::EventBroadcaster;
use crate::persistence::Persistence;
use crate::service_registry::ServiceRegistry;
use crate::state_machine::{Workflow, WorkflowState};
use crate::task::{ResourceType, Task};
use crate::tracker::WorkflowTracker;
use std::collections::HashMap;
use tokio::sync::{Mutex, RwLock};
use tokio::time::Duration;

pub struct Scheduler<P: Persistence> {
    pub persistence: P,
    pub service_registry: ServiceRegistry,
    pub tracker: WorkflowTracker,      // 新增：执行追踪器
    pub broadcaster: EventBroadcaster, // 新增：事件广播器
    active_workers: RwLock<HashMap<String, WorkerInfo>>,
    running_tasks: Mutex<HashMap<String, Task>>,
    poll_interval: Duration,
}

impl<P: Persistence + Clone> Clone for Scheduler<P> {
    fn clone(&self) -> Self {
        Scheduler {
            persistence: self.persistence.clone(),
            service_registry: ServiceRegistry::new(),
            tracker: self.tracker.clone(),
            broadcaster: self.broadcaster.clone(),
            active_workers: RwLock::new(HashMap::new()),
            running_tasks: Mutex::new(HashMap::new()),
            poll_interval: self.poll_interval,
        }
    }
}

#[derive(Clone)]
pub struct WorkerInfo {
    pub id: String,
    pub service_name: String,
    pub group: String,
    pub workflow_types: Vec<String>,
    pub resources: Vec<(String, ResourceType)>,
    pub last_seen: std::time::SystemTime,
}

impl<P: Persistence> Scheduler<P> {
    pub fn new(persistence: P) -> Self {
        Scheduler {
            persistence,
            service_registry: ServiceRegistry::new(),
            tracker: WorkflowTracker::new(),
            broadcaster: EventBroadcaster::new(),
            active_workers: RwLock::new(HashMap::new()),
            running_tasks: Mutex::new(HashMap::new()),
            poll_interval: Duration::from_millis(100),
        }
    }

    pub async fn register_worker(
        &self,
        worker_id: String,
        service_name: String,
        group: String,
        workflow_types: Vec<String>,
        resources: Vec<(String, ResourceType)>,
    ) {
        let mut workers = self.active_workers.write().await;
        workers.insert(
            worker_id.clone(),
            WorkerInfo {
                id: worker_id,
                service_name,
                group,
                workflow_types,
                resources,
                last_seen: std::time::SystemTime::now(),
            },
        );
    }

    pub async fn poll_tasks(&self, worker_id: &str, max_tasks: usize) -> Vec<Task> {
        let workers = self.active_workers.read().await;
        if let Some(worker) = workers.get(worker_id) {
            self.find_available_tasks(worker, max_tasks).await
        } else {
            Vec::new()
        }
    }

    async fn find_available_tasks(&self, worker: &WorkerInfo, max_tasks: usize) -> Vec<Task> {
        let mut tasks = Vec::new();
        let workflows = self.persistence.list_workflows(None).await.unwrap();

        for workflow in workflows {
            if matches!(workflow.state, WorkflowState::Running { .. }) {
                if let Some((step_name, target_service, target_resource, resource_type)) =
                    self.find_next_step(&workflow).await
                {
                    // Check if this worker can handle this task
                    if self.can_worker_handle_task(
                        worker,
                        &target_service,
                        &target_resource,
                        resource_type,
                        &workflow.workflow_type,
                    ) {
                        let task = Task {
                            task_id: format!("{}-{}", workflow.id, step_name),
                            workflow_id: workflow.id.clone(),
                            step_name: step_name.clone(),
                            target_service: target_service.clone(),
                            target_resource: target_resource.clone(),
                            resource_type,
                            input: workflow.input.clone(),
                            retry: None,
                        };
                        tasks.push(task);
                        if tasks.len() >= max_tasks {
                            break;
                        }
                    }
                }
            }
        }

        tasks
    }

    fn can_worker_handle_task(
        &self,
        worker: &WorkerInfo,
        target_service: &Option<String>,
        target_resource: &Option<String>,
        resource_type: ResourceType,
        workflow_type: &str,
    ) -> bool {
        // If no target service specified, check if worker supports this workflow type
        if target_service.is_none() {
            return worker.workflow_types.contains(&workflow_type.to_string())
                || worker.resources.iter().any(|(name, rtype)| {
                    rtype == &resource_type && target_resource.as_ref().is_none_or(|r| r == name)
                });
        }

        let target = target_service.as_ref().unwrap();

        // Check if this worker is the target service
        if worker.service_name == *target {
            // Worker can handle its own resources
            return true;
        }

        // Check if worker has matching resources
        worker.resources.iter().any(|(name, rtype)| {
            rtype == &resource_type && target_resource.as_ref().is_none_or(|r| r == name)
        })
    }

    async fn find_next_step(
        &self,
        workflow: &Workflow,
    ) -> Option<(String, Option<String>, Option<String>, ResourceType)> {
        match &workflow.state {
            WorkflowState::Running { current_step } => {
                if current_step.is_none() {
                    Some(("start".to_string(), None, None, ResourceType::Step))
                } else {
                    None
                }
            }
            _ => None,
        }
    }

    pub async fn complete_task(&self, task_id: &str, result: Vec<u8>) -> anyhow::Result<()> {
        let mut running_tasks = self.running_tasks.lock().await;

        if let Some(task) = running_tasks.remove(task_id) {
            // 保存 step 结果到持久化层
            self.persistence
                .save_step_result(&task.workflow_id, &task.step_name, result.clone())
                .await?;

            // 获取 workflow 信息用于追踪和广播
            if let Some(workflow) = self
                .persistence
                .get_workflow(&task.workflow_id)
                .await
                .unwrap()
            {
                // 记录 step 完成到追踪器
                self.tracker
                    .step_completed(&task.workflow_id, &task.step_name, result.clone())
                    .await;

                // 广播 step 完成事件
                let _ = self
                    .broadcaster
                    .broadcast_step_completed(
                        &task.workflow_id,
                        &workflow.workflow_type,
                        &task.step_name,
                        result.clone(),
                    )
                    .await;

                if let Some(new_state) = workflow.state.step_completed() {
                    // 如果 workflow 完成，广播完成事件
                    let is_completed = matches!(new_state, WorkflowState::Completed { .. });

                    self.persistence
                        .update_workflow_state(&workflow.id, new_state)
                        .await?;

                    if is_completed {
                        self.tracker.workflow_completed(&workflow.id).await;
                        let _ = self
                            .broadcaster
                            .broadcast_workflow_completed(&workflow.id, &workflow.workflow_type, result)
                            .await;
                    }
                }
            }
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::broadcaster::EventType;
    use crate::persistence::l0_memory::L0MemoryStore;
    use crate::tracker::StepExecutionStatus;

    #[tokio::test]
    async fn test_task_scheduling() {
        let store = L0MemoryStore::new();

        let workflow = Workflow::new(
            "test-wf".to_string(),
            "test-type".to_string(),
            b"test-input".to_vec(),
        );

        store.save_workflow(&workflow).await.unwrap();

        let started_state = workflow.state.start().unwrap();
        store
            .update_workflow_state("test-wf", started_state)
            .await
            .unwrap();

        let scheduler = Scheduler::new(store);

        scheduler
            .register_worker(
                "worker-1".to_string(),
                "test-service".to_string(),
                "test-group".to_string(),
                vec!["test-type".to_string()],
                vec![],
            )
            .await;

        let tasks = scheduler.poll_tasks("worker-1", 1).await;
        assert_eq!(tasks.len(), 1);
        assert_eq!(tasks[0].step_name, "start");
    }

    #[tokio::test]
    async fn test_tracker_integration() {
        let store = L0MemoryStore::new();
        let scheduler = Scheduler::new(store);

        // 开始追踪 workflow
        scheduler
            .tracker
            .start_workflow("wf-1".to_string(), "test-type".to_string())
            .await;

        // 开始 step
        let step = scheduler
            .tracker
            .step_started("wf-1", "step-1", vec![1, 2, 3], vec![])
            .await;

        assert_eq!(step.status, StepExecutionStatus::Running);

        // 完成 step
        scheduler
            .tracker
            .step_completed("wf-1", "step-1", vec![4, 5, 6])
            .await;

        let execution = scheduler.tracker.get_execution("wf-1").await;
        assert!(execution.is_some());
        assert_eq!(execution.unwrap().step_executions.len(), 1);
    }

    #[tokio::test]
    async fn test_broadcaster() {
        let store = L0MemoryStore::new();
        let scheduler = Scheduler::new(store);

        let mut rx = scheduler.broadcaster.subscribe();

        // 广播 step 完成事件
        let count = scheduler
            .broadcaster
            .broadcast_step_completed("wf-1", "test-type", "step-1", vec![1, 2, 3])
            .await
            .unwrap();

        assert_eq!(count, 1);

        // 接收事件
        let event = rx.recv().await.unwrap();
        assert_eq!(event.workflow_id, "wf-1");
        assert_eq!(event.event_type, EventType::StepCompleted);
    }
}
