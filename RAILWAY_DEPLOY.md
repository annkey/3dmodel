# Railway 部署指南

当前项目已经适配 Railway 部署：
- 已提供 `Dockerfile`
- 服务监听 `PORT`
- 已提供健康检查接口 `/healthz`
- 已提供 `railway.json` 作为 Config as Code

## 一键部署思路

最省事的方式：
1. 登录 Railway
2. New Project
3. 选择 `Deploy from GitHub repo`
4. 选择仓库：`annkey/aigc`
5. Railway 会读取仓库并自动部署

## 需要配置的环境变量

在 Railway 的 Variables 中添加：

```env
TRIPO_API_KEY=你的新Tripo密钥
MESHY_API_KEY=你的新Meshy密钥
DEFAULT_ADMIN_PASSWORD=你的临时管理员初始密码
```

说明：
- `PORT` 不需要手动填，Railway 会自动注入
- 推荐在 Railway 项目里添加 PostgreSQL 服务，Railway 会自动注入 `DATABASE_URL`
- 如果使用外部 PostgreSQL 且要求 SSL，可添加 `DATABASE_SSL=require`
- 不要继续使用已经在聊天中暴露过的旧密钥，建议先轮换

## 数据库持久化

当前服务检测到 `DATABASE_URL` 后，会自动创建 `app_runtime_stores` 表，并把这些运行时数据写入 PostgreSQL：

- 管理后台用户：`admin-users.json`
- 登录会话：`auth-sessions.json`
- 积分：`user-credits.json`
- 模型索引：`user-models.json`
- 公共生成配置：`generator-settings.json`

没有 `DATABASE_URL` 时，本地开发仍会继续使用 JSON 文件。线上 Railway 推荐添加 PostgreSQL 服务，避免每次重新部署后用户和积分数据丢失。

## 部署后检查

部署成功后，Railway 会给你一个公网域名。

可检查：
- `/`
- `/model-preview.html`
- `/model-setting.html`
- `/healthz`

示例：

```text
https://你的railway域名/
https://你的railway域名/model-preview.html
https://你的railway域名/model-setting.html
https://你的railway域名/healthz
```

## 为什么这个项目可以直接上 Railway

根据 Railway 官方文档：
- 如果仓库里有 `Dockerfile`，Railway 会按 Dockerfile 构建
- Railway 会自动注入 `PORT`
- 可以通过 `railway.json` 指定健康检查和部署行为
- GitHub 连接后支持自动部署

官方参考：
- Config as Code: https://docs.railway.com/config-as-code
- Config Reference: https://docs.railway.com/reference/config-as-code
- Healthchecks: https://docs.railway.com/reference/healthchecks
- GitHub 自动部署: https://docs.railway.com/deployments/github-autodeploys
- CLI 上传部署: https://docs.railway.com/cli/deploying

## 你在 Railway 面板里实际要做的事

1. 连接 GitHub 账号
2. 选择仓库 `annkey/aigc`
3. 添加两个变量：
   - `TRIPO_API_KEY`
   - `MESHY_API_KEY`
4. 等待构建完成
5. 打开生成的公网域名

## 可选的 CLI 部署

如果你后面想用 Railway CLI，也可以：

```powershell
railway login
railway up
```

但对你现在这个项目，直接从 GitHub 部署通常更省事。
