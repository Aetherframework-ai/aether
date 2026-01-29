use crate::state_machine::{Workflow, WorkflowState};
use crate::task::Task;

pub struct WorkflowExecutor {
    workflow: Workflow,
}

impl WorkflowExecutor {
    pub fn new(workflow: Workflow) -> Self {
        WorkflowExecutor { workflow }
    }

    pub fn start(&mut self) -> Result<(), String> {
        let new_state = self
            .workflow
            .state
            .start()
            .ok_or("Cannot start workflow from current state")?;
        self.workflow.state = new_state;
        Ok(())
    }

    pub fn poll_task(&mut self) -> Option<Task> {
        match &self.workflow.state {
            WorkflowState::Running { current_step: None } => Some(Task {
                task_id: format!("{}-start", self.workflow.id),
                workflow_id: self.workflow.id.clone(),
                step_name: "start".to_string(),
                target_service: None,
                target_resource: None,
                resource_type: crate::task::ResourceType::Step,
                input: self.workflow.input.clone(),
                retry: None,
                workflow_type: self.workflow.workflow_type.clone(),
            }),
            _ => None,
        }
    }

    pub fn complete_step(&mut self, step_name: &str, result: Vec<u8>) -> Result<(), String> {
        self.workflow
            .steps_completed
            .insert(step_name.to_string(), result);

        let new_state = self
            .workflow
            .state
            .step_completed()
            .ok_or("Cannot complete step from current state")?;
        self.workflow.state = new_state;

        Ok(())
    }

    pub fn workflow(&self) -> &Workflow {
        &self.workflow
    }
}
