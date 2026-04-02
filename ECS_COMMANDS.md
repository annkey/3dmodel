# ECS 上线命令清单

以下命令在阿里云 ECS Linux 服务器中执行。

## 1. 安装基础工具

Alibaba Cloud Linux / CentOS：

```bash
yum install -y git
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker
docker --version
```

Ubuntu：

```bash
apt-get update
apt-get install -y git
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker
docker --version
```

## 2. 拉取代码

```bash
git clone 你的仓库地址 aigc-3d-platform
cd aigc-3d-platform
```

## 3. 创建环境变量文件

```bash
cat > .env.local <<'EOF'
TRIPO_API_KEY=你的新Tripo密钥
MESHY_API_KEY=你的新Meshy密钥
PORT=3000
EOF
```

## 4. 构建镜像

```bash
docker build -t aigc-3d-platform .
```

## 5. 启动容器

```bash
docker run -d \
  --name aigc-3d-platform \
  --restart unless-stopped \
  -p 80:3000 \
  --env-file .env.local \
  aigc-3d-platform
```

## 6. 检查服务

```bash
docker ps
docker logs --tail 100 aigc-3d-platform
curl http://127.0.0.1/healthz
```

## 7. 外网访问

```text
http://你的ECS公网IP
http://你的ECS公网IP/model-preview.html
```

## 8. 更新发布

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

## 9. 常用排查

查看容器日志：

```bash
docker logs -f aigc-3d-platform
```

如果 80 端口访问不通，优先检查：
- 阿里云安全组是否开放 80
- ECS 是否有公网 IP 或 EIP
- 容器是否正常运行
- `curl http://127.0.0.1/healthz` 是否返回正常
