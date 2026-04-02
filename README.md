# 3D AIGC Platform

一个基于原生 Node.js 的 3D AIGC 小工具，支持：
- Tripo3D 文本生成 3D 模型
- Tripo3D 图片生成 3D 模型
- Meshy 文本生成 3D 模型
- Meshy 图片生成 3D 模型
- 本地 3D 模型网页预览

## 本地启动

```powershell
npm start
```

默认地址：
- http://localhost:3000
- http://localhost:3000/model-preview.html

## 必填环境变量

```env
TRIPO_API_KEY=tsk_xxx
MESHY_API_KEY=msy_xxx
PORT=3000
```

本地开发可以放到 `.env.local`。
部署到云平台时，请在平台面板中配置环境变量，不要把真实密钥提交到仓库。

## 外网部署

### 方案一：Railway

适合直接把项目发布成公网网站。

1. 把代码推到 GitHub。
2. 在 Railway 创建一个新的 Web Service。
3. 连接这个仓库。
4. 如果平台检测到 Dockerfile，会直接按 Dockerfile 构建。
5. 在 Railway 的 Variables 中配置：
   - `TRIPO_API_KEY`
   - `MESHY_API_KEY`
   - `PORT=3000`
6. 部署完成后，Railway 会分配一个公网域名。

也可以使用 Railway CLI：

```powershell
railway up
```

### 方案二：任意支持 Docker 的云主机

项目已包含 Dockerfile，可直接构建：

```powershell
docker build -t aigc-3d-platform .
docker run -p 3000:3000 -e TRIPO_API_KEY=tsk_xxx -e MESHY_API_KEY=msy_xxx aigc-3d-platform
```

然后将 `3000` 端口通过云服务器安全组或反向代理暴露到外网。

## 健康检查

部署后可用以下地址检查服务是否在线：

```text
/healthz
```

返回示例：

```json
{
  "ok": true
}
```
