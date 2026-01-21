use aetherframework_cli::templates::{render_template_dir, TemplateType, TemplateVariables};
use aetherframework_kernel::persistence::l0_memory::L0MemoryStore;
use aetherframework_kernel::persistence::l1_snapshot::L1SnapshotStore;
use aetherframework_kernel::persistence::l2_state_action_log::L2StateActionStore;
use aetherframework_kernel::persistence::{Persistence, PersistenceLevel};
use aetherframework_kernel::scheduler::Scheduler;
use aetherframework_kernel::server;
use aetherframework_kernel::state_machine::{Workflow, WorkflowState};
use anyhow::Context;
use clap::{Parser, Subcommand};
use std::path::PathBuf;
use std::str::FromStr;

/// Wrapper enum for persistence backends
enum PersistenceBackend {
    L0Memory(L0MemoryStore),
    L1Snapshot(L1SnapshotStore),
    L2StateActionLog(L2StateActionStore),
}

impl Clone for PersistenceBackend {
    fn clone(&self) -> Self {
        match self {
            PersistenceBackend::L0Memory(_) => PersistenceBackend::L0Memory(L0MemoryStore::new()),
            PersistenceBackend::L1Snapshot(_) => {
                PersistenceBackend::L1Snapshot(L1SnapshotStore::new(100))
            }
            PersistenceBackend::L2StateActionLog(_) => {
                PersistenceBackend::L2StateActionLog(L2StateActionStore::new())
            }
        }
    }
}

#[async_trait::async_trait]
impl Persistence for PersistenceBackend {
    async fn save_workflow(&self, workflow: &Workflow) -> anyhow::Result<()> {
        match self {
            PersistenceBackend::L0Memory(store) => store.save_workflow(workflow).await,
            PersistenceBackend::L1Snapshot(store) => store.save_workflow(workflow).await,
            PersistenceBackend::L2StateActionLog(store) => store.save_workflow(workflow).await,
        }
    }

    async fn get_workflow(&self, id: &str) -> anyhow::Result<Option<Workflow>> {
        match self {
            PersistenceBackend::L0Memory(store) => store.get_workflow(id).await,
            PersistenceBackend::L1Snapshot(store) => store.get_workflow(id).await,
            PersistenceBackend::L2StateActionLog(store) => store.get_workflow(id).await,
        }
    }

    async fn list_workflows(&self, workflow_type: Option<&str>) -> anyhow::Result<Vec<Workflow>> {
        match self {
            PersistenceBackend::L0Memory(store) => store.list_workflows(workflow_type).await,
            PersistenceBackend::L1Snapshot(store) => store.list_workflows(workflow_type).await,
            PersistenceBackend::L2StateActionLog(store) => {
                store.list_workflows(workflow_type).await
            }
        }
    }

    async fn update_workflow_state(&self, id: &str, state: WorkflowState) -> anyhow::Result<()> {
        match self {
            PersistenceBackend::L0Memory(store) => store.update_workflow_state(id, state).await,
            PersistenceBackend::L1Snapshot(store) => store.update_workflow_state(id, state).await,
            PersistenceBackend::L2StateActionLog(store) => {
                store.update_workflow_state(id, state).await
            }
        }
    }

    async fn save_step_result(
        &self,
        workflow_id: &str,
        step_name: &str,
        result: Vec<u8>,
    ) -> anyhow::Result<()> {
        match self {
            PersistenceBackend::L0Memory(store) => {
                store.save_step_result(workflow_id, step_name, result).await
            }
            PersistenceBackend::L1Snapshot(store) => {
                store.save_step_result(workflow_id, step_name, result).await
            }
            PersistenceBackend::L2StateActionLog(store) => {
                store.save_step_result(workflow_id, step_name, result).await
            }
        }
    }

    async fn get_step_result(
        &self,
        workflow_id: &str,
        step_name: &str,
    ) -> anyhow::Result<Option<Vec<u8>>> {
        match self {
            PersistenceBackend::L0Memory(store) => {
                store.get_step_result(workflow_id, step_name).await
            }
            PersistenceBackend::L1Snapshot(store) => {
                store.get_step_result(workflow_id, step_name).await
            }
            PersistenceBackend::L2StateActionLog(store) => {
                store.get_step_result(workflow_id, step_name).await
            }
        }
    }
}

