use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fmt;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Step 执行状态
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum StepExecutionStatus {
    Pending,                  // 等待执行
    Running,                  // 执行中
    Completed,                // 已完成
    Failed { error: String }, // 失败
    Cancelled,                // 取消
}

/// Unix 时间戳（秒）
#[derive(Debug, Clone, Copy, Serialize, Deserialize, Default)]
pub struct Timestamp {
    pub seconds: i64,
    pub nanos: i32,
}

impl From<prost_types::Timestamp> for Timestamp {
    fn from(ts: prost_types::Timestamp) -> Self {
        Self {
            seconds: ts.seconds,
            nanos: ts.nanos,
        }
    }
}

impl From<Timestamp> for prost_types::Timestamp {
    fn from(ts: Timestamp) -> Self {
        Self {
            seconds: ts.seconds,
            nanos: ts.nanos,
        }
    }
}

/// 单个 Step 的执行记录
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StepExecution {
    pub step_name: String,
    pub status: StepExecutionStatus,
    pub started_at: Option<Timestamp>,
    pub completed_at: Option<Timestamp>,
    pub input: Vec<u8>,
    pub output: Option<Vec<u8>>,
    pub attempt: u32,
    pub dependencies: Vec<String>, // 依赖的 step 名称
}

/// Workflow 执行追踪信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowExecution {
    pub workflow_id: String,
    pub workflow_type: String,
    pub step_executions: HashMap<String, StepExecution>,
    pub started_at: Timestamp,
    pub completed_at: Option<Timestamp>,
    pub current_step: Option<String>,
}

impl fmt::Display for StepExecutionStatus {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            StepExecutionStatus::Pending => write!(f, "pending"),
            StepExecutionStatus::Running => write!(f, "running"),
            StepExecutionStatus::Completed => write!(f, "completed"),
            StepExecutionStatus::Failed { .. } => write!(f, "failed"),
            StepExecutionStatus::Cancelled => write!(f, "cancelled"),
        }
    }
}

/// Workflow 执行追踪器
///
/// 追踪 workflow 的执行历史，包括每个 step 的状态变化。
/// 用于 Dashboard 的实时可视化。
#[derive(Clone)]
pub struct WorkflowTracker {
    executions: Arc<RwLock<HashMap<String, WorkflowExecution>>>,
}

