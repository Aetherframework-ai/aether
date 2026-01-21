use futures_util::{SinkExt, StreamExt};
use std::net::SocketAddr;
use tokio::net::TcpListener;
use tokio::sync::broadcast;
use tokio_tungstenite::tungstenite::protocol::WebSocketConfig;
use tokio_tungstenite::tungstenite::Message;
use tokio_tungstenite::accept_async_with_config;

use crate::broadcaster::WorkflowEvent;
use crate::tracker::WorkflowTracker;

use serde::{Deserialize, Serialize};

/// Dashboard HTTP API 请求
#[derive(Debug, Deserialize, Serialize)]
pub enum ApiRequest {
    /// 获取所有正在运行的 workflow
    ListActiveWorkflows,
    /// 获取指定 workflow 的执行详情
    GetWorkflow { workflow_id: String },
    /// 获取指定 workflow 的执行历史
    GetWorkflowHistory { workflow_id: String },
}

/// Dashboard HTTP API 响应
#[derive(Debug, Deserialize, Serialize)]
pub enum ApiResponse {
    /// Workflow 列表响应
    WorkflowList { workflows: Vec<WorkflowInfoDto> },
    /// Workflow 详情响应
    WorkflowDetail { detail: WorkflowDetailDto },
    /// Workflow 历史响应
    WorkflowHistory { history: Vec<StepHistoryDto> },
    /// 错误响应
    Error { message: String },
}

/// Workflow 简要信息 DTO
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct WorkflowInfoDto {
    pub workflow_id: String,
    pub workflow_type: String,
    pub current_step: Option<String>,
    pub started_at: u64,
}

/// Workflow 详情 DTO
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct WorkflowDetailDto {
    pub workflow_id: String,
    pub workflow_type: String,
    pub current_step: Option<String>,
    pub step_executions: Vec<StepExecutionDto>,
    pub started_at: u64,
    pub completed_at: Option<u64>,
}

/// Step 执行信息 DTO
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct StepExecutionDto {
    pub step_name: String,
    pub status: String,
    pub started_at: Option<u64>,
    pub completed_at: Option<u64>,
    pub attempt: u32,
}

/// Step 历史记录 DTO
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct StepHistoryDto {
    pub step_name: String,
    pub status: String,
    pub timestamp: u64,
    pub duration_ms: Option<u64>,
}

/// WebSocket 连接处理器
struct WebSocketConnection {
    addr: SocketAddr,
    tx: broadcast::Sender<WorkflowEvent>,
    tracker: WorkflowTracker,
}

impl WebSocketConnection {
    async fn handle(self, stream: tokio::net::TcpStream) {
        let addr = self.addr;

        // WebSocket 配置
        let config = WebSocketConfig {
            max_message_size: Some(64 * 1024 * 1024), // 64MB
            max_frame_size: Some(16 * 1024 * 1024),   // 16MB
            ..Default::default()
        };

        // 执行 WebSocket 握手
        let ws_stream = match accept_async_with_config(stream, Some(config)).await {
            Ok(stream) => {
                println!("[Dashboard] WebSocket handshake successful for {}", addr);
                stream
            }
            Err(e) => {
                eprintln!("[Dashboard] WebSocket handshake failed for {}: {}", addr, e);
                return;
            }
        };

        let (mut ws_sender, mut ws_receiver) = ws_stream.split();
        let mut shutdown_rx = self.tx.subscribe();

        println!("[Dashboard] Client connected: {}", addr);

        // 循环处理消息
        loop {
            tokio::select! {
                // 处理客户端消息
                msg_result = ws_receiver.next() => {
                    match msg_result {
                        Some(Ok(msg)) => {
                            if msg.is_text() {
                                self.handle_text_message(&msg, &mut ws_sender).await;
                            } else if msg.is_binary() {
                                println!("[Dashboard] Received binary data from {}: {} bytes", addr, msg.len());
                            } else if msg.is_close() {
                                println!("[Dashboard] Client {} initiated close", addr);
                                break;
                            }
                        }
                        Some(Err(e)) => {
                            eprintln!("[Dashboard] Error reading from {}: {}", addr, e);
                            break;
                        }
                        None => {
                            println!("[Dashboard] Connection closed by {}", addr);
                            break;
                        }
                    }
                }

                // 处理广播事件
                result = shutdown_rx.recv() => {
                    match result {
                        Ok(event) => {
                            if let Err(e) = self.send_event(&event, &mut ws_sender).await {
                                eprintln!("[Dashboard] Error sending to {}: {}", addr, e);
                                break;
                            }
                        }
                        Err(broadcast::error::RecvError::Lagged(_)) => {
                            // 跳过丢失的消息
                            continue;
                        }
                        Err(broadcast::error::RecvError::Closed) => {
                            println!("[Dashboard] Broadcast channel closed");
                            break;
                        }
                    }
                }
            }
        }

        println!("[Dashboard] Client disconnected: {}", addr);
    }

