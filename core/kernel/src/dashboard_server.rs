//! Dashboard 服务器
//!
//! 提供 HTTP 静态文件服务和 WebSocket 实时事件推送。
//! 使用 axum 框架，在单个端口同时处理 HTTP 和 WebSocket 请求。

use std::sync::Arc;

use axum::{
    extract::{
        ws::{Message, WebSocket},
        State, WebSocketUpgrade,
    },
    http::{header, StatusCode, Uri},
    response::{Html, IntoResponse, Response},
    routing::get,
    Router,
};
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use tokio::sync::broadcast;

use crate::broadcaster::WorkflowEvent;
use crate::dashboard_assets::DashboardAssets;
use crate::tracker::WorkflowTracker;

// ========== DTO 定义 ==========

/// Dashboard HTTP API 请求
#[derive(Debug, Deserialize, Serialize)]
pub enum ApiRequest {
    /// 获取所有正在运行的 workflow
    ListActiveWorkflows,
    /// 获取所有 workflow（包括已完成的）
    ListAllWorkflows,
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
    pub completed_at: Option<u64>,
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

// ========== 应用状态 ==========

/// Dashboard 服务器共享状态
#[derive(Clone)]
pub struct AppState {
    pub tracker: WorkflowTracker,
    pub broadcaster: broadcast::Sender<WorkflowEvent>,
}

// ========== 路由处理 ==========

/// 静态文件处理器
///
/// 处理所有非 WebSocket 的 HTTP 请求，返回嵌入的静态文件。
/// 对于不存在的路径，返回 index.html（SPA fallback）。
async fn static_handler(uri: Uri) -> Response {
    let path = uri.path().trim_start_matches('/');
    let path = if path.is_empty() { "index.html" } else { path };

    match DashboardAssets::get(path) {
        Some(content) => {
            let mime = mime_guess::from_path(path).first_or_octet_stream();
            (
                StatusCode::OK,
                [(header::CONTENT_TYPE, mime.as_ref())],
                content.data.into_owned(),
            )
                .into_response()
        }
        None => {
            // SPA fallback: 返回 index.html
            match DashboardAssets::get("index.html") {
                Some(content) => Html(content.data.into_owned()).into_response(),
                None => (StatusCode::NOT_FOUND, "Dashboard not found").into_response(),
            }
        }
    }
}

/// WebSocket 升级处理器
async fn ws_handler(ws: WebSocketUpgrade, State(state): State<Arc<AppState>>) -> Response {
    ws.on_upgrade(move |socket| handle_websocket(socket, state))
}

/// WebSocket 连接处理
async fn handle_websocket(socket: WebSocket, state: Arc<AppState>) {
    let (mut sender, mut receiver) = socket.split();
    let mut broadcast_rx = state.broadcaster.subscribe();

    println!("[Dashboard] WebSocket client connected");

    loop {
        tokio::select! {
            // 处理客户端消息
            msg = receiver.next() => {
                match msg {
                    Some(Ok(Message::Text(text))) => {
                        if let Some(response) = handle_api_request(&text, &state).await {
                            let json = serde_json::to_string(&response).unwrap_or_default();
                            if sender.send(Message::Text(json)).await.is_err() {
                                break;
                            }
                        }
                    }
                    Some(Ok(Message::Close(_))) | None => {
                        println!("[Dashboard] WebSocket client disconnected");
                        break;
                    }
                    Some(Err(e)) => {
                        eprintln!("[Dashboard] WebSocket error: {}", e);
                        break;
                    }
                    _ => {}
                }
            }

            // 处理广播事件
            event = broadcast_rx.recv() => {
                match event {
                    Ok(event) => {
                        let json = serde_json::to_string(&event).unwrap_or_default();
                        if sender.send(Message::Text(json)).await.is_err() {
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
}

/// 处理 API 请求
async fn handle_api_request(text: &str, state: &AppState) -> Option<ApiResponse> {
    let request: Result<ApiRequest, _> = serde_json::from_str(text);

    match request {
        Ok(ApiRequest::ListActiveWorkflows) => Some(get_workflow_list(state, false).await),
        Ok(ApiRequest::ListAllWorkflows) => Some(get_workflow_list(state, true).await),
        Ok(ApiRequest::GetWorkflow { workflow_id }) => {
            Some(get_workflow_detail(state, &workflow_id).await)
        }
        Ok(ApiRequest::GetWorkflowHistory { workflow_id }) => {
            Some(get_workflow_history(state, &workflow_id).await)
        }
        Err(e) => Some(ApiResponse::Error {
            message: format!("Invalid request: {}", e),
        }),
    }
}

/// 获取 workflow 列表
async fn get_workflow_list(state: &AppState, include_all: bool) -> ApiResponse {
    let workflows = if include_all {
        state.tracker.get_all_executions().await
    } else {
        state.tracker.get_active_executions().await
    };

    let workflow_infos: Vec<WorkflowInfoDto> = workflows
        .iter()
        .map(|w| WorkflowInfoDto {
            workflow_id: w.workflow_id.clone(),
            workflow_type: w.workflow_type.clone(),
            current_step: w.current_step.clone(),
            started_at: w.started_at.seconds as u64,
            completed_at: w.completed_at.as_ref().map(|t| t.seconds as u64),
        })
        .collect();

    ApiResponse::WorkflowList {
        workflows: workflow_infos,
    }
}

/// 获取 workflow 详情
async fn get_workflow_detail(state: &AppState, workflow_id: &str) -> ApiResponse {
    match state.tracker.get_execution(workflow_id).await {
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

            ApiResponse::WorkflowDetail { detail }
        }
        None => ApiResponse::Error {
            message: format!("Workflow not found: {}", workflow_id),
        },
    }
}

/// 获取 workflow 历史
async fn get_workflow_history(state: &AppState, workflow_id: &str) -> ApiResponse {
    match state.tracker.get_execution(workflow_id).await {
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
                        timestamp: step
                            .started_at
                            .as_ref()
                            .map(|t| t.seconds as u64)
                            .unwrap_or(0),
                        duration_ms,
                    }
                })
                .collect();

            history.sort_by_key(|h| h.timestamp);

            ApiResponse::WorkflowHistory { history }
        }
        None => ApiResponse::Error {
            message: format!("Workflow not found: {}", workflow_id),
        },
    }
}

// ========== 服务器启动 ==========

/// Dashboard 服务器
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
        let state = Arc::new(AppState {
            tracker: self.tracker.clone(),
            broadcaster: self.broadcaster.clone(),
        });

        let app = Router::new()
            .route("/ws", get(ws_handler))
            .fallback(static_handler)
            .with_state(state);

        let listener = tokio::net::TcpListener::bind(listen_addr).await?;
        println!("[Dashboard] Server listening on http://{}", listen_addr);

        axum::serve(listener, app).await?;
        Ok(())
    }
}

/// 启动 Dashboard 服务器
pub async fn start_dashboard_server(
    tracker: WorkflowTracker,
    broadcaster: broadcast::Sender<WorkflowEvent>,
    listen_addr: &str,
) -> anyhow::Result<()> {
    let server = DashboardServer::new(tracker, broadcaster);
    server.start(listen_addr).await
}
