//! 模板渲染模块
//!
//! 支持从模板目录渲染项目文件，处理变量替换。

use anyhow::{Context, Result};
use std::path::{Path, PathBuf};
use std::str::FromStr;
use tokio::fs;

/// 支持的模板类型
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TemplateType {
    TypeScript,
    NestJS,
    Python,
}

impl FromStr for TemplateType {
    type Err = anyhow::Error;

    fn from_str(s: &str) -> Result<Self> {
        match s.to_lowercase().as_str() {
            "ts" | "typescript" => Ok(TemplateType::TypeScript),
            "nestjs" | "nest" => Ok(TemplateType::NestJS),
            "py" | "python" => Ok(TemplateType::Python),
            _ => Err(anyhow::anyhow!(
                "Unknown template type: {}. Supported types: ts, nestjs, python",
                s
            )),
        }
    }
}

impl TemplateType {
    /// 获取模板目录名称
    pub fn dir_name(&self) -> &'static str {
        match self {
            TemplateType::TypeScript => "typescript",
            TemplateType::NestJS => "nestjs",
            TemplateType::Python => "python",
        }
    }
}

/// 模板变量
#[derive(Debug, Clone)]
pub struct TemplateVariables {
    /// 项目名称
    pub project_name: String,
    /// 工作流名称（camelCase）
    pub workflow_name: String,
    /// 工作流名称（snake_case）
    pub workflow_name_snake: String,
    /// 输入类型
    pub input_type: String,
}

impl TemplateVariables {
    /// 从项目名称创建默认变量
    pub fn new(project_name: &str) -> Self {
        Self {
            project_name: project_name.to_string(),
            workflow_name: to_camel_case(project_name),
            workflow_name_snake: to_snake_case(project_name),
            input_type: format!("{}Input", to_pascal_case(project_name)),
        }
    }
}

/// 将字符串转换为 camelCase
fn to_camel_case(s: &str) -> String {
    let mut result = String::new();
    let mut next_upper = false;
    let mut is_first = true;

    for c in s.chars() {
        if c == '-' || c == '_' || c.is_whitespace() {
            next_upper = true;
        } else if next_upper {
            result.push(c.to_ascii_uppercase());
            next_upper = false;
        } else {
            if is_first {
                result.push(c.to_ascii_lowercase());
                is_first = false;
            } else {
                result.push(c);
            }
        }
    }
    result
}

/// 将字符串转换为 PascalCase
fn to_pascal_case(s: &str) -> String {
    let mut result = String::new();
    let mut capitalize = true;
    for c in s.chars() {
        if c == '-' || c == '_' || c.is_whitespace() {
            capitalize = true;
        } else if capitalize {
            result.push(c.to_ascii_uppercase());
            capitalize = false;
        } else {
            result.push(c.to_ascii_lowercase());
        }
    }
    result
}

/// 将字符串转换为 snake_case
fn to_snake_case(s: &str) -> String {
    let mut result = String::new();
    for c in s.chars() {
        if c.is_uppercase() {
            if !result.is_empty() {
                result.push('_');
            }
            result.push(c.to_ascii_lowercase());
        } else if c == '-' || c == '_' || c.is_whitespace() {
            result.push('_');
        } else {
            result.push(c);
        }
    }
    result
}

/// 渲染模板字符串，替换所有变量
pub fn render_template(content: &str, vars: &TemplateVariables) -> String {
    let mut result = content.to_string();

    // 替换项目名称
    result = result.replace("{{ project_name }}", &vars.project_name);

    // 替换工作流名称（camelCase）
    result = result.replace("{{ workflow_name }}", &vars.workflow_name);

    // 替换工作流名称（snake_case）
    result = result.replace("{{ workflow_name_snake }}", &vars.workflow_name_snake);

    // 替换输入类型
    result = result.replace("{{ input_type }}", &vars.input_type);

    result
}

/// 获取模板目录路径
pub fn get_template_dir(template_type: TemplateType, cli_root: &Path) -> PathBuf {
    cli_root.join("templates").join(template_type.dir_name())
}

