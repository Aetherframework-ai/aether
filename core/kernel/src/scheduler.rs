use crate::state_machine::{Workflow, WorkflowState};
use crate::task::{Task, ResourceType};
use crate::service_registry::ServiceRegistry;
use crate::persistence::Persistence;
use std::collections::HashMap;
use tokio::sync::{Mutex, RwLock};
use tokio::time::Duration;

pub struct Scheduler<P: Persistence> {
    pub persistence: P,
    pub service_registry: ServiceRegistry,
    active_workers: RwLock<HashMap<String, WorkerInfo>>,
    running_tasks: Mutex<HashMap<String, Task>>,
    poll_interval: Duration,
}

impl<P: Persistence + Clone> Clone for Scheduler<P> {
    fn clone(&self) -> Self {
        Scheduler {
            persistence: self.persistence.clone(),
            service_registry: ServiceRegistry::new(),
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
            active_workers: RwLock::new(HashMap::new()),
            running_tasks: Mutex::new(HashMap::new()),
            poll_interval: Duration::from_millis(100),
        }
    }

    pub async fn register_worker(&self, worker_id: String, service_name: String, 
                                  group: String, workflow_types: Vec<String>, 
                                  resources: Vec<(String, ResourceType)>) {
        let mut workers = self.active_workers.write().await;
        workers.insert(worker_id.clone(), WorkerInfo {
            id: worker_id,
            service_name,
            group,
            workflow_types,
            resources,
            last_seen: std::time::SystemTime::now(),
        });
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
                    self.find_next_step(&workflow).await {
                    
                    // Check if this worker can handle this task
                    if self.can_worker_handle_task(worker, &target_service, &target_resource, resource_type, &workflow.workflow_type) {
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

    fn can_worker_handle_task(&self, worker: &WorkerInfo, target_service: &Option<String>, 
                               target_resource: &Option<String>, resource_type: ResourceType, workflow_type: &str) -> bool {
        // If no target service specified, check if worker supports this workflow type
        if target_service.is_none() {
            return worker.workflow_types.contains(&workflow_type.to_string()) ||
                   worker.resources.iter().any(|(name, rtype)| 
                       rtype == &resource_type && target_resource.as_ref().map_or(true, |r| r == name));
        }
        
        let target = target_service.as_ref().unwrap();
        
        // Check if this worker is the target service
        if worker.service_name == *target {
            // Worker can handle its own resources
            return true;
        }
        
        // Check if worker has matching resources
        worker.resources.iter().any(|(name, rtype)| {
            rtype == &resource_type && 
            target_resource.as_ref().map_or(true, |r| r == name)
        })
    }

    async fn find_next_step(&self, workflow: &Workflow) -> Option<(String, Option<String>, Option<String>, ResourceType)> {
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
            self.persistence.save_step_result(
                &task.workflow_id, 
                &task.step_name, 
                result.clone()
            ).await?;
            
            if let Some(workflow) = self.persistence.get_workflow(&task.workflow_id).await.unwrap() {
                if let Some(new_state) = workflow.state.step_completed() {
                    self.persistence.update_workflow_state(&workflow.id, new_state).await?;
                }
            }
        }
        
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::persistence::l0_memory::L0MemoryStore;

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
        store.update_workflow_state("test-wf", started_state).await.unwrap();
        
        let scheduler = Scheduler::new(store);
        
        scheduler.register_worker(
            "worker-1".to_string(),
            "test-service".to_string(),
            "test-group".to_string(),
            vec!["test-type".to_string()],
            vec![],
        ).await;
        
        let tasks = scheduler.poll_tasks("worker-1", 1).await;
        assert_eq!(tasks.len(), 1);
        assert_eq!(tasks[0].step_name, "start");
    }
}
