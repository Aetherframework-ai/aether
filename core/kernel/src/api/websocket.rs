use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Path, Query, State,
    },
    response::Response,
};
use futures_util::{SinkExt, StreamExt};
use serde::Deserialize;
use std::collections::HashSet;
use std::sync::Arc;
use tokio::sync::Mutex;
use tokio::time::{interval, Duration};

use crate::api::models::{TaskMessage, TaskPayload};
use crate::persistence::Persistence;
use crate::scheduler::Scheduler;

/// Maximum number of tasks to poll in a single request
const POLL_TASKS_LIMIT: usize = 10;

pub type AppState<P> = Arc<Scheduler<P>>;

#[derive(Debug, Deserialize)]
pub struct WsQuery {
    pub token: String,
}

/// WS /workers/{id}/tasks - WebSocket task streaming
///
/// Establishes a WebSocket connection for streaming tasks to a worker.
/// Uses polling internally to check for available tasks.
pub async fn worker_tasks_ws<P: Persistence + Clone + Send + Sync + 'static>(
    ws: WebSocketUpgrade,
    State(scheduler): State<AppState<P>>,
    Path(worker_id): Path<String>,
    Query(query): Query<WsQuery>,
) -> Response {
    // TODO: Validate token
    let _ = query.token;

    ws.on_upgrade(move |socket| handle_worker_socket(socket, scheduler, worker_id))
}

async fn handle_worker_socket<P: Persistence + Clone + Send + Sync + 'static>(
    socket: WebSocket,
    scheduler: Arc<Scheduler<P>>,
    worker_id: String,
) {
    let (mut sender, mut receiver) = socket.split();

    // Task polling interval
    let poll_interval = Duration::from_millis(100);
    let mut poll_timer = interval(poll_interval);

    // Track sent task IDs to avoid duplicates (shared between send and recv tasks)
    let sent_tasks: Arc<Mutex<HashSet<String>>> = Arc::new(Mutex::new(HashSet::new()));
    let sent_tasks_for_recv = Arc::clone(&sent_tasks);

    // Task sending loop (polls for tasks)
    let send_task = async {
        loop {
            poll_timer.tick().await;

            // Poll for available tasks
            let tasks = scheduler.poll_tasks(&worker_id, POLL_TASKS_LIMIT).await;

            for task in tasks {
                // Skip if already sent
                {
                    let guard = sent_tasks.lock().await;
                    if guard.contains(&task.task_id) {
                        continue;
                    }
                }

                // Convert input to JSON Value
                let input_value = match serde_json::from_slice(&task.input) {
                    Ok(v) => v,
                    Err(_) => {
                        // If not valid JSON, wrap as string
                        serde_json::Value::String(
                            String::from_utf8_lossy(&task.input).to_string(),
                        )
                    }
                };

                let payload = TaskPayload {
                    task_id: task.task_id.clone(),
                    workflow_id: task.workflow_id.clone(),
                    step_name: task.step_name.clone(),
                    input: input_value,
                    retry_policy: None,
                };

                let msg = TaskMessage {
                    msg_type: "task".to_string(),
                    payload,
                };

                let json = match serde_json::to_string(&msg) {
                    Ok(j) => j,
                    Err(e) => {
                        tracing::error!("Failed to serialize task: {}", e);
                        continue;
                    }
                };

                if sender.send(Message::Text(json.into())).await.is_err() {
                    tracing::debug!("WebSocket send failed for worker {}", worker_id);
                    return;
                }

                sent_tasks.lock().await.insert(task.task_id);
            }
        }
    };

    // ACK receiving loop
    let recv_task = async {
        while let Some(result) = receiver.next().await {
            match result {
                Ok(Message::Text(text)) => {
                    // Handle ACK messages
                    if let Ok(ack) = serde_json::from_str::<serde_json::Value>(&text) {
                        if ack.get("type").and_then(|t| t.as_str()) == Some("ack") {
                            if let Some(task_id) = ack.get("taskId").and_then(|t| t.as_str()) {
                                tracing::debug!("Received ACK for task: {}", task_id);
                                // Remove from sent_tasks to free memory
                                sent_tasks_for_recv.lock().await.remove(task_id);
                            }
                        }
                    }
                }
                Ok(Message::Close(_)) => {
                    tracing::debug!("WebSocket closed by worker {}", worker_id);
                    break;
                }
                Ok(Message::Ping(data)) => {
                    // Pong is handled automatically by axum
                    tracing::trace!("Received ping from worker {}: {:?}", worker_id, data);
                }
                Err(e) => {
                    tracing::error!("WebSocket error for worker {}: {}", worker_id, e);
                    break;
                }
                _ => {}
            }
        }
    };

    // Run both loops concurrently
    tokio::select! {
        _ = send_task => {
            tracing::debug!("Send task ended for worker {}", worker_id);
        },
        _ = recv_task => {
            tracing::debug!("Receive task ended for worker {}", worker_id);
        },
    }

    tracing::info!("WebSocket connection closed for worker {}", worker_id);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ws_query_deserialize() {
        let query: WsQuery = serde_json::from_str(r#"{"token": "test-token"}"#).unwrap();
        assert_eq!(query.token, "test-token");
    }
}
