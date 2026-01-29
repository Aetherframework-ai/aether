use std::path::Path;
use std::process::Command;

fn main() {
    // Dashboard 构建（仅在启用 dashboard feature 时）
    #[cfg(feature = "dashboard")]
    build_dashboard();
}

#[cfg(feature = "dashboard")]
fn build_dashboard() {
    let dashboard_dir = Path::new("../../dashboard");
    let dist_dir = dashboard_dir.join("dist");
    let src_dir = dashboard_dir.join("src");
    let package_json = dashboard_dir.join("package.json");

    // 设置 cargo 重新运行条件
    if src_dir.exists() {
        println!("cargo:rerun-if-changed=../../dashboard/src");
    }
    if package_json.exists() {
        println!("cargo:rerun-if-changed=../../dashboard/package.json");
    }

    // 检查 dashboard 目录是否存在
    if !dashboard_dir.exists() {
        println!("cargo:warning=Dashboard directory not found, skipping dashboard build");
        return;
    }

    // 检查是否需要构建
    let needs_build = !dist_dir.exists() || !dist_dir.join("index.html").exists();

    if needs_build {
        println!("cargo:warning=Building Dashboard...");

        // 检查 node_modules 是否存在，如果不存在则运行 npm install
        let node_modules = dashboard_dir.join("node_modules");
        if !node_modules.exists() {
            println!("cargo:warning=Installing Dashboard dependencies...");
            let status = Command::new("npm")
                .args(["install"])
                .current_dir(dashboard_dir)
                .status();

            match status {
                Ok(s) if s.success() => {
                    println!("cargo:warning=Dashboard dependencies installed successfully");
                }
                Ok(s) => {
                    println!(
                        "cargo:warning=npm install failed with exit code: {:?}",
                        s.code()
                    );
                    return;
                }
                Err(e) => {
                    println!("cargo:warning=Failed to run npm install: {}", e);
                    println!("cargo:warning=Make sure Node.js is installed");
                    return;
                }
            }
        }

        // 运行 npm run build
        println!("cargo:warning=Running npm run build...");
        let status = Command::new("npm")
            .args(["run", "build"])
            .current_dir(dashboard_dir)
            .status();

        match status {
            Ok(s) if s.success() => {
                println!("cargo:warning=Dashboard built successfully");
            }
            Ok(s) => {
                println!(
                    "cargo:warning=npm run build failed with exit code: {:?}",
                    s.code()
                );
            }
            Err(e) => {
                println!("cargo:warning=Failed to run npm run build: {}", e);
                println!("cargo:warning=Make sure Node.js is installed");
            }
        }
    }
}
