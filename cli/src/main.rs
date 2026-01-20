use clap::{Parser, Subcommand};
use std::path::PathBuf;

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
    Status {
        workflow_id: String,
    },
    /// Cancel a workflow
    Cancel {
        workflow_id: String,
    },
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
        Commands::Serve { db, grpc_port, http_port, persistence } => {
            serve_command(db, grpc_port, http_port, persistence).await
        }
        Commands::Init { name, output } => {
            init_command(name, output).await
        }
        Commands::Gen { action } => {
            gen_command(action).await
        }
        Commands::Workflow { action } => {
            workflow_command(action).await
        }
        Commands::Status { workflow_id } => {
            status_command(workflow_id).await
        }
        Commands::Cancel { workflow_id } => {
            cancel_command(workflow_id).await
        }
    }
}

async fn serve_command(
    db: PathBuf,
    grpc_port: u16,
    http_port: u16,
    persistence: String,
) -> anyhow::Result<()> {
    println!("Starting Aether server...");
    println!("Database: {:?}", db);
    println!("gRPC Port: {}", grpc_port);
    println!("HTTP Port: {}", http_port);
    println!("Persistence: {}", persistence);

    // TODO: 实现服务器启动逻辑
    println!("Server started successfully!");

    Ok(())
}

async fn init_command(name: String, output: PathBuf) -> anyhow::Result<()> {
    println!("Initializing Aether project: {}", name);

    // 创建项目模板
    let project_dir = output.join(&name);
    tokio::fs::create_dir_all(&project_dir).await?;

    // 生成基本文件
    let workflow_content = r#"
import { aether } from '@aether/sdk';

const processOrder = aether.workflow('process-order', async (ctx, orderId) => {
  const order = await ctx.step('fetch', () => console.log('Fetching order', orderId));
  await ctx.step('charge', () => console.log('Charging order', order.amount));
  return { success: true };
});

export { processOrder };
"#;

    let package_json = format!(r#"{{
  "name": "{}",
  "version": "0.1.0",
  "scripts": {{
    "dev": "aether serve",
    "start": "node dist/index.js"
  }},
  "dependencies": {{
    "@aether/sdk": "^0.1.0"
  }}
}}"#, name);

    tokio::fs::write(project_dir.join("workflow.ts"), workflow_content).await?;
    tokio::fs::write(project_dir.join("package.json"), package_json).await?;

    println!("Project created at: {:?}", project_dir);
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
        GenAction::Config { config_source, server, output, format, overwrite, dry_run } => {
            let output_ref = output.as_ref().map(|p| p as &PathBuf);
            config_gen_command(&config_source, &server, output_ref, &format, overwrite, dry_run).await
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
    let output_path = output.cloned()
        .unwrap_or_else(|| PathBuf::from("./aether.config.ts"));

    println!("Output: {:?}", output_path);

    // Validate source
    match source {
        "local" | "remote" | "both" => {}
        _ => {
            return Err(anyhow::anyhow!(
                "Invalid source '{}'. Must be: local, remote, or both", source
            ));
        }
    }

    // Validate format
    match format {
        "ts" | "json" => {}
        _ => {
            return Err(anyhow::anyhow!(
                "Invalid format '{}'. Must be: ts or json", format
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

async fn generate_config_content(source: &str, server: &str, format: &str) -> anyhow::Result<String> {
    // TODO: 实现真正的配置生成逻辑
    // 目前返回模板配置
    
    match format {
        "ts" => {
            Ok(r#"// Auto-generated by Aether CLI
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
"#.to_string())
        }
        "json" => {
            Ok(r#"{
  "name": "my-workflow",
  "services": {},
  "scan": {
    "workflows": "./src/workflows/**/*.{ts,js}",
    "steps": "./src/steps/**/*.{ts,js}",
    "activities": "./src/activities/**/*.{ts,js}"
  }
}
"#.to_string())
        }
        _ => Err(anyhow::anyhow!("Unknown format: {}", format)),
    }
}
