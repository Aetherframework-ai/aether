# Release Checklist

## Pre-Release

- [ ] 所有 CI 测试通过
- [ ] 代码已合并到 main 分支
- [ ] CHANGELOG 已更新
- [ ] 版本号已确认

## Release Steps

1. **合并到 main 触发自动发布**
   - GitHub Actions 将自动:
     - 计算版本号
     - 更新所有 Cargo.toml 和 package.json
     - 发布到 Cargo、NPM、PyPI
     - 创建 GitHub Release

2. **验证发布**
   - [ ] 检查 crates.io 新版本已发布
   - [ ] 检查 npmjs.com 新版本已发布
   - [ ] 检查 pypi.org 新版本已发布
   - [ ] GitHub Release 已创建

## 回滚

如果需要回滚:

```bash
# 撤销版本更新
git revert <commit-hash>
git push origin main

# 从注册表删除已发布的包 (谨慎使用)
# Cargo: 无法删除已发布的版本
# NPM: npm unpublish @aether/sdk@<version>
# PyPI: 无法删除已发布的版本
```

## Version Strategy

| 分支 | 触发条件 | 版本号示例 |
|------|----------|------------|
| main merge | patch 版本 | 0.1.0 → 0.1.1 |
| release/* | release 分支 | 0.2.0-rc.1 |
| hotfix/* | 紧急修复 | 0.1.2 |
| feature/* | 功能开发 | 0.2.0-alpha.1 |

## Required Secrets

在 GitHub Repository Settings 中添加:

| Secret Name | 说明 |
|-------------|------|
| `CRATES_IO_TOKEN` | crates.io API token |
| `NPM_TOKEN` | npmjs.com API token |
| `PYPI_API_TOKEN` | PyPI API token |
