use super::Persistence;
use crate::state_machine::Workflow;
use crate::state_machine::WorkflowState;
use chrono::Utc;
use std::collections::HashMap;
use tokio::sync::RwLock;

pub struct L1SnapshotStore {
    workflows: RwLock<HashMap<String, Workflow>>,
    step_results: RwLock<HashMap<String, HashMap<String, Vec<u8>>>>,
    #[allow(dead_code)]
    snapshot_interval: usize,
}

impl L1SnapshotStore {
    pub fn new(snapshot_interval: usize) -> Self {
        L1SnapshotStore {
            workflows: RwLock::new(HashMap::new()),
            step_results: RwLock::new(HashMap::new()),
            snapshot_interval,
        }
    }
}

#[async_trait::async_trait]
impl Persistence for L1SnapshotStore {
    async fn save_workflow(&self, workflow: &Workflow) -> anyhow::Result<()> {
        let mut workflows = self.workflows.write().await;
        workflows.insert(workflow.id.clone(), workflow.clone());
        Ok(())
    }

    async fn get_workflow(&self, id: &str) -> anyhow::Result<Option<Workflow>> {
        let workflows = self.workflows.read().await;
        Ok(workflows.get(id).cloned())
    }

    async fn list_workflows(&self, workflow_type: Option<&str>) -> anyhow::Result<Vec<Workflow>> {
        let workflows = self.workflows.read().await;
        let mut result: Vec<Workflow> = workflows.values().cloned().collect();

        if let Some(wf_type) = workflow_type {
            result.retain(|w| w.workflow_type == wf_type);
        }

        Ok(result)
    }

    async fn update_workflow_state(&self, id: &str, state: WorkflowState) -> anyhow::Result<()> {
        let mut workflows = self.workflows.write().await;
        if let Some(workflow) = workflows.get_mut(id) {
            workflow.state = state;
            workflow.updated_at = Utc::now();
        }
        Ok(())
    }

    async fn save_step_result(
        &self,
        workflow_id: &str,
        step_name: &str,
        result: Vec<u8>,
    ) -> anyhow::Result<()> {
        let mut step_results = self.step_results.write().await;
        let workflow_results = step_results
            .entry(workflow_id.to_string())
            .or_insert_with(HashMap::new);
        workflow_results.insert(step_name.to_string(), result);
        Ok(())
    }

    async fn get_step_result(
        &self,
        workflow_id: &str,
        step_name: &str,
    ) -> anyhow::Result<Option<Vec<u8>>> {
        let step_results = self.step_results.read().await;
        Ok(step_results
            .get(workflow_id)
            .and_then(|results| results.get(step_name).cloned()))
    }
}
