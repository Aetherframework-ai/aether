use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct ApiErrorBody {
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<serde_json::Value>,
}

#[derive(Debug)]
pub struct ApiError {
    pub status: StatusCode,
    pub body: ApiErrorBody,
}

impl ApiError {
    pub fn not_found(code: &str, message: &str) -> Self {
        Self {
            status: StatusCode::NOT_FOUND,
            body: ApiErrorBody {
                code: code.to_string(),
                message: message.to_string(),
                details: None,
            },
        }
    }

    pub fn bad_request(code: &str, message: &str) -> Self {
        Self {
            status: StatusCode::BAD_REQUEST,
            body: ApiErrorBody {
                code: code.to_string(),
                message: message.to_string(),
                details: None,
            },
        }
    }

    pub fn internal(message: &str) -> Self {
        Self {
            status: StatusCode::INTERNAL_SERVER_ERROR,
            body: ApiErrorBody {
                code: "INTERNAL_ERROR".to_string(),
                message: message.to_string(),
                details: None,
            },
        }
    }

    pub fn timeout(message: &str) -> Self {
        Self {
            status: StatusCode::REQUEST_TIMEOUT,
            body: ApiErrorBody {
                code: "TIMEOUT".to_string(),
                message: message.to_string(),
                details: None,
            },
        }
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let body = Json(serde_json::json!({ "error": self.body }));
        (self.status, body).into_response()
    }
}
