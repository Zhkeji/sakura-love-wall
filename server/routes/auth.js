const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { getDb } = require('../database');
const { generateToken, authenticate } = require('../middleware/auth');
const { getSetting } = require('../settings');

const r = express.Router();

// ========== 注册 ==========
r.post('/register', (req, res) => {
  try {
    const { username, password, nickname, email } = req.body;
    if (!username || !password || !nickname) return res.status(400).json({ error: '请填写所有信息' });
    if (username.length < 3 || username.length > 20) return res.status(400).json({ error: '用户名3-20字符' });
    if (password.length < 6) return res.status(400).json({ error: '密码至少6位' });
    if (getSetting('allowRegister') !== 'true') return res.status(403).json({ error: '暂不开放注册' });

    const db = getDb();
    if (db.prepare('SELECT id FROM users WHERE username = ?').get(username)) {
      return res.status(400).json({ error: '用户名已存在' });
    }

    // 检查邮箱唯一性
    if (email) {
      if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) {
        return res.status(400).json({ error: '该邮箱已注册' });
      }
    }

    const id = uuidv4();
    const verifyToken = email ? crypto.randomBytes(32).toString('hex') : null;

    db.prepare(
      "INSERT INTO users (id, username, password, nickname, email, email_verified, verify_token, role, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'user', 'active')"
    ).run(id, username, bcrypt.hashSync(password, 10), nickname, email || null, email ? 0 : 1, verifyToken);

    const u = db.prepare('SELECT id, username, nickname, avatar, role FROM users WHERE id = ?').get(id);
    const token = generateToken(u);

    res.json({
      message: '注册成功',
      token,
      user: { id: u.id, username: u.username, nickname: u.nickname, avatar: u.avatar, role: u.role },
      verifyUrl: verifyToken ? `${req.protocol}://${req.get('host')}/api/auth/verify-email?token=${verifyToken}` : null
    });
  } catch (e) {
    console.error('Register error:', e);
    res.status(500).json({ error: '注册失败' });
  }
});

// ========== 登录 ==========
r.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: '请输入账号密码' });

    const db = getDb();
    const u = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!u) return res.status(401).json({ error: '账号或密码错误' });
    if (u.status === 'banned') return res.status(403).json({ error: '账号已被封禁' });
    if (!bcrypt.compareSync(password, u.password)) return res.status(401).json({ error: '账号或密码错误' });

    db.prepare("UPDATE users SET last_login = datetime('now') WHERE id = ?").run(u.id);
    const token = generateToken(u);

    res.json({
      message: '登录成功',
      token,
      user: {
        id: u.id, username: u.username, nickname: u.nickname,
        avatar: u.avatar, role: u.role, bio: u.bio,
        email: u.email, emailVerified: u.email_verified === 1
      }
    });
  } catch (e) {
    console.error('Login error:', e);
    res.status(500).json({ error: '登录失败' });
  }
});

// ========== 获取当前用户 ==========
r.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

// ========== 更新资料 ==========
r.put('/profile', authenticate, (req, res) => {
  try {
    const { nickname, bio, avatar } = req.body;
    const db = getDb();
    const fields = [], values = [];

    if (nickname) {
      if (nickname.length > 20) return res.status(400).json({ error: '昵称最长20字' });
      fields.push('nickname = ?'); values.push(nickname);
    }
    if (bio !== undefined) {
      if (bio.length > 200) return res.status(400).json({ error: '简介最长200字' });
      fields.push('bio = ?'); values.push(bio);
    }
    if (avatar) { fields.push('avatar = ?'); values.push(avatar); }

    if (!fields.length) return res.status(400).json({ error: '无更新内容' });

    values.push(req.user.id);
    db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values);

    const user = db.prepare('SELECT id, username, nickname, avatar, bio, role, email, email_verified FROM users WHERE id = ?').get(req.user.id);
    res.json({
      message: '更新成功',
      user: { ...user, emailVerified: user.email_verified === 1 }
    });
  } catch (e) {
    res.status(500).json({ error: '更新失败' });
  }
});