/// 渲染模板目录中的所有文件
///
/// # Arguments
///
/// * `template_type` - 模板类型
/// * `cli_root` - CLI 根目录
/// * `output_dir` - 输出目录
/// * `vars` - 模板变量
pub async fn render_template_dir(
    template_type: TemplateType,
    cli_root: &Path,
    output_dir: &Path,
    vars: &TemplateVariables,
) -> Result<()> {
    let template_dir = get_template_dir(template_type, cli_root);

    if !template_dir.exists() {
        return Err(anyhow::anyhow!(
            "Template directory not found: {:?}",
            template_dir
        ));
    }

    // 遍历模板目录
    render_directory(&template_dir, output_dir, vars).await?;

    Ok(())
}

/// 递归渲染目录
async fn render_directory(src: &Path, dst: &Path, vars: &TemplateVariables) -> Result<()> {
    if src.is_dir() {
        // 创建目标目录
        fs::create_dir_all(dst).await?;

        // 遍历源目录中的所有条目
        let mut entries = fs::read_dir(src).await?;
        while let Some(entry) = entries.next_entry().await? {
            let src_path = entry.path();
            let file_name = entry.file_name();
            let dst_path = dst.join(&file_name);

            if src_path.is_dir() {
                // 递归处理子目录，使用 Box::pin 来避免无限大的 future
                Box::pin(render_directory(&src_path, &dst_path, vars)).await?;
            } else {
                // 处理文件
                render_file(&src_path, &dst_path, vars).await?;
            }
        }
    }
    Ok(())
}

/// 渲染单个文件
async fn render_file(src: &Path, dst: &Path, vars: &TemplateVariables) -> Result<()> {
    // 读取源文件内容
    let content = fs::read_to_string(src)
        .await
        .with_context(|| format!("Failed to read template file: {:?}", src))?;

    // 渲染模板
    let rendered = render_template(&content, vars);

    // 写入目标文件
    fs::write(dst, rendered)
        .await
        .with_context(|| format!("Failed to write rendered file: {:?}", dst))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_to_camel_case() {
        assert_eq!(to_camel_case("hello-world"), "helloWorld");
        assert_eq!(to_camel_case("hello_world"), "helloWorld");
        assert_eq!(to_camel_case("HelloWorld"), "helloWorld");
        assert_eq!(to_camel_case("my-project-name"), "myProjectName");
    }

    #[test]
    fn test_to_pascal_case() {
        assert_eq!(to_pascal_case("hello-world"), "HelloWorld");
        assert_eq!(to_pascal_case("hello_world"), "HelloWorld");
        assert_eq!(to_pascal_case("my-project-name"), "MyProjectName");
    }

    #[test]
    fn test_to_snake_case() {
        assert_eq!(to_snake_case("helloWorld"), "hello_world");
        assert_eq!(to_snake_case("HelloWorld"), "hello_world");
        assert_eq!(to_snake_case("myProjectName"), "my_project_name");
    }

    #[test]
    fn test_template_variables() {
        let vars = TemplateVariables::new("my-awesome-project");

        assert_eq!(vars.project_name, "my-awesome-project");
        assert_eq!(vars.workflow_name, "myAwesomeProject");
        assert_eq!(vars.workflow_name_snake, "my_awesome_project");
        assert_eq!(vars.input_type, "MyAwesomeProjectInput");
    }

    #[test]
    fn test_render_template() {
        let vars = TemplateVariables::new("my-project");

        let content = r#"
name: {{ project_name }}
workflow: {{ workflow_name }}
snake: {{ workflow_name_snake }}
input: {{ input_type }}
"#;

        let rendered = render_template(content, &vars);

        assert!(rendered.contains("name: my-project"));
        assert!(rendered.contains("workflow: myProject"));
        assert!(rendered.contains("snake: my_project"));
        assert!(rendered.contains("input: MyProjectInput"));
    }

    #[test]
    fn test_template_type_from_str() {
        assert_eq!(
            TemplateType::from_str("ts").unwrap(),
            TemplateType::TypeScript
        );
        assert_eq!(
            TemplateType::from_str("typescript").unwrap(),
            TemplateType::TypeScript
        );
        assert_eq!(
            TemplateType::from_str("nestjs").unwrap(),
            TemplateType::NestJS
        );
        assert_eq!(
            TemplateType::from_str("python").unwrap(),
            TemplateType::Python
        );
        assert!(TemplateType::from_str("unknown").is_err());
    }
}
