# 阿里云 ECS 部署指南

本文针对当前项目：
- 原生 Node.js HTTP Server
- 前端静态页面
- Tripo3D + Meshy 双平台接入
- 已提供 Dockerfile，可直接容器化部署

## 推荐方案

建议优先使用：
- 阿里云 ECS
- Docker 部署
- 先用公网 IP 或 EIP 跑通
- 域名和 HTTPS 放到第二步

这是当前最简单、最稳妥的外网发布方式。

## 第一步：准备 ECS

建议配置：
- 操作系统：Alibaba Cloud Linux / Ubuntu 22.04
- CPU / 内存：2 核 2G 起
- 磁盘：40G 起
- 网络：分配公网 IP，或者后续绑定 EIP

官方参考：
- ECS 产品页：https://www.aliyun.com/product/ecs
- EIP 绑定说明：https://help.aliyun.com/zh/eip/associate-an-eip-with-an-ecs-instance

如果实例没有公网 IP，可以绑定 EIP 后再对外访问。

## 第二步：配置安全组

至少开放这些端口：
- `22`：SSH 登录
- `80`：网站访问
- `443`：后续 HTTPS

如果你想先临时直连应用端口调试，也可以临时开放：
- `3000`

官方参考：
- 安全组相关说明：https://help.aliyun.com
  说明：阿里云安全组是 ECS 对外放行端口的关键设置。

建议：
- 正式环境优先开放 `80/443`
- `3000` 只用于临时调试，调通后可关闭

## 第三步：连接服务器

本地执行：

```powershell
ssh root@你的ECS公网IP
```

如果你使用的是自定义用户名，请替换为对应账号。

## 第四步：安装 Docker

进入 ECS 后执行：

```bash
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker
docker --version
```

如果系统里已经安装 Docker，可以跳过。

## 第五步：上传代码

推荐方式：直接在 ECS 上拉取代码仓库。

```bash
git clone 你的仓库地址 aigc-3d-platform
cd aigc-3d-platform
```

如果服务器没有 git，可先安装：

```bash
yum install -y git
```

或 Ubuntu：

```bash
apt-get update
apt-get install -y git
```

## 第六步：配置环境变量

不要把真实密钥提交到仓库。

在服务器项目目录下创建 `.env.local`：

```bash
cat > .env.local <<'EOF'
TRIPO_API_KEY=你的新Tripo密钥
MESHY_API_KEY=你的新Meshy密钥
PORT=3000
EOF
```

说明：
- 建议使用新密钥，不要继续用你在聊天里发过的旧密钥
- 你之前泄露过真实密钥，正式上线前最好先轮换

## 第七步：构建镜像

在项目目录执行：

```bash
docker build -t aigc-3d-platform .
```

## 第八步：启动服务

建议直接把容器映射到 ECS 的 `80` 端口：

```bash
docker run -d \
  --name aigc-3d-platform \
  --restart unless-stopped \
  -p 80:3000 \
  --env-file .env.local \
  aigc-3d-platform
```

如果要先调试，也可以先跑：

```bash
docker run -d \
  --name aigc-3d-platform \
  --restart unless-stopped \
  -p 3000:3000 \
  --env-file .env.local \
  aigc-3d-platform
```

## 第九步：检查服务

服务器本机检查：

```bash
curl http://127.0.0.1/healthz
```

预期返回：

```json
{
  "ok": true
}
```

如果容器映射的是 `80` 端口，公网访问：

```text
http://你的ECS公网IP
```

模型预览页：

```text
http://你的ECS公网IP/model-preview.html
```

## 第十步：常用运维命令

查看容器：

```bash
docker ps
```

查看日志：

```bash
docker logs -f aigc-3d-platform
```

重启服务：

```bash
docker restart aigc-3d-platform
```

停止并删除旧容器：

```bash
docker stop aigc-3d-platform
docker rm aigc-3d-platform
```

更新代码后的发布方式：

```bash
cd aigc-3d-platform
git pull
docker build -t aigc-3d-platform .
docker stop aigc-3d-platform
docker rm aigc-3d-platform
docker run -d \
  --name aigc-3d-platform \
  --restart unless-stopped \
  -p 80:3000 \
  --env-file .env.local \
  aigc-3d-platform
```

## 域名与备案

如果你准备把域名解析到中国内地的阿里云 ECS，通常需要完成 ICP 备案。

阿里云官方说明：
- 什么是ICP备案：https://help.aliyun.com/zh/icp-filing/basic-icp-service/product-overview/what-is-an-icp-filing
- 备案流程概述：https://help.aliyun.com/zh/icp-filing/user-guide/using-icp-registration-guide-ali-cloud-app
- 备案资料要求：https://help.aliyun.com/zh/icp-filing/basic-icp-service/user-guide/required-materials

关键点：
- 如果使用阿里云中国内地服务器并绑定域名对外提供网站服务，通常需要备案
- 如果使用中国香港或海外节点服务器，通常不需要备案

如果你现在只是先用公网 IP 测试访问，可以先不配域名。

## HTTPS 建议

当前最快上线方式是先用 HTTP 跑通。

后续如果你要正式上线，建议再补：
- Nginx
- SSL 证书
- 80 自动跳转 443
- 域名解析

## 当前项目建议的最短上线路径

1. 买一台阿里云 ECS
2. 配公网 IP 或 EIP
3. 安全组开放 `22` 和 `80`
4. 安装 Docker
5. 拉取你的代码仓库
6. 在服务器创建 `.env.local`
7. `docker build`
8. `docker run -p 80:3000`
9. 通过公网 IP 访问首页

## 当前项目入口

- 首页：`/`
- 3D 预览页：`/model-preview.html`
- 健康检查：`/healthz`
