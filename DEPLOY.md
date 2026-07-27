# 🚀 部署指南

## 一、本地运行

### 1. 安装 Node.js（如果没有）
- Windows: https://nodejs.org 下载安装
- Mac: `brew install node`
- Linux: `sudo apt install nodejs npm`

### 2. 安装依赖并启动
```bash
cd love-wall-website
npm install
npm start
```

### 3. 访问
- 前台: http://localhost:3000
- 超管后台: http://localhost:3000/admin/super/
- 管理员后台: http://localhost:3000/admin/admin/
- 账号: admin / admin123

---

## 二、内网穿透（选一个）

### 方案1: ngrok（推荐，最简单）
```bash
# 安装
npm install -g ngrok
# 或下载: https://ngrok.com/download

# 注册免费账号获取token: https://dashboard.ngrok.com/get-started
ngrok config add-authtoken YOUR_TOKEN

# 启动穿透
ngrok http 3000
```
会给你一个 `https://xxx.ngrok.io` 的公网地址。

### 方案2: frp（自建服务器）
需要一台有公网IP的服务器。

**服务端（公网服务器）frps.toml:**
```toml
bindPort = 7000
```

**客户端（你的电脑）frpc.toml:**
```toml
serverAddr = "你的服务器IP"
serverPort = 7000

[[proxies]]
name = "web"
type = "http"
localPort = 3000
customDomains = ["你的域名"]
```

### 方案3: Cloudflare Tunnel（免费，推荐）
```bash
# 安装 cloudflared
# https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/

# 登录
cloudflared tunnel login

# 创建隧道
cloudflared tunnel create sakura-love-wall

# 配置路由
cloudflared tunnel route dns sakura-love-wall your-domain.com

# 运行
cloudflared tunnel run sakura-love-wall
```

### 方案4: cpolar（国内可用）
```bash
# 安装: https://www.cpolar.com/
# 注册获取authtoken

cpolar authtoken YOUR_TOKEN
cpolar http 3000
```

### 方案5: localhost.run（最简单，无需安装）
```bash
ssh -R 80:localhost:3000 nokey@localhost.run
```

---

## 三、生产环境建议

### 使用 PM2 保持运行
```bash
npm install -g pm2
pm2 start server/app.js --name sakura-love-wall
pm2 startup
pm2 save
```

### 使用 Nginx 反向代理（如有域名）
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
    }
}
```

### 启用 HTTPS
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```