    async fn handle_text_message(
        &self,
        msg: &Message,
        ws_sender: &mut futures_util::stream::SplitSink<tokio_tungstenite::WebSocketStream<tokio::net::TcpStream>, Message>,
    ) {
        let text = msg.to_text().unwrap_or("");
        println!("[Dashboard] Received from {}: {}", self.addr, text);

        // 解析请求
        let request: Result<ApiRequest, _> = serde_json::from_str(text);

        match request {
            Ok(ApiRequest::ListActiveWorkflows) => {
                self.send_workflow_list(ws_sender).await;
            }
            Ok(ApiRequest::GetWorkflow { workflow_id }) => {
                self.send_workflow_detail(ws_sender, &workflow_id).await;
            }
            Ok(ApiRequest::GetWorkflowHistory { workflow_id }) => {
                self.send_workflow_history(ws_sender, &workflow_id).await;
            }
            Err(e) => {
                let error = ApiResponse::Error {
                    message: format!("Invalid request: {}", e),
                };
                let _ = ws_sender.send(Message::Text(serde_json::to_string(&error).unwrap()));
            }
        }
    }

    async fn send_event(
        &self,
        event: &WorkflowEvent,
        ws_sender: &mut futures_util::stream::SplitSink<tokio_tungstenite::WebSocketStream<tokio::net::TcpStream>, Message>,
    ) -> Result<(), tokio_tungstenite::tungstenite::Error> {
        let json = serde_json::to_string(event).unwrap();
        ws_sender.send(Message::Text(json)).await
    }

    async fn send_workflow_list(
        &self,
        ws_sender: &mut futures_util::stream::SplitSink<tokio_tungstenite::WebSocketStream<tokio::net::TcpStream>, Message>,
    ) {
        let workflows = self.tracker.get_active_executions().await;

        let workflow_infos: Vec<WorkflowInfoDto> = workflows
            .iter()
            .map(|w| WorkflowInfoDto {
                workflow_id: w.workflow_id.clone(),
                workflow_type: w.workflow_type.clone(),
                current_step: w.current_step.clone(),
                started_at: w.started_at.seconds as u64,
            })
            .collect();

        let response = ApiResponse::WorkflowList {
            workflows: workflow_infos,
        };

        let json = serde_json::to_string(&response).unwrap();
        let _ = ws_sender.send(Message::Text(json)).await;
    }

