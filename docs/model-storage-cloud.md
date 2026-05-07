# 3D 模型文件存储配置流程

## 当前实现

- 用户在 `model-work.html` 上传自己的 3D 模型文件。
- 服务端保存到 `storage/user-models/{userId}/{modelId}/`。
- 元数据保存到 `user-models.json`。
- 每个用户默认 10GB 存储空间，可在管理后台的用户编辑弹窗中配置“3D模型空间（GB）”。
- 超额时接口会返回明确提示：请先手动删除自己的 3D 模型文件后再上传。

## 服务器本地磁盘配置

1. 在服务器项目目录创建持久化目录：
   ```bash
   mkdir -p storage/user-models
   ```
2. 确保 Node 进程有读写权限：
   ```bash
   chown -R node:node storage
   chmod -R 750 storage
   ```
3. 部署时保留这些文件：
   - `storage/user-models/`
   - `user-models.json`
   - `admin-users.json`
   - `user-credits.json`
   - `generator-settings.json`
4. 如果使用 Docker，挂载持久化卷：
   ```bash
   docker run -v /data/kmax/storage:/app/storage -v /data/kmax/user-models.json:/app/user-models.json ...
   ```

## 阿里云 OSS 推荐流程

当前代码默认落本地盘。若要切到 OSS，推荐让业务接口仍走后端鉴权，再由后端上传/读取 OSS，避免前端暴露密钥。

1. 创建 OSS Bucket：
   - 区域选择靠近 ECS 的地域。
   - 读写权限选择“私有”。
   - 开启服务端加密。
2. 创建 RAM 用户或 RAM 角色：
   - 授权最小权限：目标 Bucket 的 `PutObject`、`GetObject`、`DeleteObject`、`ListObjects`。
   - ECS 推荐绑定 RAM Role，不把 AccessKey 写入代码。
3. 配置环境变量：
   ```bash
   MODEL_STORAGE_DRIVER=oss
   ALIYUN_OSS_REGION=oss-cn-hangzhou
   ALIYUN_OSS_BUCKET=your-bucket
   ALIYUN_OSS_PREFIX=user-models
   ```
4. 后端改造点：
   - 上传接口将文件流写入 OSS Object：`user-models/{userId}/{modelId}/{fileName}`。
   - 删除模型时调用 OSS DeleteObject。
   - 预览文件接口由后端生成短期签名 URL，或由后端代理读取 OSS 后返回。
   - `user-models.json` 可继续本地保存，也可迁移到数据库。
5. 生产建议：
   - Bucket 禁止公共读。
   - 开启生命周期规则，按需清理已删除/临时对象。
   - 配合 CDN 时使用私有 Bucket + 签名 URL。

## 腾讯云 COS 推荐流程

1. 创建 COS Bucket：
   - 访问权限选择“私有读写”。
   - 区域选择靠近 CVM 的地域。
2. 创建 CAM 子账号或角色：
   - 授权目标 Bucket 的 `PutObject`、`GetObject`、`DeleteObject`、`HeadObject`。
   - CVM 推荐绑定角色。
3. 配置环境变量：
   ```bash
   MODEL_STORAGE_DRIVER=cos
   TENCENT_COS_REGION=ap-guangzhou
   TENCENT_COS_BUCKET=your-bucket-1250000000
   TENCENT_COS_PREFIX=user-models
   ```
4. 后端改造点：
   - 上传文件流写入 COS Key：`user-models/{userId}/{modelId}/{fileName}`。
   - 删除模型时删除对应前缀下对象。
   - 预览接口返回后端代理内容或短期签名 URL。
5. 生产建议：
   - 禁止把 SecretId/SecretKey 下发到前端。
   - 使用临时密钥或 CVM 角色。
   - 配置 CORS 时只允许你的业务域名和必要方法。

## 容量与备份建议

- 10GB 是应用层配额，服务器磁盘或对象存储还需要单独监控总容量。
- 推荐至少监控：
  - `storage/user-models` 实际占用。
  - `user-models.json` 是否可写。
  - 上传接口 4xx/5xx 数量。
- 本地磁盘模式建议每日备份 `storage/` 和 `user-models.json`。