#[derive(Parser, Debug)]
#[command(name = "aether")]
#[command(about = "Aether workflow engine CLI")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand, Debug)]
enum Commands {
    /// Start the Aether server
    Serve {
        /// Database path (default: ./data/aether.db)
        #[arg(long, default_value = "./data/aether.db")]
        db: PathBuf,
        /// gRPC port (default: 7233)
        #[arg(long, default_value = "7233")]
        grpc_port: u16,
        /// HTTP port for dashboard (default: 7234)
        #[arg(long, default_value = "7234")]
        http_port: u16,
        /// Enable Dashboard (default: true)
        #[arg(long, default_value = "true")]
        dashboard: bool,
        /// Dashboard WebSocket port (default: 7235)
        #[arg(long, default_value = "7235")]
        dashboard_port: u16,
        /// Persistence mode (memory|snapshot|state-action-log)
        #[arg(long, default_value = "memory")]
        persistence: String,
    },
    /// Initialize a new Aether project
    Init {
        /// Project name
        name: String,
        /// Output directory
        #[arg(short, long, default_value = ".")]
        output: PathBuf,
        /// Project template: ts | nestjs | python
        #[arg(short, long, default_value = "ts")]
        template: String,
    },
    /// Generate configuration
    Gen {
        #[command(subcommand)]
        action: GenAction,
    },
    /// List workflows
    Workflow {
        #[command(subcommand)]
        action: WorkflowAction,
    },
    /// Show workflow status
    Status { workflow_id: String },
    /// Cancel a workflow
    Cancel { workflow_id: String },
}

#[derive(Subcommand, Debug)]
enum GenAction {
    /// Generate aether.config.ts from registered services
    Config {
        /// Configuration source: local | remote | both
        #[arg(short = 'c', long, default_value = "both")]
        config_source: String,
        /// Aether server address (default: localhost:7233)
        #[arg(short = 's', long, default_value = "localhost:7233")]
        server: String,
        /// Output file path (default: ./aether.config.ts)
        #[arg(short = 'o', long)]
        output: Option<PathBuf>,
        /// Output format: ts | json
        #[arg(long, default_value = "ts")]
        format: String,
        /// Overwrite existing file
        #[arg(long)]
        overwrite: bool,
        /// Preview without writing
        #[arg(long)]
        dry_run: bool,
    },
}

#[derive(Subcommand, Debug)]
enum WorkflowAction {
    List {
        /// Workflow type filter
        #[arg(short, long)]
        r#type: Option<String>,
        /// State filter
        #[arg(short, long)]
        state: Option<String>,
    },
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt::init();

    let cli = Cli::parse();

    match cli.command {
        Commands::Serve {
            db,
            grpc_port,
            http_port,
            dashboard,
            dashboard_port,
            persistence,
        } => serve_command(db, grpc_port, http_port, dashboard, dashboard_port, persistence).await,
        Commands::Init {
            name,
            output,
            template,
        } => init_command(name, output, template).await,
        Commands::Gen { action } => gen_command(action).await,
        Commands::Workflow { action } => workflow_command(action).await,
        Commands::Status { workflow_id } => status_command(workflow_id).await,
        Commands::Cancel { workflow_id } => cancel_command(workflow_id).await,
    }
}

