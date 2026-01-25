use std::sync::Arc;
use tower_http::trace::TraceLayer;

use crate::api::routes::create_router;
use crate::persistence::Persistence;
use crate::scheduler::Scheduler;

pub async fn start_server<P: Persistence + Clone + Send + Sync + 'static>(
    scheduler: Scheduler<P>,
    listen_addr: &str,
) -> anyhow::Result<()> {
    let scheduler = Arc::new(scheduler);

    let app = create_router(scheduler).layer(TraceLayer::new_for_http());

    let listener = tokio::net::TcpListener::bind(listen_addr).await?;
    tracing::info!("REST API server listening on {}", listen_addr);

    axum::serve(listener, app).await?;
    Ok(())
}
