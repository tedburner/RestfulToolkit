# 发布流程

`.github/workflows/publish.yml` 使用 GitHub Actions 和 Marketplace Trusted Publishing 发布稳定版。

## 一次性配置

在 [Marketplace 发布者管理页](https://marketplace.visualstudio.com/manage/publishers/kiturone) 的 Trusted Publishing 中创建策略：仓库所有者 `tedburner`，仓库 `RestfulToolkit`，工作流文件 `publish.yml`，不设置 Environment。策略允许这个工作流代表 `kiturone` 发布扩展，需使用具备发布者管理权限的账户配置。工作流使用 OIDC，不需要 `VSCE_PAT`。

## 发布新版本

1. 更新 `package.json`、`package-lock.json` 的版本，整理 `CHANGELOG.md`，同步 README 版本徽章及文档版本引用并提交。
2. 在 GitHub Actions 手动运行 **Publish VS Code extension**，检查测试和 VSIX 产物；手动运行不会发布。
3. 为已提交版本创建并推送稳定版 tag，例如 `git tag v0.0.10`、`git push origin v0.0.10`。tag 必须严格等于 `v` 加 `package.json` 的三段版本号。
4. 工作流通过测试后打包一次，将相同 VSIX 发布到 Marketplace，再创建 GitHub Release 并附加该文件。检查 Actions、[Marketplace](https://marketplace.visualstudio.com/items?itemName=kiturone.restful-toolkit) 和 GitHub Release 的结果。

推送 tag 会触发实际发布，只对准备公开的提交创建 tag。若 Marketplace 已成功而 GitHub Release 步骤失败，应从该次 Actions 的 `extension-vsix` 产物手动补建 Release 和上传附件；不要重新推送版本或假定 Marketplace 发布可以回滚。若 Marketplace 发布结果不确定，先检查 Marketplace 版本，再决定如何处理。