async fn serve_command(
    db: PathBuf,
    grpc_port: u16,
    http_port: u16,
    dashboard: bool,
    dashboard_port: u16,
    persistence: String,
) -> anyhow::Result<()> {
    println!("Starting Aether server...");
    println!("Database: {:?}", db);
    println!("gRPC Port: {}", grpc_port);
    println!("HTTP Port: {}", http_port);
    println!("Dashboard: {}", if dashboard { "enabled" } else { "disabled" });
    if dashboard {
        println!("Dashboard WS Port: {}", dashboard_port);
    }
    println!("Persistence: {}", persistence);
    println!();

    // 创建数据目录
    if let Some(parent) = db.parent() {
        if !parent.exists() {
            tokio::fs::create_dir_all(parent).await?;
        }
    }

    // 解析持久化模式（目前只支持 memory，其他模式需要后续实现文件持久化）
    let persistence_level = match persistence.to_lowercase().as_str() {
        "memory" => PersistenceLevel::L0Memory,
        "snapshot" => {
            println!("⚠️  Snapshot persistence mode not yet implemented, using memory mode.");
            PersistenceLevel::L0Memory
        }
        "state-action-log" => {
            println!(
                "⚠️  State-Action-Log persistence mode not yet implemented, using memory mode."
            );
            PersistenceLevel::L0Memory
        }
        _ => {
            eprintln!(
                "Unknown persistence mode: {}. Using 'memory' instead.",
                persistence
            );
            PersistenceLevel::L0Memory
        }
    };

    // 创建持久化层
    let persistence = match persistence_level {
        PersistenceLevel::L0Memory => {
            println!("📦 Using L0 Memory persistence (no durability)");
            PersistenceBackend::L0Memory(L0MemoryStore::new())
        }
        PersistenceLevel::L1Snapshot => {
            println!("📦 Using L1 Snapshot persistence");
            PersistenceBackend::L1Snapshot(L1SnapshotStore::new(100))
        }
        PersistenceLevel::L2StateActionLog => {
            println!("📦 Using L2 State-Action-Log persistence (full durability)");
            PersistenceBackend::L2StateActionLog(L2StateActionStore::new())
        }
    };

    // 创建调度器
    let scheduler = Scheduler::new(persistence);

    // 启动 gRPC 服务器
    let addr = format!("0.0.0.0:{}", grpc_port);
    println!();
    println!("🚀 Aether server starting on {}", addr);
    println!();
    println!("Press Ctrl+C to stop the server");
    println!();

        // 启动 Dashboard WebSocket 服务器（如果启用）
        if dashboard {
            #[cfg(feature = "dashboard")]
            {
                let dashboard_addr = format!("0.0.0.0:{}", dashboard_port);
                let tracker = scheduler.tracker.clone();
                let broadcaster = scheduler.broadcaster.get_sender();

                tokio::spawn(async move {
                    if let Err(e) = aetherframework_kernel::dashboard_server::start_dashboard_server(
                        tracker,
                        broadcaster,
                        &dashboard_addr,
                    )
                    .await
                    {
                        eprintln!("Dashboard server error: {}", e);
                    }
                });

                println!("🎨 Dashboard WebSocket server starting on 0.0.0.0:{}", dashboard_port);
            }

            #[cfg(not(feature = "dashboard"))]
            {
                println!("⚠️  Dashboard feature not enabled. Rebuild with --features dashboard");
            }
        }

    // 使用 aetherframework-kernel 的服务器启动函数
    server::start_server(scheduler, &addr).await?;

    Ok(())
}

async fn init_command(name: String, output: PathBuf, template: String) -> anyhow::Result<()> {
    println!("Initializing Aether project: {}", name);
    println!("Template: {}", template);
    println!();

    let template_type = TemplateType::from_str(&template)
        .with_context(|| format!("Invalid template type: {}", template))?;

    let cli_root = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let project_dir = output.join(&name);

    if project_dir.exists() {
        return Err(anyhow::anyhow!(
            "Project directory already exists: {:?}",
            project_dir
        ));
    }

    let vars = TemplateVariables::new(&name);

    render_template_dir(template_type, &cli_root, &project_dir, &vars)
        .await
        .with_context(|| format!("Failed to render template: {}", template))?;

    println!("✅ Project created at: {:?}", project_dir);
    println!();
    println!("Next steps:");
    println!("  cd {}", name);
    if template_type == TemplateType::TypeScript {
        println!("  npm install");
        println!("  npm run dev");
    } else if template_type == TemplateType::NestJS {
        println!("  npm install");
        println!("  npm run start:dev");
    } else if template_type == TemplateType::Python {
        println!("  pip install -e .");
        println!("  python -m src.main");
    }

    Ok(())
}

