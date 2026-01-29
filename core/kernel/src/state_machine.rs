use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum WorkflowState {
    Pending,
    Running { current_step: Option<String> },
    Completed { result: Vec<u8> },
    Failed { error: String },
    Cancelled,
}

impl WorkflowState {
    pub fn start(&self) -> Option<Self> {
        match self {
            WorkflowState::Pending => Some(WorkflowState::Running { current_step: None }),
            _ => None,
        }
    }

    pub fn step_started(&self, step_name: &str) -> Option<Self> {
        match self {
            WorkflowState::Running { .. } => Some(WorkflowState::Running {
                current_step: Some(step_name.to_string()),
            }),
            _ => None,
        }
    }

    pub fn step_completed(&self) -> Option<Self> {
        match self {
            WorkflowState::Running { .. } => Some(WorkflowState::Running { current_step: None }),
            _ => None,
        }
    }

    pub fn complete(&self, result: Vec<u8>) -> Option<Self> {
        match self {
            WorkflowState::Running { .. } => Some(WorkflowState::Completed { result }),
            _ => None,
        }
    }

    pub fn fail(&self, error: String) -> Option<Self> {
        match self {
            WorkflowState::Running { .. } => Some(WorkflowState::Failed { error }),
            _ => None,
        }
    }

    pub fn cancel(&self) -> Option<Self> {
        match self {
            WorkflowState::Pending => Some(WorkflowState::Cancelled),
            WorkflowState::Running { .. } => Some(WorkflowState::Cancelled),
            _ => None,
        }
    }
}

#[derive(Debug, Clone)]
pub struct Workflow {
    pub id: String,
    pub workflow_type: String,
    pub state: WorkflowState,
    pub input: Vec<u8>,
    pub steps_completed: HashMap<String, Vec<u8>>,
    pub started_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Workflow {
    pub fn new(id: String, workflow_type: String, input: Vec<u8>) -> Self {
        let now = Utc::now();
        Workflow {
            id,
            workflow_type,
            state: WorkflowState::Pending,
            input,
            steps_completed: HashMap::new(),
            started_at: now,
            updated_at: now,
        }
    }

    pub fn is_complete(&self) -> bool {
        matches!(self.state, WorkflowState::Completed { .. })
    }

    pub fn is_failed(&self) -> bool {
        matches!(self.state, WorkflowState::Failed { .. })
    }

    pub fn can_retry(&self, step_name: &str, max_attempts: u32) -> bool {
        !self.steps_completed.contains_key(step_name)
            && self
                .steps_completed
                .get(step_name)
                .map(|v| v.len() < max_attempts as usize)
                .unwrap_or(true)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_workflow_lifecycle() {
        let workflow = Workflow::new(
            "wf-1".to_string(),
            "test-workflow".to_string(),
            b"input".to_vec(),
        );

        assert!(matches!(workflow.state, WorkflowState::Pending));

        let started = workflow.state.start().unwrap();
        assert!(matches!(started, WorkflowState::Running { .. }));

        let step_started = started.step_started("step1").unwrap();
        assert!(matches!(
            step_started,
            WorkflowState::Running { current_step: Some(ref step) } if step == "step1"
        ));

        let step_completed = step_started.step_completed().unwrap();
        assert!(matches!(
            step_completed,
            WorkflowState::Running { current_step: None }
        ));

        let completed = step_completed.complete(b"result".to_vec()).unwrap();
        assert!(matches!(
            completed,
            WorkflowState::Completed { result } if result == b"result"
        ));
    }
}
