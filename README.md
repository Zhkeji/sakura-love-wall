# 🌸 樱花表白墙 - Sakura Love Wall

全新液态毛玻璃设计的表白墙系统，包含网站端和 Android 原生 App。

## ✨ 功能特性

### 🌐 网站端
- 💕 表白发布（文字/标签/分类：表白/日常/扩列）
- 👍 点赞 & 评论
- 🔍 搜索功能
- 💬 实时私信聊天（Socket.IO）
- 📱 响应式设计（手机/平板/电脑）
- 🌸 樱花飘落动画 + 毛玻璃UI
- 🎯 点击屏幕出现爱心特效

### 👑 超级管理员后台 (`/admin/super/`)
- 📊 仪表盘（用户/帖子/评论/待审核统计）
- 💕 帖子管理（审核通过/隐藏/删除）
- 👥 用户管理（封禁/解封/设为管理员/删除）
- 💬 评论管理（删除违规评论）
- 🚩 举报处理（处理/驳回）
- ⚙️ 网站设置（名称/描述/注册开关/匿名开关/审核开关）
- 🔧 维护系统（开关维护模式/自定义图标/标题/背景色/倒计时/CSS/HTML）
- 🛡️ 管理员管理（添加/删除管理员）

### 🔧 管理员后台 (`/admin/admin/`)
- 📊 工作台（帖子/评论/待审核统计）
- 💕 帖子管理（审核通过/隐藏/删除）
- 💬 评论管理（删除）
- 🚩 举报处理（处理/驳回）
- ❌ 无权访问：用户管理/网站设置/维护系统/管理员管理

### 📱 Android App
- **用户端**：登录/注册/浏览/发布/点赞/评论/私信
- **管理员端**：帖子管理（审核/隐藏/删除）
- **超管端**：用户管理/管理员管理
- 检查更新 & 版本管理

---

## 🚀 部署指南

### 环境要求
- **Node.js** 16+（推荐 18+）
- **npm**

### 快速启动
```bash
git clone https://github.com/Zhkeji/sakura-love-wall.git
cd sakura-love-wall
npm install
npm start
```

### 访问地址
| 页面 | 地址 |
|------|------|
| 前台 | http://localhost:3000 |
| 后台入口 | http://localhost:3000/admin |
| 超管后台 | http://localhost:3000/admin/super/ |
| 管理员后台 | http://localhost:3000/admin/admin/ |

### 默认账号
| 角色 | 用户名 | 密码 |
|------|--------|------|
| 超级管理员 | admin | admin123 |

⚠️ **首次部署后请立即修改默认密码！**

---

## 🌍 生产部署

### 使用 PM2
```bash
npm install -g pm2
cd sakura-love-wall
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

## 📱 Android App

### 仓库地址
https://github.com/Zhkeji/sakura-love-wall-app

### 修改服务器地址
打开 `app/src/main/java/com/lovewall/app/api/ApiClient.java`：
```java
public static final String BASE_URL = "https://your-domain.com";
```

### 使用 AIDE Pro 构建
1. 安装 AIDE Pro
2. 复制项目到手机
3. 打开项目 → 运行构建

### 使用 Android Studio 构建
1. 打开项目
2. Gradle 同步
3. Build → Build APK

---

## 📁 项目结构

```
sakura-love-wall/
├── server/                 # 后端
│   ├── app.js             # 主入口
│   ├── database.js        # SQLite 数据库
│   ├── settings.js        # 设置管理
│   ├── socket.js          # Socket.IO 私信
│   ├── middleware/auth.js  # JWT 认证
│   └── routes/            # API 路由
│       ├── auth.js        # 注册/登录/资料
│       ├── posts.js       # 帖子 CRUD
│       ├── admin.js       # 管理后台 API
│       ├── chat.js        # 私信 API
│       ├── upload.js      # 图片上传
│       └── maintenance.js # 维护系统
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
├── data/                  # 数据库文件（自动生成）
└── package.json
```

---

## 🔑 API 接口

| 接口 | 方法 | 说明 | 权限 |
|------|------|------|------|
| /api/auth/register | POST | 注册 | 公开 |
| /api/auth/login | POST | 登录 | 公开 |
| /api/auth/me | GET | 获取当前用户 | 登录 |
| /api/posts | GET | 获取帖子列表 | 公开 |
| /api/posts | POST | 发布帖子 | 登录 |
| /api/posts/:id/like | POST | 点赞 | 登录 |
| /api/posts/:id/comments | POST | 评论 | 登录 |
| /api/chat/conversations | GET | 私信会话列表 | 登录 |
| /api/chat/conversations | POST | 创建会话 | 登录 |
| /api/admin/stats | GET | 管理统计 | 管理员 |
| /api/admin/posts | GET | 管理帖子 | 管理员 |
| /api/admin/users | GET | 用户列表 | 超管 |
| /api/admin/users/admin | POST | 添加管理员 | 超管 |
| /api/maintenance | GET/PUT | 维护设置 | 超管 |

---

## ⚠️ 安全建议

1. 首次部署后修改默认密码
2. 生产环境使用 HTTPS
3. 定期备份 `data/love-wall.db`
4. 已内置 API 速率限制（15分钟200次）
5. JWT Token 有效期 7 天

---

## 📄 License

MIT License