// ========== 修改密码 ==========
r.put('/password', authenticate, (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) return res.status(400).json({ error: '请输入密码' });
    if (newPassword.length < 6) return res.status(400).json({ error: '新密码至少6位' });

    const db = getDb();
    const u = db.prepare('SELECT password FROM users WHERE id = ?').get(req.user.id);
    if (!bcrypt.compareSync(oldPassword, u.password)) return res.status(401).json({ error: '旧密码错误' });

    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(bcrypt.hashSync(newPassword, 10), req.user.id);
    res.json({ message: '密码已修改' });
  } catch (e) {
    res.status(500).json({ error: '修改失败' });
  }
});

// ========== 绑定/更新邮箱 ==========
r.post('/bind-email', authenticate, (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: '请输入邮箱' });

    // 简单邮箱格式验证
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return res.status(400).json({ error: '邮箱格式不正确' });

    const db = getDb();

    // 检查邮箱是否已被其他用户绑定
    const existing = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, req.user.id);
    if (existing) return res.status(400).json({ error: '该邮箱已被其他账号绑定' });

    const verifyToken = crypto.randomBytes(32).toString('hex');
    db.prepare('UPDATE users SET email = ?, email_verified = 0, verify_token = ? WHERE id = ?')
      .run(email, verifyToken, req.user.id);

    // 在实际项目中，这里发送验证邮件
    // 这里返回验证链接供测试
    const verifyUrl = `${req.protocol}://${req.get('host')}/api/auth/verify-email?token=${verifyToken}`;

    res.json({
      message: '绑定成功，请查收验证邮件',
      verifyUrl: verifyUrl // 生产环境不返回此字段
    });
  } catch (e) {
    res.status(500).json({ error: '绑定失败' });
  }
});

// ========== 验证邮箱 ==========
r.get('/verify-email', (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).send('无效的验证链接');

    const db = getDb();
    const user = db.prepare('SELECT id FROM users WHERE verify_token = ?').get(token);
    if (!user) return res.status(400).send('验证链接已过期或无效');

    db.prepare('UPDATE users SET email_verified = 1, verify_token = NULL WHERE id = ?').run(user.id);

    // 返回成功页面
    res.send(`
      <!DOCTYPE html>
      <html lang="zh-CN">
      <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>邮箱验证成功</title>
      <style>
        body{min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:'Noto Sans SC',sans-serif;background:linear-gradient(135deg,#ffdee9,#b5fffc);margin:0}
        .card{background:#fff;border-radius:20px;padding:40px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.1);max-width:400px}
        .icon{font-size:64px;margin-bottom:16px}
        h1{font-size:24px;color:#27ae60;margin-bottom:8px}
        p{color:#636e72;margin-bottom:24px}
        a{display:inline-block;padding:12px 32px;background:linear-gradient(135deg,#e74c6f,#d63384);color:#fff;border-radius:12px;text-decoration:none;font-weight:600}
      </style>
      </head>
      <body>
        <div class="card">
          <div class="icon">✅</div>
          <h1>邮箱验证成功</h1>
          <p>你的邮箱已通过验证，现在可以正常使用所有功能了。</p>
          <a href="/">返回首页</a>
        </div>
      </body>
      </html>
    `);
  } catch (e) {
    res.status(500).send('验证失败');
  }
});

// ========== 获取用户公开信息 ==========
r.get('/user/:id', (req, res) => {
  try {
    const db = getDb();
    const user = db.prepare("SELECT id, username, nickname, avatar, bio, created_at FROM users WHERE id = ? AND status = 'active'").get(req.params.id);
    if (!user) return res.status(404).json({ error: '用户不存在' });
    const postCount = db.prepare("SELECT COUNT(*) as count FROM posts WHERE user_id = ? AND status = 'published'").get(req.params.id).count;
    res.json({ user: { ...user, postCount } });
  } catch (e) {
    res.status(500).json({ error: '获取用户信息失败' });
  }
});

module.exports = r;
