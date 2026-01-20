use crate::state_machine::Workflow;
use crate::state_machine::WorkflowState;

#[async_trait::async_trait]
pub trait Persistence: Send + Sync {
    async fn save_workflow(&self, workflow: &Workflow) -> anyhow::Result<()>;
    async fn get_workflow(&self, id: &str) -> anyhow::Result<Option<Workflow>>;
    async fn list_workflows(&self, workflow_type: Option<&str>) -> anyhow::Result<Vec<Workflow>>;
    async fn update_workflow_state(&self, id: &str, state: WorkflowState) -> anyhow::Result<()>;
    async fn save_step_result(&self, workflow_id: &str, step_name: &str, result: Vec<u8>) -> anyhow::Result<()>;
    async fn get_step_result(&self, workflow_id: &str, step_name: &str) -> anyhow::Result<Option<Vec<u8>>>;
}

pub enum PersistenceLevel {
    L0Memory,
    L1Snapshot,
    L2StateActionLog,
}

pub struct PersistenceConfig {
    pub level: PersistenceLevel,
    pub backend: String,
    pub path: Option<String>,
}

pub mod l0_memory;
pub mod l1_snapshot;
pub mod l2_state_action_log;
