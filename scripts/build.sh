#!/bin/bash
set -e

echo "Building Aether Framework..."

# 构建 Rust 核心
echo "Building Rust core..."
cargo build --release

# 构建 CLI
echo "Building CLI..."
cargo build --release --package aether-cli

# 构建 TypeScript SDK
echo "Building TypeScript SDK..."
cd sdks/typescript
npm install
npm run build
cd ../..

# 构建 Dashboard
echo "Building Dashboard..."
cd dashboard
npm install
npm run build
cd ..

echo "Build completed successfully!"
echo "Executables:"
echo "  - target/release/aether (server)"
echo "  - target/release/aether-cli (CLI)"
echo "TypeScript SDK: sdks/typescript/dist/"
echo "Dashboard: dashboard/dist/"
