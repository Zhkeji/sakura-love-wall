# 🌸 樱花表白墙 - Sakura Love Wall

全新液态毛玻璃设计的表白墙系统，包含网站端和 Android 原生 App。

## ✨ 功能特性

### 🌐 网站端
- 💕 表白发布（文字/标签/分类/匿名）
- 👍 点赞 & 评论
- 🔍 搜索功能
- 💬 实时私信聊天
- 📱 响应式设计（手机/平板/电脑）
- 🌸 樱花飘落动画 + 毛玻璃UI

### 👑 超级管理员后台 (`/admin/super/`)
- 📊 仪表盘（用户/帖子/评论/待审核统计）
- 💕 帖子管理（审核/隐藏/删除）
- 👥 用户管理（封禁/解封/设为管理/删除）
- 💬 评论管理
- 🚩 举报处理
- ⚙️ 网站设置（名称/注册开关/审核开关等）
- 🔧 维护系统（自定义维护页面）
- 🛡️ 管理员管理（添加/删除管理员）

### 🔧 管理员后台 (`/admin/admin/`)
- 📊 工作台（帖子/评论/待审核统计）
- 💕 帖子管理（审核/隐藏/删除）
- 💬 评论管理
- 🚩 举报处理

### 📱 Android App
- 用户端：登录/注册/浏览/发布/点赞/评论/私信
- 管理员端：帖子管理（审核/隐藏/删除）
- 超管端：用户管理/管理员管理
- 检查更新 & 版本管理

---

## 🚀 部署指南

### 环境要求
- **Node.js** 16+（推荐 18+）
- **npm**

### 1. 安装依赖
```bash
cd love-wall-website
npm install
```

### 2. 启动服务
```bash
npm start
```

### 3. 访问
| 页面 | 地址 |
|------|------|
| 前台 | http://localhost:3000 |
| 管理入口 | http://localhost:3000/admin |
| 超管后台 | http://localhost:3000/admin/super/ |
| 管理员后台 | http://localhost:3000/admin/admin/ |

### 4. 默认账号
| 角色 | 用户名 | 密码 |
|------|--------|------|
| 超级管理员 | admin | admin123 |

⚠️ **首次部署后请立即修改默认密码！**

---

## 🌍 生产部署

### 使用 PM2
```bash
npm install -g pm2
cd love-wall-website
pm2 start server/app.js --name sakura-love-wall
pm2 startup
pm2 save
```

### Nginx 反向代理
```nginx
server {
    listen 80;
    server_name your-domain.com;
    client_max_body_size 20M;

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
        proxy_pass http://127.0.0.1:3000;
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

---

## 📱 Android App 构建

### 修改服务器地址
打开 `app/src/main/java/com/lovewall/app/api/ApiClient.java`：
```java
public static final String BASE_URL = "https://your-domain.com";
```

### 使用 AIDE Pro
1. 安装 AIDE Pro
2. 复制 `love-wall-app` 到手机
3. 打开项目 → 运行构建

### 使用 Android Studio
1. 打开项目
2. Gradle 同步
3. Build → Build APK

### 版本更新
修改 `app/build.gradle` 中的版本号：
```
versionCode 2
versionName "2.0.0"
```

更新服务器端 `public/api/app/version.json`。

---

## 📁 项目结构

```
love-wall-website/
├── server/                 # 后端
│   ├── app.js             # 主入口
│   ├── database.js        # 数据库
│   ├── settings.js        # 设置管理
│   ├── socket.js          # Socket.IO
│   ├── middleware/auth.js  # 认证中间件
│   └── routes/            # API 路由
├── public/                # 前端
│   ├── index.html         # 主页（樱花UI）
│   ├── img/               # 图片资源
│   └── uploads/           # 上传文件
├── admin/                 # 管理后台
│   ├── index.html         # 入口选择页
│   ├── super/index.html   # 超管后台
│   └── admin/index.html   # 管理员后台
├── views/
│   ├── chat.html          # 私信页面
│   └── maintenance.html   # 维护页面
└── data/                  # 数据库文件

love-wall-app/             # Android App
├── app/src/main/
│   ├── java/com/lovewall/app/
│   │   ├── activity/      # 页面
│   │   ├── adapter/       # 适配器
│   │   ├── model/         # 数据模型
│   │   ├── api/           # API客户端
│   │   └── utils/         # 工具类
│   └── res/               # 资源文件
```

---

## ⚠️ 安全建议

1. 修改默认管理员密码
2. 生产环境使用 HTTPS
3. 定期备份 `data/love-wall.db`
4. 已内置 API 速率限制

---

## 📄 License

MIT License