    async fn send_workflow_detail(
        &self,
        ws_sender: &mut futures_util::stream::SplitSink<tokio_tungstenite::WebSocketStream<tokio::net::TcpStream>, Message>,
        workflow_id: &str,
    ) {
        let execution = self.tracker.get_execution(workflow_id).await;

        match execution {
            Some(w) => {
                let step_executions: Vec<StepExecutionDto> = w
                    .step_executions
                    .iter()
                    .map(|(name, step)| StepExecutionDto {
                        step_name: name.clone(),
                        status: step.status.to_string(),
                        started_at: step.started_at.as_ref().map(|t| t.seconds as u64),
                        completed_at: step.completed_at.as_ref().map(|t| t.seconds as u64),
                        attempt: step.attempt,
                    })
                    .collect();

                let detail = WorkflowDetailDto {
                    workflow_id: w.workflow_id,
                    workflow_type: w.workflow_type,
                    current_step: w.current_step,
                    step_executions,
                    started_at: w.started_at.seconds as u64,
                    completed_at: w.completed_at.as_ref().map(|t| t.seconds as u64),
                };

                let response = ApiResponse::WorkflowDetail { detail };
                let json = serde_json::to_string(&response).unwrap();
                let _ = ws_sender.send(Message::Text(json)).await;
            }
            None => {
                let response = ApiResponse::Error {
                    message: format!("Workflow not found: {}", workflow_id),
                };
                let json = serde_json::to_string(&response).unwrap();
                let _ = ws_sender.send(Message::Text(json)).await;
            }
        }
    }

    async fn send_workflow_history(
        &self,
        ws_sender: &mut futures_util::stream::SplitSink<tokio_tungstenite::WebSocketStream<tokio::net::TcpStream>, Message>,
        workflow_id: &str,
    ) {
        let execution = self.tracker.get_execution(workflow_id).await;

        match execution {
            Some(w) => {
                let mut history: Vec<StepHistoryDto> = w
                    .step_executions
                    .iter()
                    .map(|(name, step)| {
                        let duration_ms = match (&step.started_at, &step.completed_at) {
                            (Some(start), Some(end)) => {
                                Some(end.seconds.saturating_sub(start.seconds) as u64 * 1000)
                            }
                            _ => None,
                        };

                        StepHistoryDto {
                            step_name: name.clone(),
                            status: step.status.to_string(),
                            timestamp: step.started_at.as_ref().map(|t| t.seconds as u64).unwrap_or(0),
                            duration_ms,
                        }
                    })
                    .collect();

                history.sort_by_key(|h| h.timestamp);

                let response = ApiResponse::WorkflowHistory { history };
                let json = serde_json::to_string(&response).unwrap();
                let _ = ws_sender.send(Message::Text(json)).await;
            }
            None => {
                let response = ApiResponse::Error {
                    message: format!("Workflow not found: {}", workflow_id),
                };
                let json = serde_json::to_string(&response).unwrap();
                let _ = ws_sender.send(Message::Text(json)).await;
            }
        }
    }
}

/// Dashboard WebSocket 服务器
pub struct DashboardServer {
    tracker: WorkflowTracker,
    broadcaster: broadcast::Sender<WorkflowEvent>,
}

impl DashboardServer {
    /// 创建新的 Dashboard 服务器实例
    pub fn new(tracker: WorkflowTracker, broadcaster: broadcast::Sender<WorkflowEvent>) -> Self {
        Self {
            tracker,
            broadcaster,
        }
    }

    /// 启动 Dashboard 服务器
    pub async fn start(&self, listen_addr: &str) -> anyhow::Result<()> {
        let addr = listen_addr.parse::<SocketAddr>()?;
        let listener = TcpListener::bind(&addr).await?;

        println!("[Dashboard] Dashboard server listening on {}", addr);

        loop {
            let (stream, addr) = listener.accept().await?;

            let tracker = self.tracker.clone();
            let tx = self.broadcaster.clone();

            tokio::spawn(async move {
                let connection = WebSocketConnection {
                    addr,
                    tx,
                    tracker,
                };
                connection.handle(stream).await;
            });
        }
    }
}

/// 启动 Dashboard WebSocket 服务器
pub async fn start_dashboard_server(
    tracker: WorkflowTracker,
    broadcaster: broadcast::Sender<WorkflowEvent>,
    listen_addr: &str,
) -> anyhow::Result<()> {
    let server = DashboardServer::new(tracker, broadcaster);
    server.start(listen_addr).await
}
