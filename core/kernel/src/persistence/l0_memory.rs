use crate::state_machine::Workflow;
use crate::state_machine::WorkflowState;
use prost_types::Timestamp;
use std::collections::HashMap;
use tokio::sync::RwLock;

pub struct L0MemoryStore {
    workflows: RwLock<HashMap<String, Workflow>>,
    step_results: RwLock<HashMap<String, HashMap<String, Vec<u8>>>>,
}

impl Default for L0MemoryStore {
    fn default() -> Self {
        Self::new()
    }
}

impl L0MemoryStore {
    pub fn new() -> Self {
        L0MemoryStore {
            workflows: RwLock::new(HashMap::new()),
            step_results: RwLock::new(HashMap::new()),
        }
    }
}

#[async_trait::async_trait]
impl super::Persistence for L0MemoryStore {
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
            workflow.updated_at = Timestamp::from(std::time::SystemTime::now());
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::persistence::Persistence;
    use crate::state_machine::WorkflowState;

    #[tokio::test]
    async fn test_l0_memory_store() {
        let store = L0MemoryStore::new();

        let workflow = Workflow::new(
            "test-wf".to_string(),
            "test-type".to_string(),
            b"test-input".to_vec(),
        );

        store.save_workflow(&workflow).await.unwrap();

        let retrieved = store.get_workflow("test-wf").await.unwrap();
        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap().workflow_type, "test-type");
    }

    #[tokio::test]
    async fn test_list_workflows_by_type() {
        let store = L0MemoryStore::new();

        let wf1 = Workflow::new("wf1".to_string(), "type-a".to_string(), b"input".to_vec());
        let wf2 = Workflow::new("wf2".to_string(), "type-b".to_string(), b"input".to_vec());
        let wf3 = Workflow::new("wf3".to_string(), "type-a".to_string(), b"input".to_vec());

        store.save_workflow(&wf1).await.unwrap();
        store.save_workflow(&wf2).await.unwrap();
        store.save_workflow(&wf3).await.unwrap();

        let type_a_workflows = store.list_workflows(Some("type-a")).await.unwrap();
        assert_eq!(type_a_workflows.len(), 2);

        let all_workflows = store.list_workflows(None).await.unwrap();
        assert_eq!(all_workflows.len(), 3);
    }

    #[tokio::test]
    async fn test_step_results() {
        let store = L0MemoryStore::new();

        let workflow = Workflow::new("wf1".to_string(), "test".to_string(), b"input".to_vec());
        store.save_workflow(&workflow).await.unwrap();

        store
            .save_step_result("wf1", "step1", b"result1".to_vec())
            .await
            .unwrap();
        store
            .save_step_result("wf1", "step2", b"result2".to_vec())
            .await
            .unwrap();

        let step1_result = store.get_step_result("wf1", "step1").await.unwrap();
        assert_eq!(step1_result, Some(b"result1".to_vec()));

        let step3_result = store.get_step_result("wf1", "step3").await.unwrap();
        assert_eq!(step3_result, None);
    }

    #[tokio::test]
    async fn test_update_workflow_state() {
        let store = L0MemoryStore::new();

        let workflow = Workflow::new("wf1".to_string(), "test".to_string(), b"input".to_vec());
        store.save_workflow(&workflow).await.unwrap();

        let initial = store.get_workflow("wf1").await.unwrap().unwrap();
        assert!(matches!(initial.state, WorkflowState::Pending));

        store
            .update_workflow_state("wf1", WorkflowState::Running { current_step: None })
            .await
            .unwrap();

        let updated = store.get_workflow("wf1").await.unwrap().unwrap();
        assert!(matches!(updated.state, WorkflowState::Running { .. }));
    }
}
