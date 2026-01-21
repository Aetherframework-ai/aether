//! Dashboard 静态资源嵌入
//!
//! 使用 rust-embed 在编译时将 dashboard/dist 目录嵌入到二进制文件中。
//! 在 release 模式下，资源被嵌入二进制；在 debug 模式下，从文件系统读取。

use rust_embed::Embed;

/// Dashboard 静态资源
///
/// 包含构建后的 Dashboard 前端文件（HTML、JS、CSS 等）
#[derive(Embed)]
#[folder = "../../dashboard/dist"]
#[prefix = ""]
pub struct DashboardAssets;

impl DashboardAssets {
    /// 获取文件内容，支持 SPA fallback
    ///
    /// 如果请求的路径不存在，返回 index.html（用于前端路由）
    pub fn get_or_index(path: &str) -> Option<rust_embed::EmbeddedFile> {
        Self::get(path).or_else(|| Self::get("index.html"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_index_html_exists() {
        assert!(DashboardAssets::get("index.html").is_some());
    }
}