async fn workflow_command(action: WorkflowAction) -> anyhow::Result<()> {
    match action {
        WorkflowAction::List { r#type, state } => {
            println!("Listing workflows...");
            if let Some(t) = r#type {
                println!("Filter by type: {}", t);
            }
            if let Some(s) = state {
                println!("Filter by state: {}", s);
            }
        }
    }
    Ok(())
}

async fn status_command(workflow_id: String) -> anyhow::Result<()> {
    println!("Getting status for workflow: {}", workflow_id);
    // TODO: 实现状态查询
    Ok(())
}

async fn cancel_command(workflow_id: String) -> anyhow::Result<()> {
    println!("Cancelling workflow: {}", workflow_id);
    // TODO: 实现取消工作流
    Ok(())
}

async fn gen_command(action: GenAction) -> anyhow::Result<()> {
    match action {
        GenAction::Config {
            config_source,
            server,
            output,
            format,
            overwrite,
            dry_run,
        } => {
            let output_ref = output.as_ref().map(|p| p as &PathBuf);
            config_gen_command(
                &config_source,
                &server,
                output_ref,
                &format,
                overwrite,
                dry_run,
            )
            .await
        }
    }
}

async fn config_gen_command(
    source: &str,
    server: &str,
    output: Option<&PathBuf>,
    format: &str,
    overwrite: bool,
    dry_run: bool,
) -> anyhow::Result<()> {
    println!("Generating Aether configuration...");
    println!("Source: {}", source);
    println!("Server: {}", server);
    println!("Format: {}", format);
    println!("Dry run: {}", dry_run);

    // Determine output path
    let output_path = output
        .cloned()
        .unwrap_or_else(|| PathBuf::from("./aether.config.ts"));

    println!("Output: {:?}", output_path);

    // Validate source
    match source {
        "local" | "remote" | "both" => {}
        _ => {
            return Err(anyhow::anyhow!(
                "Invalid source '{}'. Must be: local, remote, or both",
                source
            ));
        }
    }

    // Validate format
    match format {
        "ts" | "json" => {}
        _ => {
            return Err(anyhow::anyhow!(
                "Invalid format '{}'. Must be: ts or json",
                format
            ));
        }
    }

    // Generate configuration
    let config_content = generate_config_content(source, server, format).await?;

    if dry_run {
        println!("\n--- Generated Configuration (Preview) ---");
        println!("{}", config_content);
        println!("--- End Preview ---\n");
    } else {
        // Check if file exists
        if output_path.exists() && !overwrite {
            return Err(anyhow::anyhow!(
                "File {:?} already exists. Use --overwrite to replace.",
                output_path
            ));
        }

        // Write file
        tokio::fs::write(&output_path, &config_content).await?;
        println!("Configuration written to: {:?}", output_path);
    }

    Ok(())
}

#[allow(unused)]
async fn generate_config_content(
    source: &str,
    server: &str,
    format: &str,
) -> anyhow::Result<String> {
    // TODO: 实现真正的配置生成逻辑
    // 目前返回模板配置

    match format {
        "ts" => Ok(r#"// Auto-generated by Aether CLI
// Run: aether gen config --source remote --server localhost:7233

export default {
  name: 'my-workflow',
  services: {},
  scan: {
    workflows: './src/workflows/**/*.{ts,js}',
    steps: './src/steps/**/*.{ts,js}',
    activities: './src/activities/**/*.{ts,js}'
  }
} as const satisfies AetherConfig;
"#
        .to_string()),
        "json" => Ok(r#"{
  "name": "my-workflow",
  "services": {},
  "scan": {
    "workflows": "./src/workflows/**/*.{ts,js}",
    "steps": "./src/steps/**/*.{ts,js}",
    "activities": "./src/activities/**/*.{ts,js}"
  }
}
"#
        .to_string()),
        _ => Err(anyhow::anyhow!("Unknown format: {}", format)),
    }
}
