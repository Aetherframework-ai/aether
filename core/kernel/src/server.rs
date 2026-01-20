use crate::grpc_server::ClientService;
use crate::persistence::Persistence;
use crate::scheduler::Scheduler;
use crate::proto::client_service_server::ClientServiceServer;
use crate::proto::worker_service_server::WorkerServiceServer;
use tonic::transport::Server;

pub async fn start_server<P: Persistence + Clone + Send + Sync + 'static>(
    scheduler: Scheduler<P>,
    listen_addr: &str,
) -> anyhow::Result<()> {
    println!("Starting Aether server on {}", listen_addr);

    let client_service = ClientService::new(scheduler);

    let addr = listen_addr.parse::<std::net::SocketAddr>()?;
    Server::builder()
        .add_service(ClientServiceServer::new(client_service.clone()))
        .add_service(WorkerServiceServer::new(client_service))
        .serve(addr)
        .await?;

    Ok(())
}
