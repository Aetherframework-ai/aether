use serde::{Deserialize, Serialize};
use tokio::sync::broadcast;

/// WebSocket 事件类型
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub enum EventType {
    #[default]
    StepStarted,
    StepCompleted,
    StepFailed,
    WorkflowCompleted,
    WorkflowFailed,
    WorkflowCancelled,
}

/// WebSocket 事件负载
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StepStartedPayload {
    pub step_name: String,
    pub input: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StepCompletedPayload {
    pub step_name: String,
    pub output: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StepFailedPayload {
    pub step_name: String,
    pub error: String,
    pub attempt: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowCompletedPayload {
    pub result: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowFailedPayload {
    pub error: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowCancelledPayload {}

/// WebSocket 事件
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowEvent {
    #[serde(default, skip)]
    pub event_type: EventType,
    pub workflow_id: String,
    pub workflow_type: String,
    pub timestamp: u64,
    #[serde(flatten)]
    pub payload: EventPayload,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "event_type", rename_all = "snake_case")]
pub enum EventPayload {
    StepStarted(StepStartedPayload),
    StepCompleted(StepCompletedPayload),
    StepFailed(StepFailedPayload),
    WorkflowCompleted(WorkflowCompletedPayload),
    WorkflowFailed(WorkflowFailedPayload),
    WorkflowCancelled(WorkflowCancelledPayload),
}

impl WorkflowEvent {
    pub fn new(
        event_type: EventType,
        workflow_id: String,
        workflow_type: String,
        payload: EventPayload,
    ) -> Self {
        Self {
            event_type,
            workflow_id,
            workflow_type,
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
            payload,
        }
    }

    /// 转换为 JSON 字符串
    pub fn to_json(&self) -> Result<String, serde_json::Error> {
        serde_json::to_string(self)
    }

    /// 从 JSON 字符串解析
    pub fn from_json(json: &str) -> Result<Self, serde_json::Error> {
        serde_json::from_str(json)
    }
}

/// 事件广播器
///
/// 使用 tokio::sync::broadcast 实现多客户端事件广播。
/// 所有订阅者会收到相同的事件，支持背压处理。
#[derive(Clone)]
pub struct EventBroadcaster {
    tx: broadcast::Sender<WorkflowEvent>,
}

impl EventBroadcaster {
    /// 创建新的广播器
    pub fn new() -> Self {
        let (tx, _rx) = broadcast::channel(1000);
        Self { tx }
    }

    /// 获取内部的广播 Sender
    pub fn get_sender(&self) -> broadcast::Sender<WorkflowEvent> {
        self.tx.clone()
    }

    /// 订阅事件
    pub fn subscribe(&self) -> broadcast::Receiver<WorkflowEvent> {
        self.tx.subscribe()
    }

    /// 广播事件给所有订阅者
    pub fn broadcast(
        &self,
        event: WorkflowEvent,
    ) -> Result<usize, broadcast::error::SendError<WorkflowEvent>> {
        self.tx.send(event)
    }

    /// 获取当前订阅者数量
    pub fn subscriber_count(&self) -> usize {
        self.tx.receiver_count()
    }

    /// 广播 step 开始事件
    pub async fn broadcast_step_started(
        &self,
        workflow_id: &str,
        workflow_type: &str,
        step_name: &str,
        input: Vec<u8>,
    ) -> Result<usize, broadcast::error::SendError<WorkflowEvent>> {
        let payload = EventPayload::StepStarted(StepStartedPayload {
            step_name: step_name.to_string(),
            input,
        });
        let event = WorkflowEvent::new(
            EventType::StepStarted,
            workflow_id.to_string(),
            workflow_type.to_string(),
            payload,
        );
        self.broadcast(event)
    }

    /// 广播 step 完成事件
    pub async fn broadcast_step_completed(
        &self,
        workflow_id: &str,
        workflow_type: &str,
        step_name: &str,
        output: Vec<u8>,
    ) -> Result<usize, broadcast::error::SendError<WorkflowEvent>> {
        let payload = EventPayload::StepCompleted(StepCompletedPayload {
            step_name: step_name.to_string(),
            output,
        });
        let event = WorkflowEvent::new(
            EventType::StepCompleted,
            workflow_id.to_string(),
            workflow_type.to_string(),
            payload,
        );
        self.broadcast(event)
    }

    /// 广播 step 失败事件
    pub async fn broadcast_step_failed(
        &self,
        workflow_id: &str,
        workflow_type: &str,
        step_name: &str,
        error: String,
        attempt: u32,
    ) -> Result<usize, broadcast::error::SendError<WorkflowEvent>> {
        let payload = EventPayload::StepFailed(StepFailedPayload {
            step_name: step_name.to_string(),
            error,
            attempt,
        });
        let event = WorkflowEvent::new(
            EventType::StepFailed,
            workflow_id.to_string(),
            workflow_type.to_string(),
            payload,
        );
        self.broadcast(event)
    }

    /// 广播 workflow 完成事件
    pub async fn broadcast_workflow_completed(
        &self,
        workflow_id: &str,
        workflow_type: &str,
        result: Vec<u8>,
    ) -> Result<usize, broadcast::error::SendError<WorkflowEvent>> {
        let payload = EventPayload::WorkflowCompleted(WorkflowCompletedPayload { result });
        let event = WorkflowEvent::new(
            EventType::WorkflowCompleted,
            workflow_id.to_string(),
            workflow_type.to_string(),
            payload,
        );
        self.broadcast(event)
    }

    /// 广播 workflow 失败事件
    pub async fn broadcast_workflow_failed(
        &self,
        workflow_id: &str,
        workflow_type: &str,
        error: String,
    ) -> Result<usize, broadcast::error::SendError<WorkflowEvent>> {
        let payload = EventPayload::WorkflowFailed(WorkflowFailedPayload { error });
        let event = WorkflowEvent::new(
            EventType::WorkflowFailed,
            workflow_id.to_string(),
            workflow_type.to_string(),
            payload,
        );
        self.broadcast(event)
    }
}

impl Default for EventBroadcaster {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_broadcast_step_started() {
        let broadcaster = EventBroadcaster::new();
        let mut rx = broadcaster.subscribe();

        // 广播事件
        let count = broadcaster
            .broadcast_step_started("wf-1", "test-type", "step-1", vec![1, 2, 3])
            .await
            .unwrap();

        assert_eq!(count, 1);

        // 接收事件
        let event = rx.recv().await.unwrap();
        assert_eq!(event.workflow_id, "wf-1");
        assert_eq!(event.event_type, EventType::StepStarted);

        if let EventPayload::StepStarted(payload) = event.payload {
            assert_eq!(payload.step_name, "step-1");
            assert_eq!(payload.input, vec![1, 2, 3]);
        } else {
            panic!("Expected StepStarted payload");
        }
    }

    #[tokio::test]
    async fn test_multiple_subscribers() {
        let broadcaster = EventBroadcaster::new();
        let mut rx1 = broadcaster.subscribe();
        let mut rx2 = broadcaster.subscribe();

        // 广播事件
        broadcaster
            .broadcast_step_completed("wf-1", "test", "step-1", vec![4, 5, 6])
            .await
            .unwrap();

        // 两个订阅者都应该收到事件
        let event1 = rx1.recv().await.unwrap();
        let event2 = rx2.recv().await.unwrap();

        assert_eq!(event1.event_type, EventType::StepCompleted);
        assert_eq!(event2.event_type, EventType::StepCompleted);
    }

    #[tokio::test]
    async fn test_serialize_deserialize() {
        let event = WorkflowEvent::new(
            EventType::StepFailed,
            "wf-1".to_string(),
            "test-type".to_string(),
            EventPayload::StepFailed(StepFailedPayload {
                step_name: "step-1".to_string(),
                error: "Test error".to_string(),
                attempt: 2,
            }),
        );

        let json = event.to_json().unwrap();
        let decoded = WorkflowEvent::from_json(&json).unwrap();

        // 验证 workflow_id 和 workflow_type 正确反序列化
        assert_eq!(event.workflow_id, decoded.workflow_id);
        assert_eq!(event.workflow_type, decoded.workflow_type);

        // 验证 payload 正确反序列化（这包含了事件类型信息）
        assert!(matches!(decoded.payload, EventPayload::StepFailed(_)));
    }
}