impl WorkflowTracker {
    /// 创建新的追踪器
    pub fn new() -> Self {
        Self {
            executions: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// 开始追踪一个 workflow
    pub async fn start_workflow(&self, workflow_id: String, workflow_type: String) {
        let mut executions = self.executions.write().await;
        let now = std::time::SystemTime::now();
        let seconds = now.duration_since(std::time::UNIX_EPOCH).unwrap().as_secs() as i64;

        executions.insert(
            workflow_id.clone(),
            WorkflowExecution {
                workflow_id,
                workflow_type,
                step_executions: HashMap::new(),
                started_at: Timestamp { seconds, nanos: 0 },
                completed_at: None,
                current_step: None,
            },
        );
    }

    /// 记录 step 开始执行
    pub async fn step_started(
        &self,
        workflow_id: &str,
        step_name: &str,
        input: Vec<u8>,
        dependencies: Vec<String>,
    ) -> StepExecution {
        let mut executions = self.executions.write().await;
        let execution = executions.get_mut(workflow_id).expect("Workflow not found");

        let now = std::time::SystemTime::now();
        let seconds = now.duration_since(std::time::UNIX_EPOCH).unwrap().as_secs() as i64;

        let step_execution = StepExecution {
            step_name: step_name.to_string(),
            status: StepExecutionStatus::Running,
            started_at: Some(Timestamp { seconds, nanos: 0 }),
            completed_at: None,
            input,
            output: None,
            attempt: 1,
            dependencies,
        };

        execution
            .step_executions
            .insert(step_name.to_string(), step_execution.clone());
        execution.current_step = Some(step_name.to_string());

        step_execution
    }

    /// 记录 step 完成
    pub async fn step_completed(&self, workflow_id: &str, step_name: &str, output: Vec<u8>) {
        let mut executions = self.executions.write().await;
        if let Some(execution) = executions.get_mut(workflow_id) {
            if let Some(step) = execution.step_executions.get_mut(step_name) {
                let now = std::time::SystemTime::now();
                let seconds = now.duration_since(std::time::UNIX_EPOCH).unwrap().as_secs() as i64;

                step.status = StepExecutionStatus::Completed;
                step.completed_at = Some(Timestamp { seconds, nanos: 0 });
                step.output = Some(output);
            }
            execution.current_step = None;
        }
    }

    /// 记录 step 失败
    pub async fn step_failed(&self, workflow_id: &str, step_name: &str, error: String) {
        let mut executions = self.executions.write().await;
        if let Some(execution) = executions.get_mut(workflow_id) {
            if let Some(step) = execution.step_executions.get_mut(step_name) {
                let now = std::time::SystemTime::now();
                let seconds = now.duration_since(std::time::UNIX_EPOCH).unwrap().as_secs() as i64;

                step.status = StepExecutionStatus::Failed {
                    error: error.clone(),
                };
                step.completed_at = Some(Timestamp { seconds, nanos: 0 });
                step.attempt += 1;
            }
            execution.current_step = Some(step_name.to_string());
        }
    }

    /// 记录 workflow 完成
    pub async fn workflow_completed(&self, workflow_id: &str) {
        let mut executions = self.executions.write().await;
        if let Some(execution) = executions.get_mut(workflow_id) {
            let now = std::time::SystemTime::now();
            let seconds = now.duration_since(std::time::UNIX_EPOCH).unwrap().as_secs() as i64;

            execution.completed_at = Some(Timestamp { seconds, nanos: 0 });
            execution.current_step = None;
        }
    }

    /// 记录 workflow 失败
    pub async fn workflow_failed(&self, workflow_id: &str) {
        let mut executions = self.executions.write().await;
        if let Some(execution) = executions.get_mut(workflow_id) {
            let now = std::time::SystemTime::now();
            let seconds = now.duration_since(std::time::UNIX_EPOCH).unwrap().as_secs() as i64;

            execution.completed_at = Some(Timestamp { seconds, nanos: 0 });
            execution.current_step = None;
        }
    }

    /// 获取 workflow 执行信息
    pub async fn get_execution(&self, workflow_id: &str) -> Option<WorkflowExecution> {
        self.executions.read().await.get(workflow_id).cloned()
    }

    /// 获取所有正在执行的 workflow
    pub async fn get_active_executions(&self) -> Vec<WorkflowExecution> {
        self.executions
            .read()
            .await
            .values()
            .filter(|e| e.completed_at.is_none())
            .cloned()
            .collect()
    }

    /// 获取所有执行信息
    pub async fn get_all_executions(&self) -> Vec<WorkflowExecution> {
        self.executions.read().await.values().cloned().collect()
    }

    /// 清除所有执行记录
    pub async fn clear(&self) {
        let mut executions = self.executions.write().await;
        executions.clear();
    }

    /// 移除指定 workflow 的记录
    pub async fn remove(&self, workflow_id: &str) {
        let mut executions = self.executions.write().await;
        executions.remove(workflow_id);
    }
}

impl Default for WorkflowTracker {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_tracker_workflow_lifecycle() {
        let tracker = WorkflowTracker::new();

        // 开始 workflow
        tracker
            .start_workflow("wf-1".to_string(), "test-type".to_string())
            .await;

        // 开始 step
        let step = tracker
            .step_started("wf-1", "step-1", vec![1, 2, 3], vec![])
            .await;

        assert_eq!(step.status, StepExecutionStatus::Running);
        assert!(step.started_at.is_some());

        // 完成 step
        tracker
            .step_completed("wf-1", "step-1", vec![4, 5, 6])
            .await;

        let execution = tracker.get_execution("wf-1").await.unwrap();
        assert!(execution.step_executions.contains_key("step-1"));
        assert_eq!(execution.current_step, None);

        // 开始另一个 step
        tracker
            .step_started("wf-1", "step-2", vec![], vec!["step-1".to_string()])
            .await;

        // 模拟失败
        tracker
            .step_failed("wf-1", "step-2", "Test error".to_string())
            .await;

        let execution = tracker.get_execution("wf-1").await.unwrap();
        let step2 = execution.step_executions.get("step-2").unwrap();
        assert!(matches!(
            &step2.status,
            StepExecutionStatus::Failed { error } if error == "Test error"
        ));
    }

    #[tokio::test]
    async fn test_get_active_executions() {
        let tracker = WorkflowTracker::new();

        tracker
            .start_workflow("wf-1".to_string(), "test".to_string())
            .await;
        tracker
            .start_workflow("wf-2".to_string(), "test".to_string())
            .await;

        let active = tracker.get_active_executions().await;
        assert_eq!(active.len(), 2);

        // 完成 wf-1
        tracker.workflow_completed("wf-1").await;

        let active = tracker.get_active_executions().await;
        assert_eq!(active.len(), 1);
        assert_eq!(active[0].workflow_id, "wf-2");
    }
}
